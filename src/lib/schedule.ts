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
