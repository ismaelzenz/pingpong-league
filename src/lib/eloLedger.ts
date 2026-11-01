import { db } from '@/lib/db'
import { eloGamePlayers, eloGames, eloHistory, games, tournaments, users } from '@/lib/db/schema'
import { and, desc, eq, exists, gt, inArray, notExists, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { cached } from '@/lib/cache'
import { buildLedger, compareRatable, START_ELO, type RatableGame, type EloSource } from '@/lib/elo'

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
 * Every game that has a winner, from both sources, in one list — or, with `only`, just that one
 * game if it qualifies. Both the full rebuild and the single-game append go through here, so
 * "which games count" is decided in exactly one place.
 *
 * League side: confirmed games from every season flagged to count for ELO — including seasons
 * played before ELO existed, which is what makes the first rebuild backfill the whole history.
 * Every real season counts, and stays counting once finished: this year's games still move ratings
 * next year, which is the point of a lifetime rating. The flag exists for an admin's test or
 * bug-repro copy, whose results would otherwise shift real players' ratings with games nobody
 * played. Forfeits are left out on purpose: a 0–0 no-show has no winner, so there's nothing to
 * transfer (it still costs the player in the league table, which is where a no-show belongs).
 *
 * `playedAt` is when the result was entered. Older rows predate that being recorded, so we fall
 * back through confirmedAt → createdAt to keep them in roughly the right order.
 */
async function collectRatableGames(
  q: Executor = db,
  only?: { source: EloSource; refId: number },
): Promise<RatableGame[]> {
  const leagueRows = only?.source === 'elo' ? [] : await q.select({
    id: games.id,
    homePlayerId: games.homePlayerId,
    awayPlayerId: games.awayPlayerId,
    homeSets: games.homeSets,
    awaySets: games.awaySets,
    submittedAt: games.submittedAt,
    confirmedAt: games.confirmedAt,
    createdAt: games.createdAt,
    // Null when the whole season counts; a timestamp when an admin switched ELO on midway and
    // chose to leave the games already played out of it.
    eloCountsFrom: tournaments.eloCountsFrom,
  }).from(games)
    .innerJoin(tournaments, eq(tournaments.id, games.tournamentId))
    .where(and(
      eq(games.status, 'confirmed'),
      eq(tournaments.countsForElo, true),
      only ? eq(games.id, only.refId) : undefined,
    ))

  // Each casual game comes back once per player, sides joined in, and is regrouped below.
  const casualRows = only?.source === 'league' ? [] : await q.select({
    id: eloGames.id,
    homeSets: eloGames.homeSets,
    awaySets: eloGames.awaySets,
    playedAt: eloGames.playedAt,
    userId: eloGamePlayers.userId,
    side: eloGamePlayers.side,
  }).from(eloGames)
    .leftJoin(eloGamePlayers, eq(eloGamePlayers.eloGameId, eloGames.id))
    .where(only ? eq(eloGames.id, only.refId) : undefined)
    .orderBy(eloGames.id, eloGamePlayers.id)

  const league: RatableGame[] = leagueRows
    .filter(g => g.homeSets != null && g.awaySets != null && g.homeSets !== g.awaySets)
    // A season switched on midway only counts from the moment the admin picked. Compared against
    // the same normalised `playedAt` the ledger orders by, so the cutoff means exactly what the
    // ledger means by "when this game happened".
    .filter(g => !g.eloCountsFrom
      || normaliseTs(g.submittedAt ?? g.confirmedAt ?? g.createdAt) >= normaliseTs(g.eloCountsFrom))
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

  const casualById = new Map<number, RatableGame>()
  for (const r of casualRows) {
    if (r.homeSets === r.awaySets) continue
    let g = casualById.get(r.id)
    if (!g) {
      g = {
        source: 'elo', refId: r.id, homePlayerIds: [], awayPlayerIds: [],
        homeSets: r.homeSets, awaySets: r.awaySets, playedAt: normaliseTs(r.playedAt),
      }
      casualById.set(r.id, g)
    }
    if (r.userId != null) (r.side === 'home' ? g.homePlayerIds : g.awayPlayerIds).push(r.userId)
  }

  return [...league, ...casualById.values()]
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
  // One write transaction around the read *and* the swap, so a rebuild that dies halfway rolls
  // back to the old ledger rather than leaving it empty (see `withWriteTransaction`).
  const entries = await withWriteTransaction(async tx => {
    const built = buildLedger(await collectRatableGames(tx))
    await tx.delete(eloHistory)
    // libSQL caps how many parameters one statement can bind, so insert in chunks.
    for (let i = 0; i < built.length; i += 200) {
      await tx.insert(eloHistory).values(built.slice(i, i + 200))
    }
    return built
  })
  // Games rated, counted properly: a 1v1 makes two entries but a 4v4 makes eight, so entries/2
  // stopped being the game count the moment team games existed.
  return { games: new Set(entries.map(e => `${e.source}:${e.refId}`)).size, entries: entries.length }
}

/**
 * Run `work` in a write transaction, one writer at a time.
 *
 * libSQL runs write transactions one at a time, so two results submitted together update the
 * ledger in turn — each reading a snapshot that already holds the other's game — instead of
 * interleaving and colliding on the ledger's unique key. But "one at a time" means the second
 * writer is refused with SQLITE_BUSY rather than queued, so the queueing happens here: back off and
 * retry. The work is a handful of statements, so the wait is short; giving up after ~3s still
 * surfaces a database that is genuinely stuck.
 */
async function withWriteTransaction<T>(work: (tx: Executor) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(work, { behavior: 'immediate' })
    } catch (e) {
      if (attempt >= 5 || !isBusy(e)) throw e
      await new Promise(r => setTimeout(r, 100 * 2 ** attempt))
    }
  }
}

/** Whether an error is libSQL refusing a write because another transaction holds the lock. */
function isBusy(e: unknown): boolean {
  for (let cur = e; cur instanceof Error; cur = cur.cause) {
    if ((cur as { code?: unknown }).code === 'SQLITE_BUSY' || cur.message.includes('SQLITE_BUSY')) return true
  }
  return false
}

/**
 * Bring the ledger up to date after one game's result changed, doing as little as possible.
 *
 * - **Same winner as the ledger already has** (a 2–0 → 2–1 correction): nothing. ELO only ever looks
 *   at who won, so not a single rating moves — the league table changes, the ledger doesn't.
 * - **A newly rated game that lands at the end of the chain** — the everyday case, a result entered
 *   just now: append its entries, rating the players from where they currently stand. That is the
 *   exact step a full replay would take for it, at a fixed cost instead of one that grows with the
 *   league's whole history.
 * - **Anything that changes the past** — a flipped winner, a forfeit or deletion pulling a rated game
 *   out, a result timestamped before games already rated: replay everything (`rebuildEloLedger`),
 *   since every rating after that point moves.
 *
 * Returns true when the ledger changed.
 */
export async function syncEloForGame(
  source: EloSource,
  refId: number,
  newWinners: number[] | null,
): Promise<boolean> {
  const outcome = await withWriteTransaction(async tx => {
    const forThisGame = await tx.select({ userId: eloHistory.userId, won: eloHistory.won })
      .from(eloHistory)
      .where(and(eq(eloHistory.source, source), eq(eloHistory.refId, refId)))

    const wasRated = forThisGame.length > 0
    const key = (ids: number[]) => [...ids].sort((a, b) => a - b).join(',')
    const recorded = key(forThisGame.filter(r => r.won).map(r => r.userId))

    // Compare the whole winning side, not just one player: in a team game the line-up can change
    // without the score changing, and that does move ratings.
    if (wasRated && newWinners !== null && recorded === key(newWinners)) {
      // No rating moves, but the ledger also records each game's score (the ELO game list shows
      // it), so a 2–0 → 2–1 correction still has to reach those two columns.
      const [game] = await collectRatableGames(tx, { source, refId })
      if (game) {
        const setScore = (ids: number[], mySets: number, oppSets: number) => tx.update(eloHistory)
          .set({ mySets, oppSets })
          .where(and(eq(eloHistory.source, source), eq(eloHistory.refId, refId), inArray(eloHistory.userId, ids)))
        await setScore(game.homePlayerIds, game.homeSets, game.awaySets)
        await setScore(game.awayPlayerIds, game.awaySets, game.homeSets)
      }
      return 'unchanged'
    }
    if (!wasRated && newWinners === null) return 'unchanged'
    if (wasRated) return 'rebuild'

    // Not rated yet. Read it through the same rules a rebuild uses — which also covers "this
    // season doesn't count for ELO", where there is nothing to do.
    const [game] = await collectRatableGames(tx, { source, refId })
    if (!game) return 'unchanged'

    const last = await tx.select({ playedAt: eloHistory.playedAt, source: eloHistory.source, refId: eloHistory.refId, seq: eloHistory.seq })
      .from(eloHistory).orderBy(desc(eloHistory.seq)).limit(1).then(r => r[0])
    if (last && compareRatable(last, game) >= 0) return 'rebuild' // belongs before rated games

    const entries = buildLedger([game], {
      ratings: await currentRatings(tx, [...game.homePlayerIds, ...game.awayPlayerIds]),
      nextSeq: last ? last.seq + 1 : 0,
    })
    if (entries.length > 0) await tx.insert(eloHistory).values(entries)
    return 'appended'
  })

  if (outcome === 'rebuild') await rebuildEloLedger()
  return outcome !== 'unchanged'
}

/** Each player's latest rating, from their most recent ledger entry; missing means unrated. */
async function currentRatings(q: Executor, userIds: number[]): Promise<Map<number, number>> {
  const later = alias(eloHistory, 'later')
  const rows = await q.select({ userId: eloHistory.userId, ratingAfter: eloHistory.ratingAfter })
    .from(eloHistory)
    .where(and(
      inArray(eloHistory.userId, userIds),
      notExists(q.select({ one: sql`1` }).from(later)
        .where(and(eq(later.userId, eloHistory.userId), gt(later.seq, eloHistory.seq)))),
    ))
  return new Map(rows.map(r => [r.userId, r.ratingAfter]))
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
