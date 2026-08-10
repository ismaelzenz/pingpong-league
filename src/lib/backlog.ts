// Shared definition of the "catch-up backlog": games still to be played that AREN'T part of the
// current matchday's fixtures. Used by the office display and the Catch-up games page so both
// always show exactly the same set. A game is backlog when it's unplayed (pending/postponed) AND:
//   • it's an explicit catch-up game (a newcomer's owed games, playable anytime), or
//   • it belongs to an earlier matchday whose week has already begun (i.e. it's overdue) — but NOT
//     the current matchday, whose games are shown as this week's fixtures.

export interface BacklogGameLike {
  status: string
  isCatchUp: boolean
  matchdayId: number
}

export function isCatchUpBacklog(
  g: BacklogGameLike,
  weekStartByMatchday: Map<number, string | null>,
  currentMatchdayId: number | null,
  today: string,
): boolean {
  if (g.status !== 'pending' && g.status !== 'postponed') return false
  if (g.isCatchUp) return true // explicit backlog — never a weekly fixture
  if (currentMatchdayId != null && g.matchdayId === currentMatchdayId) return false // this week's fixture
  const wk = weekStartByMatchday.get(g.matchdayId)
  return !!wk && wk <= today // overdue: an earlier week that has already started
}
