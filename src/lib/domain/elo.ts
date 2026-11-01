// The ELO rating maths, kept pure and DB-free so the ledger rebuild, previews and tests can all
// score the same way. See `eloLedger.ts` for the persistence side.

/** Everyone starts here. A brand-new player's rating before their very first game. */
export const START_ELO = 1000

/**
 * K-factor — how much a single game can move a rating. 32 is the classic club-chess value: fast
 * enough that a 10-game season means something, slow enough that one upset doesn't rewrite the
 * table.
 *
 * One K for everybody, deliberately. A faster "provisional" K for newcomers is the usual thing, but
 * it quietly breaks the system: ELO only stays a closed transfer while both sides are priced off
 * the same number, so a newcomer on K 64 beating a regular on K 32 would take 32 points and cost
 * their opponent only 16 — inventing 16 points out of nothing, every game, for each newcomer's
 * first few. That makes the league-wide average drift away from 1000 and there is no way to tell
 * from a scoreboard that it happened. A single K makes conservation structural instead of
 * something that merely usually holds. The cost is small: everyone starts at 1000 in a field that
 * spans roughly 900-1130, so a newcomer is never far off and closes the gap in a handful of games.
 */
const K_FACTOR = 32

/** Probability that `rating` beats `oppRating` — the standard logistic ELO curve. */
function expectedScore(rating: number, oppRating: number): number {
  return 1 / (1 + 10 ** ((oppRating - rating) / 400))
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** One player's inputs to a rating calculation. */
interface Rated {
  userId: number
  rating: number
}

/**
 * Rate one match between two sides of any size — 1v1, 2v3, 4v4.
 *
 * A side is represented by the **mean** of its members' ratings. Mean rather than sum, because a
 * bigger team isn't automatically a stronger one around a ping-pong table; what a side is worth is
 * how good its players are, not how many there are. That also keeps lopsided sides honest: three
 * weak players don't out-rate one strong one just by outnumbering them.
 *
 * ELO is a **transfer**: the match puts a fixed number of points on the table, and the winning side
 * takes exactly what the losing side gives up. Each side then splits its share evenly among its
 * members — so everyone on a side moves by the same amount, and a side with fewer players gets more
 * each because there are fewer of them to share it. That division by side size is what makes uneven
 * teams balance: 2 winners taking half the pot each transfer exactly what 3 losers paying a third
 * each give up. Without it (everyone moving the full amount) a 2v3 quietly creates or destroys
 * points every time it's played.
 *
 * Dividing by the side size is also the right call on the merits, not just for the bookkeeping: in a
 * 4v4 the result says far less about you personally than winning a game alone does, so it should
 * move your rating less.
 *
 * Deltas are deliberately **fractional**. Rounding each one to a whole point would reintroduce the
 * imbalance the split exists to remove (a pot of 17 split three ways is 5.67, and 3 x 6 != 17), and
 * the error would compound over a season. Ratings are stored to full precision and only rounded
 * where they're displayed.
 *
 * Side SIZE does not affect the odds, only the split: 1v2 is expected to go the same way as a 1v1
 * between the same average ratings. That's a decision — the lunchtime teams are picked at random, so
 * nobody is systematically short-handed and any edge from being a player up or down washes out. If
 * that stops being true (the bigger side starts winning well over half its games), shade
 * `expectedScore` by the size ratio; the ledger has the data to test it.
 *
 * With one player per side this reduces exactly to the classic two-player formula.
 */
function rateSides(winners: Rated[], losers: Rated[]): Map<number, number> {
  const expWinners = expectedScore(mean(winners.map(p => p.rating)), mean(losers.map(p => p.rating)))

  // Both sides are priced off the SAME surprise term. ELO is a transfer: what the winner takes is
  // what the loser gives up, so the loser's drop is the winner's gain negated, not a separate
  // quantity. (Using the winner's expected score for the loser instead inverts the system — it
  // would let a favourite lose and barely pay for it, while punishing the underdog heavily for a
  // defeat everyone predicted.)
  const surprise = 1 - expWinners

  // One K for everyone means each side's total is exactly `K * surprise`, whatever the sizes —
  // so every game is an exact transfer, and the league-wide average stays pinned at START_ELO.
  const deltas = new Map<number, number>()
  for (const p of winners) deltas.set(p.userId, (K_FACTOR * surprise) / winners.length)
  for (const p of losers) deltas.set(p.userId, -(K_FACTOR * surprise) / losers.length)
  return deltas
}

export type EloSource = 'league' | 'elo'

/** A rated result, in the order it should be applied. Sides hold one player each for a 1v1. */
export interface RatableGame {
  source: EloSource
  refId: number
  homePlayerIds: number[]
  awayPlayerIds: number[]
  homeSets: number
  awaySets: number
  /** When the result was entered — the ledger's ordering key. ISO timestamp. */
  playedAt: string
}

/** One player's side of one rated game, as stored in the ledger. */
export interface EloLedgerEntry {
  userId: number
  /** The single opponent in a 1v1; null for a team game, where there are several. */
  opponentId: number | null
  source: EloSource
  refId: number
  won: boolean
  mySets: number
  oppSets: number
  ratingBefore: number
  delta: number
  ratingAfter: number
  playedAt: string
  seq: number
}

/**
 * Chronological order for rating. `playedAt` is the timestamp the result was entered; ties (two
 * results submitted in the same second) fall back to the row id so a rebuild is deterministic.
 */
export function compareRatable(
  a: Pick<RatableGame, 'playedAt' | 'source' | 'refId'>,
  b: Pick<RatableGame, 'playedAt' | 'source' | 'refId'>,
): number {
  return a.playedAt.localeCompare(b.playedAt) || a.source.localeCompare(b.source) || a.refId - b.refId
}

/**
 * Replay every rated game in order and produce the full ledger — one entry per player per game.
 * Ratings are chained, so this is also what a recalculation after a corrected winner runs: cheap
 * enough (a few hundred games) to always redo from scratch rather than trying to patch the chain.
 *
 * Games with no winner (a 0–0 forfeit, or any tie) and games missing a side are skipped: there's
 * nothing to transfer.
 *
 * `from` continues an existing ledger instead of starting it: the players' current ratings and the
 * next free `seq`. Appending one new game this way is exactly the step a full replay would take for
 * it — same inputs, same arithmetic — which is what lets `syncEloForGame` skip the replay when a
 * result lands at the end of the chain.
 */
export function buildLedger(
  rated: RatableGame[],
  from: { ratings: Map<number, number>; nextSeq: number } = { ratings: new Map(), nextSeq: 0 },
): EloLedgerEntry[] {
  const rating = new Map(from.ratings)
  const ratingOf = (id: number) => rating.get(id) ?? START_ELO

  const entries: EloLedgerEntry[] = []
  let seq = from.nextSeq

  for (const g of [...rated].sort(compareRatable)) {
    if (g.homeSets === g.awaySets) continue // no winner → nothing to rate
    if (g.homePlayerIds.length === 0 || g.awayPlayerIds.length === 0) continue

    const homeWon = g.homeSets > g.awaySets
    const winnerIds = homeWon ? g.homePlayerIds : g.awayPlayerIds
    const loserIds = homeWon ? g.awayPlayerIds : g.homePlayerIds
    const winnerSets = homeWon ? g.homeSets : g.awaySets
    const loserSets = homeWon ? g.awaySets : g.homeSets

    const asRated = (ids: number[]): Rated[] =>
      ids.map(id => ({ userId: id, rating: ratingOf(id) }))
    const deltas = rateSides(asRated(winnerIds), asRated(loserIds))

    // A 1v1 has exactly one opponent worth naming; a team game has several, so the ledger leaves
    // it null and callers read the side lists off the game instead.
    const soloOpponent = (side: number[], other: number[]) =>
      side.length === 1 && other.length === 1 ? other[0] : null

    const push = (ids: number[], others: number[], won: boolean, mySets: number, oppSets: number) => {
      for (const id of ids) {
        const before = ratingOf(id)
        const delta = deltas.get(id)!
        entries.push({
          userId: id,
          opponentId: soloOpponent(ids, others),
          source: g.source,
          refId: g.refId,
          won,
          mySets,
          oppSets,
          ratingBefore: before,
          delta,
          ratingAfter: before + delta,
          playedAt: g.playedAt,
          seq,
        })
      }
    }
    push(winnerIds, loserIds, true, winnerSets, loserSets)
    push(loserIds, winnerIds, false, loserSets, winnerSets)

    // Apply only after both sides are read, so everyone is rated against the same starting state.
    for (const id of [...winnerIds, ...loserIds]) rating.set(id, ratingOf(id) + deltas.get(id)!)
    seq++
  }

  return entries
}

/**
 * The winning side of a stored result, as a list of user ids, or null when there's no winner
 * (forfeit / tie / not played yet). Used to decide whether a corrected score actually moves any
 * ratings — see `syncEloForGame`.
 */
export function winnersOf(g: {
  homePlayerIds: number[]
  awayPlayerIds: number[]
  homeSets: number | null
  awaySets: number | null
}): number[] | null {
  if (g.homeSets == null || g.awaySets == null || g.homeSets === g.awaySets) return null
  return g.homeSets > g.awaySets ? g.homePlayerIds : g.awayPlayerIds
}
