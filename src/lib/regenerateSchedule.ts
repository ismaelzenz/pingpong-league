import { db } from '@/lib/db'
import { matchdays, games, participants } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { addDays, format } from 'date-fns'

// Games with a real result (or awaiting confirmation) are always preserved.
const RESULT_STATUSES = ['confirmed', 'forfeited', 'result_entered']

/**
 * Rebuild the *unplayed, future* portion of a tournament's schedule for the current
 * roster, without touching anything that has already happened.
 *
 * Rules:
 *  - Games in matchdays that have already started (week_start <= today) are left exactly
 *    as they are — played or not. Pending ones there are catch-up games.
 *  - Games with a result anywhere (confirmed / forfeited / result_entered) are kept.
 *  - Unplayed games in future matchdays are discarded and recomputed.
 *
 * The remaining required pairings of the double round-robin (every ordered pair the
 * roster hasn't covered yet) are laid into the future matchdays, one game per player per
 * matchday. Anything that can't fit (e.g. a mid-season newcomer who needs more games than
 * there are remaining matchdays) becomes a catch-up game placed in an already-started
 * matchday, so both players see it as a game they still owe each other. If there are no
 * started matchdays yet, extra matchdays are appended instead.
 */
export async function regenerateSchedule(tournamentId: number, startedAt: string | null) {
  const roster = (await db.select({ userId: participants.userId }).from(participants)
    .where(eq(participants.tournamentId, tournamentId))).map(r => r.userId)

  const allMatchdays = await db.select().from(matchdays)
    .where(eq(matchdays.tournamentId, tournamentId)).orderBy(matchdays.number)
  const allGames = await db.select().from(games).where(eq(games.tournamentId, tournamentId))

  const today = new Date().toISOString().split('T')[0]
  const isStarted = (md: typeof allMatchdays[number]) => !!md.weekStart && md.weekStart <= today
  const startedMatchdays = allMatchdays.filter(isStarted)
  const startedIds = new Set(startedMatchdays.map(m => m.id))
  const futureMatchdays = allMatchdays.filter(m => !isStarted(m))

  // Keep results anywhere + everything inside started matchdays. Discard unplayed future games.
  const keep = (g: typeof allGames[number]) => RESULT_STATUSES.includes(g.status) || startedIds.has(g.matchdayId)
  const toDelete = allGames.filter(g => !keep(g)).map(g => g.id)
  if (toDelete.length) await db.delete(games).where(inArray(games.id, toDelete))
  const keptGames = allGames.filter(keep)

  if (roster.length < 2) {
    return { matchdays: allMatchdays.length, games: keptGames.length, catchUp: 0 }
  }

  // Every ordered pair must be played once (double round-robin). Drop the ones already covered.
  const covered = new Set(keptGames.map(g => `${g.homePlayerId}-${g.awayPlayerId}`))
  const remaining: [number, number][] = []
  for (const h of roster) for (const a of roster) {
    if (h !== a && !covered.has(`${h}-${a}`)) remaining.push([h, a])
  }
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }

  // Track which players already occupy each matchday so we never double-book.
  const usedByMd = new Map<number, Set<number>>()
  for (const md of allMatchdays) usedByMd.set(md.id, new Set())
  for (const g of keptGames) {
    const s = usedByMd.get(g.matchdayId)
    if (s) { s.add(g.homePlayerId); s.add(g.awayPlayerId) }
  }

  type Insert = { matchdayId: number; tournamentId: number; homePlayerId: number; awayPlayerId: number }
  const inserts: Insert[] = []
  const overflow: [number, number][] = []

  // Place each remaining pairing into the earliest future matchday where both are free.
  for (const [h, a] of remaining) {
    let placed = false
    for (const md of futureMatchdays) {
      const used = usedByMd.get(md.id)!
      if (!used.has(h) && !used.has(a)) {
        inserts.push({ matchdayId: md.id, tournamentId, homePlayerId: h, awayPlayerId: a })
        used.add(h); used.add(a)
        placed = true
        break
      }
    }
    if (!placed) overflow.push([h, a])
  }

  // Overflow → catch-up games in started matchdays (preferring a free slot), or appended
  // matchdays if the tournament hasn't started any matchdays yet.
  let catchUp = 0
  if (overflow.length && startedMatchdays.length > 0) {
    for (const [h, a] of overflow) {
      const target = startedMatchdays.find(md => {
        const u = usedByMd.get(md.id)!
        return !u.has(h) && !u.has(a)
      }) ?? startedMatchdays[startedMatchdays.length - 1]
      const used = usedByMd.get(target.id)!
      inserts.push({ matchdayId: target.id, tournamentId, homePlayerId: h, awayPlayerId: a })
      used.add(h); used.add(a)
      catchUp++
    }
  } else if (overflow.length) {
    let queue = overflow
    let weekStart = allMatchdays.at(-1)?.weekStart
      ? new Date(allMatchdays.at(-1)!.weekStart!)
      : (startedAt ? new Date(startedAt) : new Date())
    let nextNumber = (allMatchdays.at(-1)?.number ?? 0) + 1
    while (queue.length) {
      weekStart = addDays(weekStart, 7)
      const [row] = await db.insert(matchdays).values({
        tournamentId,
        number: nextNumber++,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      }).returning()
      const used = new Set<number>()
      const next: [number, number][] = []
      for (const [h, a] of queue) {
        if (!used.has(h) && !used.has(a)) {
          inserts.push({ matchdayId: row.id, tournamentId, homePlayerId: h, awayPlayerId: a })
          used.add(h); used.add(a)
        } else {
          next.push([h, a])
        }
      }
      queue = next
    }
  }

  if (inserts.length) {
    await db.insert(games).values(inserts.map(i => ({ ...i, status: 'pending' as const })))
  }

  return {
    matchdays: (await db.select({ id: matchdays.id }).from(matchdays).where(eq(matchdays.tournamentId, tournamentId))).length,
    games: keptGames.length + inserts.length,
    catchUp,
  }
}
