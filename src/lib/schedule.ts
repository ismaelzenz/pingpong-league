export interface ScheduledGame {
  home: number
  away: number
}

export interface ScheduledMatchday {
  number: number
  games: ScheduledGame[]
}

const BYE = -1

export function generateSchedule(playerIds: number[]): ScheduledMatchday[] {
  const players = [...playerIds]

  // Shuffle for randomness
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[players[i], players[j]] = [players[j], players[i]]
  }

  if (players.length % 2 !== 0) players.push(BYE)

  const n = players.length
  const roundsPerLeg = n - 1
  const result: ScheduledMatchday[] = []

  const firstLegRounds = roundRobin(players)

  for (let r = 0; r < roundsPerLeg; r++) {
    const games: ScheduledGame[] = firstLegRounds[r]
      .filter(([a, b]) => a !== BYE && b !== BYE)
      .map(([a, b]) => ({ home: a, away: b }))
    result.push({ number: r + 1, games })
  }

  for (let r = 0; r < roundsPerLeg; r++) {
    const games: ScheduledGame[] = firstLegRounds[r]
      .filter(([a, b]) => a !== BYE && b !== BYE)
      .map(([a, b]) => ({ home: b, away: a }))
    result.push({ number: roundsPerLeg + r + 1, games })
  }

  return result
}

export interface DistributedGame {
  matchdayId: number
  home: number
  away: number
}

/**
 * Build the games for a player added after the tournament has started.
 *
 * The league is a double round-robin, so the new player must play every existing
 * player twice (once home, once away). We graft these games onto the matchdays that
 * already exist rather than regenerating the schedule (which would wipe played games).
 *
 * Leg-1 games (new player at home) fill the earliest matchdays; leg-2 games fill the
 * later ones — mirroring how the original two legs are laid out. Games that land in a
 * matchday whose week has already started are "catch-up" games; the rest are upcoming.
 *
 * `matchdayIds` must be ordered by matchday number. When there are fewer matchdays than
 * games (an even original roster), the final games wrap onto the first matchdays, so the
 * new player plays twice on those days — an accepted trade-off for not rescheduling.
 */
export function distributeNewPlayerGames(
  newPlayerId: number,
  opponentIds: number[],
  matchdayIds: number[],
): DistributedGame[] {
  if (matchdayIds.length === 0 || opponentIds.length === 0) return []

  const opps = [...opponentIds]
  for (let i = opps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[opps[i], opps[j]] = [opps[j], opps[i]]
  }

  const pairings: { home: number; away: number }[] = []
  for (const opp of opps) pairings.push({ home: newPlayerId, away: opp }) // leg 1
  for (const opp of opps) pairings.push({ home: opp, away: newPlayerId }) // leg 2

  const T = matchdayIds.length
  return pairings.map((pr, i) => ({
    matchdayId: matchdayIds[i % T],
    home: pr.home,
    away: pr.away,
  }))
}

function roundRobin(players: number[]): [number, number][][] {
  const n = players.length
  const rounds: [number, number][][] = []
  const circle = players.slice(1)
  const fixed = players[0]

  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = []
    const rotated = [...circle.slice(r), ...circle.slice(0, r)]
    const half = n / 2
    round.push([fixed, rotated[0]])
    for (let i = 1; i < half; i++) {
      round.push([rotated[i], rotated[n - 1 - i]])
    }
    rounds.push(round)
  }

  return rounds
}
