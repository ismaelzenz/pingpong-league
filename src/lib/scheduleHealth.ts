// Validates that a tournament's schedule is still a proper double round-robin after manual
// edits: every pair of players must meet exactly twice, and nobody may appear twice in one
// matchday. Surfaces problems so an admin knows what to fix.

interface GameLite {
  matchdayId: number
  homePlayerId: number
  awayPlayerId: number
  isCatchUp: boolean
}

export interface PairIssue {
  kind: 'over' | 'under'
  aName: string
  bName: string
  count: number // times this pair is scheduled (regular + catch-up); should be 2
  matchdayNumbers: number[] // regular-game matchdays where they meet
  catchUpCount: number
}

export interface ScheduleHealth {
  issues: PairIssue[]
  /** Matchday ids that contain an over-scheduled pairing or a double-booked player. */
  matchdayIdsWithIssue: Set<number>
  ok: boolean
}

const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`)

export function analyzeSchedule(
  games: GameLite[],
  matchdayNumberById: Map<number, number>,
  roster: { id: number; name: string }[],
): ScheduleHealth {
  const nameById = new Map(roster.map(r => [r.id, r.name]))

  // Tally every scheduled meeting per unordered pair.
  const agg = new Map<string, { count: number; mdNums: Set<number>; mdIds: Set<number>; catchUp: number }>()
  for (const g of games) {
    const k = key(g.homePlayerId, g.awayPlayerId)
    let e = agg.get(k)
    if (!e) { e = { count: 0, mdNums: new Set(), mdIds: new Set(), catchUp: 0 }; agg.set(k, e) }
    e.count++
    if (g.isCatchUp) {
      e.catchUp++
    } else {
      const num = matchdayNumberById.get(g.matchdayId)
      if (num != null) e.mdNums.add(num)
      e.mdIds.add(g.matchdayId)
    }
  }

  const matchdayIdsWithIssue = new Set<number>()
  const issues: PairIssue[] = []

  // Every pair in the roster should be scheduled exactly twice.
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const e = agg.get(key(roster[i].id, roster[j].id))
      const count = e?.count ?? 0
      if (count === 2) continue
      issues.push({
        kind: count > 2 ? 'over' : 'under',
        aName: nameById.get(roster[i].id) ?? '?',
        bName: nameById.get(roster[j].id) ?? '?',
        count,
        matchdayNumbers: e ? [...e.mdNums].sort((a, b) => a - b) : [],
        catchUpCount: e?.catchUp ?? 0,
      })
      if (count > 2 && e) for (const id of e.mdIds) matchdayIdsWithIssue.add(id)
    }
  }

  // A player appearing more than once in the same matchday's line-up.
  const byMatchday = new Map<number, Map<number, number>>()
  for (const g of games) {
    if (g.isCatchUp) continue
    let m = byMatchday.get(g.matchdayId)
    if (!m) { m = new Map(); byMatchday.set(g.matchdayId, m) }
    m.set(g.homePlayerId, (m.get(g.homePlayerId) ?? 0) + 1)
    m.set(g.awayPlayerId, (m.get(g.awayPlayerId) ?? 0) + 1)
  }
  for (const [mdId, players] of byMatchday) {
    for (const c of players.values()) if (c > 1) { matchdayIdsWithIssue.add(mdId); break }
  }

  // Over-scheduled pairs first (most urgent), then under, alphabetical within each.
  issues.sort((a, b) =>
    a.kind === b.kind ? a.aName.localeCompare(b.aName) : a.kind === 'over' ? -1 : 1
  )

  return { issues, matchdayIdsWithIssue, ok: issues.length === 0 }
}
