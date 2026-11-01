import { buildScoreboard, type ScoreboardEntry, type ScoreboardPlayer } from '@/lib/domain/scoreboard'
import { perspective } from '@/lib/domain/gameResult'

/** One recent result: W won, L lost, F lost by forfeit. */
export type FormResult = 'W' | 'L' | 'F'

/** How many recent results the form guide shows. */
const FORM_LENGTH = 5

export interface StandingRow extends ScoreboardEntry {
  rank: number
  /** Rank change vs before the current matchday: >0 climbed, <0 dropped, 0 same, null unknown. */
  movement: number | null
  /** The player's last few results, oldest first. */
  form: FormResult[]
}

interface FinishedGameLike {
  id: number
  matchdayId: number
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  status: string
  submittedAt: string | null
  updatedAt: string
}

interface MatchdayLike {
  id: number
  number: number
  weekStart: string | null
  weekEnd: string | null
}

/**
 * The league table as every standings view shows it — scoreboard page, dashboard, office TV:
 * ranked entries plus each player's weekly rank movement and recent form. Pure, so each loader
 * reads the data its own way and they still can't drift apart.
 */
export function rankStandings(
  players: ScoreboardPlayer[],
  finished: FinishedGameLike[],
  mds: MatchdayLike[],
  today: string,
): StandingRow[] {
  const current = buildScoreboard(players, finished)

  // Current matchday: the one whose week contains today, else the latest with any finished game.
  let currentMd = mds.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd) ?? null
  if (!currentMd) {
    const withGames = mds.filter(m => finished.some(g => g.matchdayId === m.id))
    currentMd = withGames.sort((a, b) => b.number - a.number)[0] ?? null
  }

  // Movement: each player's rank now vs before the current matchday's games were played.
  let movement: Map<number, number> | null = null
  if (currentMd) {
    const baseline = buildScoreboard(players, finished.filter(g => g.matchdayId !== currentMd!.id))
    const baseRank = new Map(baseline.map((e, i) => [e.userId, i]))
    movement = new Map(current.map((e, i) => [e.userId, (baseRank.get(e.userId) ?? i) - i]))
  }

  // Form follows when results went in, not the matchday number — a catch-up game from matchday 2
  // played last week is recent form.
  const byRecency = [...finished].sort((a, b) =>
    (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt) || a.id - b.id)
  const formOf = (userId: number): FormResult[] => byRecency
    .filter(g => g.homePlayerId === userId || g.awayPlayerId === userId)
    .slice(-FORM_LENGTH)
    .map(g => {
      const p = perspective(g, userId)
      return p.forfeited ? 'F' : p.won ? 'W' : 'L'
    })

  return current.map((e, i) => ({
    ...e, rank: i + 1, movement: movement ? (movement.get(e.userId) ?? 0) : null, form: formOf(e.userId),
  }))
}
