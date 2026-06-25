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

export interface FixSuggestion {
  gameId: number
  matchdayNumber: number
  fromAName: string
  fromBName: string
  toAId: number
  toBId: number
  toAName: string
  toBName: string
}

interface GameWithId extends GameLite { id: number }

/**
 * Propose concrete one-edit fixes for an imbalanced schedule.
 *
 * The trick: changing an over-scheduled game's whole pairing to an under-scheduled pairing
 * fixes *both* at once and keeps every player's game count balanced. For each excess game in
 * an editable (future, unplayed) matchday, we find an under-scheduled pair whose two players
 * are free that matchday (so the change won't double-book anyone) and suggest the swap.
 * Applying every suggestion restores a valid "each pair exactly twice" schedule.
 */
export function suggestFixes(
  games: GameWithId[],
  roster: { id: number; name: string }[],
  editableMatchdayIds: Set<number>,
  matchdayNumberById: Map<number, number>,
): FixSuggestion[] {
  const nameById = new Map(roster.map(r => [r.id, r.name]))

  const count = new Map<string, number>()
  for (const g of games) {
    const k = key(g.homePlayerId, g.awayPlayerId)
    count.set(k, (count.get(k) ?? 0) + 1)
  }

  // Under-scheduled pairs, expanded by how many more meetings they still need.
  const underNeed: [number, number][] = []
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const c = count.get(key(roster[i].id, roster[j].id)) ?? 0
      for (let k = c; k < 2; k++) underNeed.push([roster[i].id, roster[j].id])
    }
  }
  if (underNeed.length === 0) return []

  // The changeable (editable-matchday) games of over-scheduled pairs — the excess ones.
  const editableByPair = new Map<string, GameWithId[]>()
  for (const g of games) {
    if (g.isCatchUp || !editableMatchdayIds.has(g.matchdayId)) continue
    const k = key(g.homePlayerId, g.awayPlayerId)
    const arr = editableByPair.get(k) ?? []
    arr.push(g)
    editableByPair.set(k, arr)
  }
  const excess: GameWithId[] = []
  for (const [k, gs] of editableByPair) {
    const over = (count.get(k) ?? 0) - 2
    for (let i = 0; i < over && i < gs.length; i++) excess.push(gs[i])
  }

  // How many games each player has in each matchday (counts, since they may be double-booked).
  const occ = new Map<number, Map<number, number>>()
  for (const g of games) {
    if (g.isCatchUp) continue
    let m = occ.get(g.matchdayId)
    if (!m) { m = new Map(); occ.set(g.matchdayId, m) }
    m.set(g.homePlayerId, (m.get(g.homePlayerId) ?? 0) + 1)
    m.set(g.awayPlayerId, (m.get(g.awayPlayerId) ?? 0) + 1)
  }

  const used = new Set<number>()
  const suggestions: FixSuggestion[] = []
  for (const g of excess) {
    const m = occ.get(g.matchdayId)!
    // Treat g's own players as freed (we're about to repurpose this game).
    const freeAfter = (p: number) =>
      (m.get(p) ?? 0) - (p === g.homePlayerId || p === g.awayPlayerId ? 1 : 0) <= 0

    let pick = -1
    for (let i = 0; i < underNeed.length; i++) {
      if (used.has(i)) continue
      const [c, d] = underNeed[i]
      if (key(c, d) === key(g.homePlayerId, g.awayPlayerId)) continue
      if (freeAfter(c) && freeAfter(d)) { pick = i; break }
    }
    if (pick === -1) continue

    used.add(pick)
    const [c, d] = underNeed[pick]
    m.set(g.homePlayerId, (m.get(g.homePlayerId) ?? 0) - 1)
    m.set(g.awayPlayerId, (m.get(g.awayPlayerId) ?? 0) - 1)
    m.set(c, (m.get(c) ?? 0) + 1)
    m.set(d, (m.get(d) ?? 0) + 1)
    suggestions.push({
      gameId: g.id,
      matchdayNumber: matchdayNumberById.get(g.matchdayId) ?? 0,
      fromAName: nameById.get(g.homePlayerId) ?? '?',
      fromBName: nameById.get(g.awayPlayerId) ?? '?',
      toAId: c, toBId: d,
      toAName: nameById.get(c) ?? '?',
      toBName: nameById.get(d) ?? '?',
    })
  }
  return suggestions
}
