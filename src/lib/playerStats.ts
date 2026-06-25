// Extra per-player stats derived from their finished games, beyond the raw scoreboard totals.

interface GameLite {
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  status: string
}

export interface PlayerForm {
  form: ('W' | 'L')[] // chronological, most recent 5
  longestWinStreak: number
  winPct: number // 0..1 over games played
  setWinPct: number // 0..1 over sets played
}

/** `games` must be the player's confirmed/forfeited games, ordered oldest → newest. */
export function computePlayerForm(games: GameLite[], playerId: number): PlayerForm {
  let wins = 0, played = 0, setsWon = 0, setsLost = 0, streak = 0, best = 0
  const results: ('W' | 'L')[] = []

  for (const g of games) {
    const isHome = g.homePlayerId === playerId
    const mine = (isHome ? g.homeSets : g.awaySets) ?? 0
    const opp = (isHome ? g.awaySets : g.homeSets) ?? 0
    setsWon += mine
    setsLost += opp
    played++
    const won = g.status !== 'forfeited' && mine > opp
    results.push(won ? 'W' : 'L')
    if (won) { wins++; streak++; best = Math.max(best, streak) } else { streak = 0 }
  }

  return {
    form: results.slice(-5),
    longestWinStreak: best,
    winPct: played ? wins / played : 0,
    setWinPct: setsWon + setsLost ? setsWon / (setsWon + setsLost) : 0,
  }
}
