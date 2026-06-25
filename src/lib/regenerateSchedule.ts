import { db } from '@/lib/db'
import { matchdays, games, participants, tournaments } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { generateSchedule } from '@/lib/schedule'
import { addDays, nextMonday, format } from 'date-fns'

// A matchday that contains any of these is considered "played" and is never touched.
const RESULT_STATUSES = ['confirmed', 'forfeited', 'result_entered']

function parseBreakWeeks(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Rebuild the not-yet-played part of a tournament's schedule for the current roster.
 *
 * A matchday is **locked** if it contains any game with a result (confirmed / forfeited /
 * awaiting confirmation). Locked matchdays — and every game in them — are left exactly as
 * they are: a played game never moves to a different matchday. Everything else is deleted
 * and rebuilt.
 *
 * - If nothing has been played yet, the whole schedule is rebuilt as a clean canonical
 *   double round-robin: even roster of N → 2·(N−1) matchdays of N/2 games; odd roster →
 *   one evenly-shared bye per matchday. Every pair meets exactly twice (once each way).
 * - If some matchdays are locked, they stay put and the remaining pairings are scheduled
 *   into a canonical number of fresh future matchdays. Anything that can't fit one-game-
 *   per-player-per-matchday (typically a mid-season newcomer's backlog) becomes a catch-up
 *   game — flagged `isCatchUp`, played anytime, outside the regular matchday grid. Either
 *   way every pair still ends up played exactly twice.
 */
export async function regenerateSchedule(tournamentId: number, startedAt: string | null) {
  const roster = (await db.select({ userId: participants.userId }).from(participants)
    .where(eq(participants.tournamentId, tournamentId))).map(r => r.userId)

  const allMatchdays = await db.select().from(matchdays)
    .where(eq(matchdays.tournamentId, tournamentId)).orderBy(matchdays.number)
  const allGames = await db.select().from(games).where(eq(games.tournamentId, tournamentId))

  // Holiday breaks: weeks the admin chose to leave matchday-free. We advance past them
  // when dating matchdays so no matchday lands on a blackout week.
  const trow = await db.select({ breakWeeks: tournaments.breakWeeks }).from(tournaments)
    .where(eq(tournaments.id, tournamentId)).then(r => r[0])
  const breakSet = new Set(parseBreakWeeks(trow?.breakWeeks))
  const nextOpenWeek = (d: Date) => {
    let x = d
    while (breakSet.has(format(x, 'yyyy-MM-dd'))) x = addDays(x, 7)
    return x
  }

  // Lock any matchday that already has a played/in-progress result.
  const lockedMatchdayIds = new Set(
    allGames.filter(g => RESULT_STATUSES.includes(g.status)).map(g => g.matchdayId)
  )
  const lockedMatchdays = allMatchdays.filter(m => lockedMatchdayIds.has(m.id))
  const lockedGames = allGames.filter(g => lockedMatchdayIds.has(g.matchdayId))

  // Drop every unplayed matchday and its games — they'll be rebuilt.
  const staleGameIds = allGames.filter(g => !lockedMatchdayIds.has(g.matchdayId)).map(g => g.id)
  if (staleGameIds.length) await db.delete(games).where(inArray(games.id, staleGameIds))
  const staleMatchdayIds = allMatchdays.filter(m => !lockedMatchdayIds.has(m.id)).map(m => m.id)
  if (staleMatchdayIds.length) await db.delete(matchdays).where(inArray(matchdays.id, staleMatchdayIds))

  if (roster.length < 2) return { matchdays: lockedMatchdays.length, games: lockedGames.length }

  // ── Nothing played: clean canonical rebuild from scratch ──────────────────────────────
  if (lockedMatchdays.length === 0) {
    const schedule = generateSchedule(roster)
    let weekStart = startedAt ? nextMonday(new Date(startedAt)) : nextMonday(new Date())
    let gameCount = 0
    for (const md of schedule) {
      weekStart = nextOpenWeek(weekStart)
      const [row] = await db.insert(matchdays).values({
        tournamentId,
        number: md.number,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      }).returning()
      if (md.games.length > 0) {
        await db.insert(games).values(md.games.map(g => ({
          matchdayId: row.id,
          tournamentId,
          homePlayerId: g.home,
          awayPlayerId: g.away,
          status: 'pending' as const,
        })))
        gameCount += md.games.length
      }
      weekStart = addDays(weekStart, 7)
    }
    return { matchdays: schedule.length, games: gameCount }
  }

  // ── Some matchdays are locked: keep them, rebuild a canonical future + catch-up ───────
  // Every ordered pair must be played once; drop the ones the locked games already cover.
  const covered = new Set(lockedGames.map(g => `${g.homePlayerId}-${g.awayPlayerId}`))
  const remaining: [number, number][] = []
  for (const h of roster) for (const a of roster) {
    if (h !== a && !covered.has(`${h}-${a}`)) remaining.push([h, a])
  }
  // Place newcomer games first (a newcomer plays at most once per matchday, so their
  // backlog is what overflows into catch-up — not an established player's games).
  const established = new Set(lockedGames.flatMap(g => [g.homePlayerId, g.awayPlayerId]))
  const newcomers = (h: number, a: number) => (established.has(h) ? 0 : 1) + (established.has(a) ? 0 : 1)
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }
  remaining.sort((x, y) => newcomers(y[0], y[1]) - newcomers(x[0], x[1]))

  // Keep the season the canonical length: as many future matchdays as a full schedule for
  // this roster would have, minus the ones already locked.
  const canonicalTotal = generateSchedule(roster).length
  const futureCount = Math.max(0, canonicalTotal - lockedMatchdays.length)

  let nextNumber = Math.max(...lockedMatchdays.map(m => m.number)) + 1
  let weekStart = lockedMatchdays[lockedMatchdays.length - 1].weekStart
    ? new Date(lockedMatchdays[lockedMatchdays.length - 1].weekStart!)
    : (startedAt ? new Date(startedAt) : new Date())

  const futureMds: { id: number }[] = []
  for (let i = 0; i < futureCount; i++) {
    weekStart = nextOpenWeek(addDays(weekStart, 7))
    const [row] = await db.insert(matchdays).values({
      tournamentId,
      number: nextNumber++,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
    }).returning()
    futureMds.push({ id: row.id })
  }

  type Insert = { matchdayId: number; tournamentId: number; homePlayerId: number; awayPlayerId: number; status: 'pending'; isCatchUp: boolean }
  const inserts: Insert[] = []
  const usedByMd = new Map<number, Set<number>>(futureMds.map(m => [m.id, new Set<number>()]))
  const countByMd = new Map<number, number>(futureMds.map(m => [m.id, 0]))
  // Catch-up games still need a matchday FK; pin them to the most recent locked matchday.
  const catchUpMatchdayId = lockedMatchdays[lockedMatchdays.length - 1].id
  let catchUp = 0

  for (const [h, a] of remaining) {
    // Place into the least-loaded matchday where both players are free, so games spread
    // evenly instead of front-loading early matchdays and starving later ones.
    let best: { id: number } | null = null
    for (const md of futureMds) {
      const used = usedByMd.get(md.id)!
      if (used.has(h) || used.has(a)) continue
      if (best === null || countByMd.get(md.id)! < countByMd.get(best.id)!) best = md
    }
    if (best) {
      inserts.push({ matchdayId: best.id, tournamentId, homePlayerId: h, awayPlayerId: a, status: 'pending', isCatchUp: false })
      const used = usedByMd.get(best.id)!
      used.add(h); used.add(a)
      countByMd.set(best.id, countByMd.get(best.id)! + 1)
    } else {
      inserts.push({ matchdayId: catchUpMatchdayId, tournamentId, homePlayerId: h, awayPlayerId: a, status: 'pending', isCatchUp: true })
      catchUp++
    }
  }

  if (inserts.length) await db.insert(games).values(inserts)

  return { matchdays: lockedMatchdays.length + futureMds.length, games: lockedGames.length + inserts.length, catchUp }
}
