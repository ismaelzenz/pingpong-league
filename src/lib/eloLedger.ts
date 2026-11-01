import { db } from '@/lib/db'
import { eloGamePlayers, eloGames, eloHistory, games, tournaments, users } from '@/lib/db/schema'
import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { buildLedger, START_ELO, type RatableGame, type EloSource } from '@/lib/elo'

/** The app's database, or a transaction on it — so the rebuild can read inside its own transaction. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * The DB side of ELO: gathering every rated game, replaying it into `elo_history`, and reading the
 * ledger back for the scoreboard, the per-player table and the timeline chart.
 *
 * ELO is deliberately *global and lifetime* — it spans every season and every casual game, so a
 * rating means the same thing in March as it did in October. The league scoreboard stays per
 * tournament; this is the other axis.
 */

/**
 * Which tournaments count toward ELO — whichever ones are flagged to — mapped to the moment their
 * results start counting.
 *
 * Every real season is, and stays so once finished: this year's games still move ratings next
 * year, which is the point of a lifetime rating. The flag exists for the one case that would
 * otherwise poison the whole table — an admin's test or bug-repro copy, whose results would shift
 * real players' ratings with games nobody played, silently and permanently.
 *
 * The mapped value is `eloCountsFrom`: null when the whole season counts, or a timestamp when an
 * admin switched ELO on midway and chose to leave the games already played out of it.
 */
async function ratedTournaments(q: Executor = db): Promise<Map<number, string | null>> {
  const rows = await q.select({ id: tournaments.id, from: tournaments.eloCountsFrom })
    .from(tournaments).where(eq(tournaments.countsForElo, true))
  return new Map(rows.map(r => [r.id, r.from]))
}

/**
 * Every game that has a winner, from both sources, in one list.
 *
 * League side: confirmed games from every season that counts (see `ratedTournamentIds`) —
 * including seasons played before ELO existed, which is what makes the first rebuild backfill the
 * whole history. Forfeits are left out on purpose: a 0–0 no-show has no winner, so there's nothing
 * to transfer (it still costs the player in the league table, which is where a no-show belongs).
 *
 * `playedAt` is when the result was entered. Older rows predate that being recorded, so we fall
 * back through confirmedAt → createdAt to keep them in roughly the right order.
 */
async function collectRatableGames(q: Executor = db): Promise<RatableGame[]> {
  const rateable = await ratedTournaments(q)
  const leagueRows = rateable.size === 0 ? [] : await q.select({
    id: games.id,
    tournamentId: games.tournamentId,
    homePlayerId: games.homePlayerId,
    awayPlayerId: games.awayPlayerId,
    homeSets: games.homeSets,
    awaySets: games.awaySets,
    submittedAt: games.submittedAt,
    confirmedAt: games.confirmedAt,
    createdAt: games.createdAt,
  }).from(games).where(and(
    eq(games.status, 'confirmed'),
    inArray(games.tournamentId, [...rateable.keys()]),
  ))

  const casualRows = await q.select().from(eloGames)
  const sides = await loadSides(q)

  const league: RatableGame[] = leagueRows
    .filter(g => g.homeSets != null && g.awaySets != null && g.homeSets !== g.awaySets)
    // A season switched on midway only counts from the moment the admin picked. Compared against
    // the same normalised `playedAt` the ledger orders by, so the cutoff means exactly what the
    // ledger means by "when this game happened".
    .filter(g => {
      const from = rateable.get(g.tournamentId)
      return !from || normaliseTs(g.submittedAt ?? g.confirmedAt ?? g.createdAt) >= normaliseTs(from)
    })
    .map(g => ({
      source: 'league' as const,
      refId: g.id,
      // League fixtures are always one-on-one.
      homePlayerIds: [g.homePlayerId],
      awayPlayerIds: [g.awayPlayerId],
      homeSets: g.homeSets!,
      awaySets: g.awaySets!,
      playedAt: normaliseTs(g.submittedAt ?? g.confirmedAt ?? g.createdAt),
    }))

  const casual: RatableGame[] = casualRows
    .filter(g => g.homeSets !== g.awaySets)
    .map(g => ({
      source: 'elo' as const,
      refId: g.id,
      homePlayerIds: sides.get(g.id)?.home ?? [],
      awayPlayerIds: sides.get(g.id)?.away ?? [],
      homeSets: g.homeSets,
      awaySets: g.awaySets,
      playedAt: normaliseTs(g.playedAt),
    }))

  return [...league, ...casual]
}

/** Every casual game's two sides, keyed by game id. */
export async function loadSides(q: Executor = db): Promise<Map<number, { home: number[]; away: number[] }>> {
  const rows = await q.select().from(eloGamePlayers).orderBy(eloGamePlayers.id)
  const byGame = new Map<number, { home: number[]; away: number[] }>()
  for (const r of rows) {
    let e = byGame.get(r.eloGameId)
    if (!e) { e = { home: [], away: [] }; byGame.set(r.eloGameId, e) }
    e[r.side].push(r.userId)
  }
  return byGame
}

/**
 * Timestamps arrive in two shapes: ISO (`2025-06-03T14:02:11.000Z`, from the app) and SQLite's
 * `datetime('now')` (`2025-06-03 14:02:11`, from column defaults). Normalising to ISO keeps the
 * plain string sort in `compareRatable` chronological across both.
 */
function normaliseTs(ts: string): string {
  if (ts.includes('T')) return ts
  return ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z')
}

/**
 * Recompute the whole ledger from scratch and swap it in.
 *
 * Ratings are chained — each game's delta depends on where both players stood going in — so
 * changing the winner of a game from three weeks ago invalidates everything after it. Rather than
 * trying to patch the chain, we replay it: at league scale (hundreds of games) a full rebuild is
 * milliseconds, and it can't drift the way an incremental patch can. Callers decide *when* it's
 * needed; see `syncEloForGame`.
 */
export async function rebuildEloLedger(): Promise<{ games: number; entries: number }> {
  // One write transaction around the read *and* the swap. libSQL runs write transactions one at a
  // time, so two results submitted together rebuild in turn — each replaying a snapshot that
  // already holds the other's game — instead of interleaving their delete/insert and colliding on
  // the ledger's unique key. And a rebuild that dies halfway rolls back to the old ledger rather
  // than leaving it empty.
  const swap = () => db.transaction(async tx => {
    const built = buildLedger(await collectRatableGames(tx))
    await tx.delete(eloHistory)
    // libSQL caps how many parameters one statement can bind, so insert in chunks.
    for (let i = 0; i < built.length; i += 200) {
      await tx.insert(eloHistory).values(built.slice(i, i + 200))
    }
    return built
  }, { behavior: 'immediate' })

  // "One at a time" means the second writer is refused with SQLITE_BUSY rather than queued, so do
  // the queueing here: back off and retry. A rebuild is a handful of statements, so the wait is
  // short; giving up after ~3s still surfaces a database that is genuinely stuck.
  let entries: Awaited<ReturnType<typeof swap>>
  for (let attempt = 0; ; attempt++) {
    try {
      entries = await swap()
      break
    } catch (e) {
      if (attempt >= 5 || !isBusy(e)) throw e
      await new Promise(r => setTimeout(r, 100 * 2 ** attempt))
    }
  }
  // Games rated, counted properly: a 1v1 makes two entries but a 4v4 makes eight, so entries/2
  // stopped being the game count the moment team games existed.
  return { games: new Set(entries.map(e => `${e.source}:${e.refId}`)).size, entries: entries.length }
}

/** Whether an error is libSQL refusing a write because another transaction holds the lock. */
function isBusy(e: unknown): boolean {
  for (let cur = e; cur instanceof Error; cur = cur.cause) {
    if ((cur as { code?: unknown }).code === 'SQLITE_BUSY' || cur.message.includes('SQLITE_BUSY')) return true
  }
  return false
}

/**
 * Rebuild only if this game's result actually moves ELO.
 *
 * A corrected score that leaves the same player winning (2–0 → 2–1) changes the league table but
 * not a single rating: ELO only ever looks at who won. So we compare the winner the ledger already
 * recorded against the winner the game now has, and skip the replay when they match — which is
 * both faster and keeps `played_at` and every downstream rating exactly as they were.
 *
 * Returns true when a rebuild ran.
 */
export async function syncEloForGame(
  source: EloSource,
  refId: number,
  newWinners: number[] | null,
): Promise<boolean> {
  const forThisGame = await db.select({ userId: eloHistory.userId, won: eloHistory.won })
    .from(eloHistory)
    .where(and(eq(eloHistory.source, source), eq(eloHistory.refId, refId)))

  const wasRated = forThisGame.length > 0
  const key = (ids: number[]) => [...ids].sort((a, b) => a - b).join(',')
  const recorded = key(forThisGame.filter(r => r.won).map(r => r.userId))

  // Compare the whole winning side, not just one player: in a team game the line-up can change
  // without the score changing, and that does move ratings.
  if (wasRated && newWinners !== null && recorded === key(newWinners)) return false
  if (!wasRated && newWinners === null) return false

  await rebuildEloLedger()
  return true
}

// ── Reading the ledger ────────────────────────────────────────────────────────────────────────

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
export async function computeEloStandings(): Promise<EloStanding[]> {
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
export async function computeEloTimelines(): Promise<EloTimeline[]> {
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
export async function listEloGames(opts: { limit?: number; userId?: number } = {}): Promise<EloGameRow[]> {
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
