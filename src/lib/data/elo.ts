import { db } from '@/lib/db'
import { eloGamePlayers, eloHistory, users } from '@/lib/db/schema'
import { and, desc, eq, exists, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { cached } from '@/lib/cache'
import { START_ELO, type EloSource } from '@/lib/domain/elo'

/**
 * Reading the ELO ledger for pages — the scoreboard, the per-player summaries, the timeline chart
 * and the game list. Cached (lib/cache.ts); the ledger itself is maintained by
 * `lib/services/eloLedger.ts`.
 */

/** Every casual game's two sides, keyed by game id. */
export async function loadSides(): Promise<Map<number, { home: number[]; away: number[] }>> {
  const rows = await db.select().from(eloGamePlayers).orderBy(eloGamePlayers.id)
  const byGame = new Map<number, { home: number[]; away: number[] }>()
  for (const r of rows) {
    let e = byGame.get(r.eloGameId)
    if (!e) { e = { home: [], away: [] }; byGame.set(r.eloGameId, e) }
    e[r.side].push(r.userId)
  }
  return byGame
}

export interface EloStanding {
  userId: number
  name: string
  avatarColor: string | null
  rating: number
  peak: number
  gamesPlayed: number
  wins: number
  losses: number
  /** Points gained/lost in their most recent rated game — the table's "last game" column. */
  lastDelta: number | null
}

/**
 * The ELO scoreboard: every member who has ever played a rated game, ranked by current rating.
 * Players with no rated games are left out — they'd all be a meaningless tie on the 1000 start.
 */
export const computeEloStandings = cached('eloStandings', ['elo'], eloStandings)

async function eloStandings(): Promise<EloStanding[]> {
  const rows = await db.select({
    userId: eloHistory.userId,
    won: eloHistory.won,
    delta: eloHistory.delta,
    ratingAfter: eloHistory.ratingAfter,
    playedAt: eloHistory.playedAt,
    seq: eloHistory.seq,
    // Names ride along on the same query rather than costing a second round trip.
    name: users.name,
    avatarColor: users.avatarColor,
  }).from(eloHistory).leftJoin(users, eq(users.id, eloHistory.userId)).orderBy(eloHistory.seq, eloHistory.id)

  const byUser = new Map<number, EloStanding>()
  for (const r of rows) {
    let e = byUser.get(r.userId)
    if (!e) {
      e = {
        userId: r.userId,
        name: r.name ?? '—',
        avatarColor: r.avatarColor ?? null,
        rating: START_ELO,
        peak: START_ELO,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        lastDelta: null,
      }
      byUser.set(r.userId, e)
    }
    // Rows arrive in replay order, so the last one wins for "current".
    e.rating = r.ratingAfter
    e.peak = Math.max(e.peak, r.ratingAfter)
    e.gamesPlayed++
    if (r.won) e.wins++
    else e.losses++
    e.lastDelta = r.delta
  }

  return [...byUser.values()].sort((a, b) =>
    b.rating - a.rating ||
    b.gamesPlayed - a.gamesPlayed ||
    a.name.localeCompare(b.name) ||
    a.userId - b.userId
  )
}

export interface EloTimelinePoint {
  seq: number
  playedAt: string
  rating: number
  delta: number
}

export interface EloTimeline {
  userId: number
  name: string
  avatarColor: string | null
  points: EloTimelinePoint[]
}

/**
 * Per-player rating over time, for the comparison chart. Each series opens with a synthetic
 * "start" point at 1000 (seq −1) so a line begins at the baseline rather than at its first result,
 * which makes a newcomer's first jump readable instead of a floating dot.
 */
export const computeEloTimelines = cached('eloTimelines', ['elo'], eloTimelines)

async function eloTimelines(): Promise<EloTimeline[]> {
  const rows = await db.select({
    userId: eloHistory.userId,
    ratingAfter: eloHistory.ratingAfter,
    delta: eloHistory.delta,
    playedAt: eloHistory.playedAt,
    seq: eloHistory.seq,
    name: users.name,
    avatarColor: users.avatarColor,
  }).from(eloHistory).leftJoin(users, eq(users.id, eloHistory.userId)).orderBy(eloHistory.seq, eloHistory.id)

  if (rows.length === 0) return []

  // Every series opens on a shared baseline: one day before the very first rated game anyone
  // played, at 1000. A shared date (rather than each player's own first game) is what makes the
  // far-left of the chart readable — hover there and every line reports the 1000 everyone starts
  // from, instead of some lines not having begun yet.
  const earliest = rows.reduce((min, r) => (r.playedAt < min ? r.playedAt : min), rows[0].playedAt)
  const baselineAt = new Date(new Date(earliest).getTime() - 86_400_000).toISOString()

  const byUser = new Map<number, EloTimeline>()
  for (const r of rows) {
    let t = byUser.get(r.userId)
    if (!t) {
      t = {
        userId: r.userId,
        name: r.name ?? '—',
        avatarColor: r.avatarColor ?? null,
        points: [{ seq: -1, playedAt: baselineAt, rating: START_ELO, delta: 0 }],
      }
      byUser.set(r.userId, t)
    }
    t.points.push({ seq: r.seq, playedAt: r.playedAt, rating: r.ratingAfter, delta: r.delta })
  }

  return [...byUser.values()]
}

export interface EloGameSidePlayer {
  userId: number
  name: string
  delta: number
  ratingAfter: number
}

export interface EloGameRow {
  key: string
  source: EloSource
  refId: number
  playedAt: string
  seq: number
  winnerSets: number
  loserSets: number
  winners: EloGameSidePlayer[]
  losers: EloGameSidePlayer[]
}

/**
 * The ledger collapsed to **one row per game** rather than one per player.
 *
 * The stored ledger has to be per-player — that's what a rating chain is — but reading it that way
 * shows every match twice, once from each side, which is just noise when the two rows are the same
 * event. Grouping by game puts the winners, the losers and what it cost each of them on a single
 * line, and makes a team game (where "the opponent" is three people) representable at all.
 */
export const listEloGames = cached('eloGames', ['elo'], eloGameRows)

async function eloGameRows(opts: { limit?: number; userId?: number } = {}): Promise<EloGameRow[]> {
  const { limit = 400, userId } = opts
  // Filtering by player has to keep the *whole* game — you want to see who you beat, not just your
  // own line — so the filter is "games this player appears in", done in SQL so a profile page
  // doesn't read the whole league's ledger to show ten of its own games.
  const mine = alias(eloHistory, 'mine')
  const inMyGames = userId != null
    ? exists(db.select({ one: sql`1` }).from(mine).where(and(
        eq(mine.userId, userId), eq(mine.source, eloHistory.source), eq(mine.refId, eloHistory.refId))))
    : undefined

  // Take the most recent `limit` games by pulling their entries in reverse order. Two players per
  // 1v1, more for a team game, so over-fetch rows and trim to whole games afterwards.
  const scoped = await db.select({
    userId: eloHistory.userId,
    source: eloHistory.source,
    refId: eloHistory.refId,
    won: eloHistory.won,
    mySets: eloHistory.mySets,
    oppSets: eloHistory.oppSets,
    delta: eloHistory.delta,
    ratingAfter: eloHistory.ratingAfter,
    playedAt: eloHistory.playedAt,
    seq: eloHistory.seq,
    name: users.name,
  }).from(eloHistory)
    .leftJoin(users, eq(users.id, eloHistory.userId))
    .where(inMyGames)
    .orderBy(desc(eloHistory.seq), desc(eloHistory.id))

  const byGame = new Map<string, EloGameRow>()
  for (const r of scoped) {
    const key = `${r.source}:${r.refId}`
    let g = byGame.get(key)
    if (!g) {
      if (byGame.size >= limit) continue // already have the newest `limit` games
      g = {
        key,
        source: r.source,
        refId: r.refId,
        playedAt: r.playedAt,
        seq: r.seq,
        winnerSets: r.won ? r.mySets : r.oppSets,
        loserSets: r.won ? r.oppSets : r.mySets,
        winners: [],
        losers: [],
      }
      byGame.set(key, g)
    }
    const entry: EloGameSidePlayer = {
      userId: r.userId,
      name: r.name ?? '—',
      delta: r.delta,
      ratingAfter: r.ratingAfter,
    }
    ;(r.won ? g.winners : g.losers).push(entry)
  }

  return [...byGame.values()].sort((a, b) => b.seq - a.seq)
}

/** How many games a player page's "Recent games" shows. */
export const PLAYER_RECENT_GAMES = 10

/**
 * One player's ELO for their profile page: their standing (null before their first rated game),
 * rank among everyone rated, and their latest rated games. A plain async function so a page can
 * start it in the same parallel batch as its own queries.
 */
export async function loadPlayerElo(userId: number) {
  const [standings, recent] = await Promise.all([
    computeEloStandings(),
    listEloGames({ userId, limit: PLAYER_RECENT_GAMES }),
  ])
  const rank = standings.findIndex(s => s.userId === userId)
  return { entry: rank >= 0 ? standings[rank] : null, rank: rank + 1, of: standings.length, recent }
}

export type PlayerElo = Awaited<ReturnType<typeof loadPlayerElo>>
