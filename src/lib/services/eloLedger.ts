import { db } from '@/lib/db'
import { eloGamePlayers, eloGames, eloHistory, games, tournaments } from '@/lib/db/schema'
import { and, desc, eq, gt, inArray, notExists, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { buildLedger, compareRatable, type RatableGame, type EloSource } from '@/lib/domain/elo'


/** The app's database, or a transaction on it — so the rebuild can read inside its own transaction. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Keeping the ELO ledger (`elo_history`) in step with the games: gathering every rated game,
 * appending a new result, or replaying everything when the past changes. Reading the ledger back
 * for pages lives in `lib/data/elo.ts`; the rating maths in `lib/domain/elo.ts`.
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
