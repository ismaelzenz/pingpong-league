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
  // Two balanced halves that meet in a centre final, so the drawn bracket is symmetric:
  // `left` flows rightward, `right` flows leftward, the final sits between them.
  left: BracketMatch[][]
  right: BracketMatch[][]
  final?: BracketMatch
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
 * One half of the draw: a single-elimination sub-bracket that pairs as many competitors as
 * possible each round — so a bye only appears when a round has an odd number left (and lands on
 * the last one), never wasting round-1 games. `weight` (= leaf slots under a match) lets the UI
 * align rounds vertically. Match ids are prefixed (`L`/`R`) so the two halves never collide.
 * Returns the side's rounds and its finalist (the winner that goes on to the centre final).
 */
function buildSide(prefix: string, comps: Competitor[], results: Results): { rounds: BracketMatch[][]; finalist?: Competitor } {
  const rounds: BracketMatch[][] = []
  let current: Side[] = comps.slice()
  let r = 0
  while (current.length > 1) {
    const matches: BracketMatch[] = []
    let idx = 0
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        matches.push(resolveMatch(`${prefix}r${r}-m${idx}`, current[i], current[i + 1], results))
      } else {
        const m = resolveMatch(`${prefix}r${r}-m${idx}`, current[i], null, results) // odd one out → bye
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

  // A lone competitor (side of 1) has no match — it walks straight to the centre final.
  const finalist = rounds.length ? rounds[rounds.length - 1][0]?.winner : comps[0]
  return { rounds, finalist }
}

/**
 * A symmetric single-elimination bracket. The field is split down the middle into two balanced
 * halves (each built with {@link buildSide}); their two finalists meet in the centre final. This
 * keeps the drawn bracket even — half the players on each side — while still never wasting round-1
 * games. The two beaten finalists (the "semifinalists") contest the 3rd-place playoff.
 */
export function buildBracket(competitors: Competitor[], results: Results): Bracket {
  if (competitors.length <= 1) {
    return { left: [], right: [], champion: competitors[0] }
  }

  // Split down the middle — but keep BOTH halves even when the field is even. A naive split of an
  // N ≡ 2 (mod 4) field (e.g. 26 → 13/13) leaves both halves odd, so a lone player is left resting
  // on each side. Nudging the split by one (→ 14/12) makes both halves even, letting those two play
  // each other instead. (With an odd field one half is always odd, so a single rest is unavoidable.)
  let mid = Math.ceil(competitors.length / 2)
  if (competitors.length % 2 === 0 && mid % 2 === 1 && mid + 1 <= competitors.length - 1) mid += 1
  const left = buildSide('L', competitors.slice(0, mid), results)
  const right = buildSide('R', competitors.slice(mid), results)

  const final = resolveMatch('final', left.finalist, right.finalist, results)
  const champion = final.winner

  // 3rd-place playoff between the two beaten semifinalists — only when both halves actually
  // produced a real side-final (a genuine match, not a lone competitor who walked through).
  let thirdPlace: BracketMatch | undefined
  let bronze: Competitor | undefined
  const sideFinal = (rounds: BracketMatch[][]) => (rounds.length ? rounds[rounds.length - 1][0] : undefined)
  const lFinal = sideFinal(left.rounds)
  const rFinal = sideFinal(right.rounds)
  if (lFinal && rFinal && !lFinal.bye && !rFinal.bye) {
    const loser = (m: BracketMatch): Side => {
      if (!m.winner || !m.a || !m.b) return undefined
      return m.winner.id === (m.a as Competitor).id ? m.b : m.a
    }
    thirdPlace = resolveMatch('third', loser(lFinal), loser(rFinal), results)
    bronze = thirdPlace.winner
  }

  return { left: left.rounds, right: right.rounds, final, champion, thirdPlace, bronze }
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
