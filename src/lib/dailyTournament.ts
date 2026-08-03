// Pure logic for the self-serve "daily tournament" tool (no DB). A tournament is a format
// (league / knockout), a mode (singles / doubles) and a list of competitors. Results are a map
// keyed by match id. Everything else (bracket, standings) is derived from these.

export type Person = { id: string; name: string; color: string }
export type Competitor = { id: string; members: Person[] } // 1 member = singles, 2 = doubles
export type Format = 'league' | 'knockout'
export type Mode = 'singles' | 'doubles'
export type Scores = { a: number | null; b: number | null }
export type Results = Record<string, Scores>

export type TournamentConfig = {
  name: string
  format: Format
  mode: Mode
  competitors: Competitor[]
  thirdPlace?: boolean // knockout only: play a 3rd/4th place game (default true)
}
export type SavedTournament = { config: TournamentConfig; results: Results }

export const EMPTY_SCORE: Scores = { a: null, b: null }

export function competitorName(c: Competitor): string {
  return c.members.map(m => m.name).join(' & ')
}

export function scoreWinner(s: Scores | undefined): 'a' | 'b' | null {
  if (!s || s.a == null || s.b == null || s.a === s.b) return null
  return s.a > s.b ? 'a' : 'b'
}

/** Cycles a tapped score cell: – → 0 → 1 → 2 → – */
export function cycleScore(cur: number | null | undefined): number | null {
  return cur == null ? 0 : cur === 0 ? 1 : cur === 1 ? 2 : null
}

// ── Knockout ────────────────────────────────────────────────────────────────────────────────

type Side = Competitor | null | undefined // Competitor = known · null = BYE · undefined = TBD
export type BracketMatch = { id: string; a: Side; b: Side; score?: Scores; winner?: Competitor; weight?: number; bye?: boolean }
export interface Bracket {
  rounds: BracketMatch[][]
  finalRound: number
  champion?: Competitor
  thirdPlace?: BracketMatch
  bronze?: Competitor
}

function resolveMatch(id: string, a: Side, b: Side, results: Results): BracketMatch {
  const score = results[id]
  let winner: Competitor | undefined
  if (a && b === null) winner = a          // opponent is a BYE
  else if (b && a === null) winner = b
  else if (a && b) {
    const w = scoreWinner(score)
    winner = w === 'a' ? a : w === 'b' ? b : undefined
  }
  return { id, a, b, score, winner }
}

/**
 * Single-elimination bracket that pairs as many competitors as possible each round — so a bye only
 * appears when a round has an odd number left (and lands on the last one), never wasting round-1
 * games. `weight` (= leaf slots under a match) lets the UI align rounds vertically.
 */
export function buildBracket(competitors: Competitor[], results: Results): Bracket {
  const rounds: BracketMatch[][] = []
  let current: Side[] = competitors.slice()
  let r = 0
  while (current.length > 1) {
    const matches: BracketMatch[] = []
    let idx = 0
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        matches.push(resolveMatch(`r${r}-m${idx}`, current[i], current[i + 1], results))
      } else {
        const m = resolveMatch(`r${r}-m${idx}`, current[i], null, results) // odd one out → bye
        m.bye = true
        matches.push(m)
      }
      idx++
    }
    rounds.push(matches)
    current = matches.map(m => m.winner)
    r++
  }

  // Alignment weights: leaves = 1, a match's weight = the sum of the matches feeding it.
  if (rounds[0]) rounds[0].forEach(m => { m.weight = 1 })
  for (let rr = 1; rr < rounds.length; rr++) {
    rounds[rr].forEach((m, j) => {
      m.weight = (rounds[rr - 1][2 * j]?.weight ?? 0) + (rounds[rr - 1][2 * j + 1]?.weight ?? 0)
    })
  }

  const finalRound = rounds.length - 1
  const champion = rounds[finalRound]?.[0]?.winner

  let thirdPlace: BracketMatch | undefined
  let bronze: Competitor | undefined
  const semis = rounds[finalRound - 1]
  // Only offer a 3rd-place playoff when both semifinals are real matchups (not a bye).
  if (semis && semis.length === 2 && !semis[0].bye && !semis[1].bye) {
    const loser = (m: BracketMatch): Side => {
      if (!m.winner || !m.a || !m.b) return undefined
      return m.winner.id === (m.a as Competitor).id ? m.b : m.a
    }
    thirdPlace = resolveMatch('third', loser(semis[0]), loser(semis[1]), results)
    bronze = thirdPlace.winner
  }

  return { rounds, finalRound, champion, thirdPlace, bronze }
}

/** Human label for a knockout round given its index and the total number of rounds. */
export function roundName(index: number, total: number): string {
  const fromEnd = total - 1 - index
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinals'
  if (fromEnd === 2) return 'Quarterfinals'
  return `Round ${index + 1}`
}

// ── League (round-robin) ──────────────────────────────────────────────────────────────────────

export type LeagueMatch = { id: string; a: Competitor; b: Competitor }
export type LeagueRound = { number: number; matches: LeagueMatch[] }

function pairId(a: Competitor, b: Competitor): string {
  return a.id < b.id ? `L-${a.id}__${b.id}` : `L-${b.id}__${a.id}`
}

/** Round-robin schedule (circle method). Each match stores competitors in a stable a<b order. */
export function buildLeagueRounds(competitors: Competitor[]): LeagueRound[] {
  const list: (Competitor | null)[] = [...competitors]
  if (list.length % 2 === 1) list.push(null) // bye
  const n = list.length
  const idx = list.map((_, i) => i)
  const rounds: LeagueRound[] = []
  for (let r = 0; r < n - 1; r++) {
    const matches: LeagueMatch[] = []
    for (let i = 0; i < n / 2; i++) {
      const x = list[idx[i]], y = list[idx[n - 1 - i]]
      if (x && y) {
        const [first, second] = x.id < y.id ? [x, y] : [y, x]
        matches.push({ id: pairId(first, second), a: first, b: second })
      }
    }
    rounds.push({ number: r + 1, matches })
    idx.splice(1, 0, idx.pop()!) // rotate, keeping the first fixed
  }
  return rounds
}

export type StandingRow = {
  competitor: Competitor
  played: number
  won: number
  lost: number
  setsWon: number
  setsLost: number
}

export function computeStandings(competitors: Competitor[], results: Results): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    competitors.map(c => [c.id, { competitor: c, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0 }]),
  )
  for (let i = 0; i < competitors.length; i++) {
    for (let j = i + 1; j < competitors.length; j++) {
      const [first, second] = competitors[i].id < competitors[j].id ? [competitors[i], competitors[j]] : [competitors[j], competitors[i]]
      const s = results[pairId(first, second)]
      if (!s || s.a == null || s.b == null) continue
      const rf = rows.get(first.id)!, rs = rows.get(second.id)!
      rf.played++; rs.played++
      rf.setsWon += s.a; rf.setsLost += s.b
      rs.setsWon += s.b; rs.setsLost += s.a
      if (s.a > s.b) { rf.won++; rs.lost++ }
      else if (s.b > s.a) { rs.won++; rf.lost++ }
    }
  }
  return [...rows.values()].sort((x, y) =>
    y.won - x.won ||
    (y.setsWon - y.setsLost) - (x.setsWon - x.setsLost) ||
    y.setsWon - x.setsWon,
  )
}
