// Shared per-game scoring rules. Keeping the "from this player's perspective" math and the
// best-of-3 validation in one place stops the scoreboard, stats, and profile pages from drifting.

interface GameLike {
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  status: string
}

export interface GamePerspective {
  isHome: boolean
  mySets: number
  oppSets: number
  /** True only for a match actually won on court (never for a forfeit). */
  won: boolean
  forfeited: boolean
}

/** A single game seen from `playerId`'s side: their sets, the opponent's, and the outcome. */
export function perspective(game: GameLike, playerId: number): GamePerspective {
  const isHome = game.homePlayerId === playerId
  const forfeited = game.status === 'forfeited'
  // A forfeit is a game that never got played — it counts as a 0–2 loss for BOTH players (the
  // stored 0–0 score has no winner), so each side sees itself losing 0–2. This makes a no-show
  // dent set difference just like an actual loss, everywhere sets are counted.
  const mySets = forfeited ? 0 : ((isHome ? game.homeSets : game.awaySets) ?? 0)
  const oppSets = forfeited ? 2 : ((isHome ? game.awaySets : game.homeSets) ?? 0)
  const won = !forfeited && mySets > oppSets
  return { isHome, mySets, oppSets, won, forfeited }
}

/** League points for a confirmed game: 1 per set won, +1 bonus for taking the match. */
export function pointsFor(mySets: number, oppSets: number): number {
  return mySets + (mySets > oppSets ? 1 : 0)
}

/** A valid best-of-3 result: the winner has exactly 2 sets, the loser 0 or 1. */
export function isValidResult(homeSets: number, awaySets: number): boolean {
  return (homeSets === 2 && (awaySets === 0 || awaySets === 1)) ||
         (awaySets === 2 && (homeSets === 0 || homeSets === 1))
}
