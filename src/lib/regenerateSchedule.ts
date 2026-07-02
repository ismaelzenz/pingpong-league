import { db } from '@/lib/db'
import { matchdays, games, participants, tournaments } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { generateSchedule } from '@/lib/schedule'
import { addDays, nextMonday, startOfWeek, parseISO, isValid, format } from 'date-fns'

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
  const trow = await db.select({ breakWeeks: tournaments.breakWeeks, startDate: tournaments.startDate })
    .from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  const breakSet = new Set(parseBreakWeeks(trow?.breakWeeks))
  const nextOpenWeek = (d: Date) => {
    let x = d
    while (breakSet.has(format(x, 'yyyy-MM-dd'))) x = addDays(x, 7)
    return x
  }

  // Where matchday 1 lands: the Monday of the admin-chosen start week if one is set,
  // otherwise the Monday after the tournament started (falls back to today).
  const chosenStart = trow?.startDate ? parseISO(trow.startDate) : null
  const firstWeekMonday = chosenStart && isValid(chosenStart)
    ? startOfWeek(chosenStart, { weekStartsOn: 1 })
    : (startedAt ? nextMonday(new Date(startedAt)) : nextMonday(new Date()))

  // Lock any matchday that already has a played/in-progress result.
  const isPlayed = (g: typeof allGames[number]) => RESULT_STATUSES.includes(g.status)
  const lockedMatchdayIds = new Set(allGames.filter(isPlayed).map(g => g.matchdayId))
  const lockedMatchdays = allMatchdays.filter(m => lockedMatchdayIds.has(m.id))

  // Games we keep exactly where they are: anything played, plus the pending regular games
  // sharing an in-progress (locked) matchday — a played matchday's line-up doesn't churn.
  // Catch-up games are backlog, never anchored: we always rebuild them, otherwise leftover
  // backlog from an earlier rebuild piles up in a locked matchday and is never reconsidered
  // (it silently eats matchday slots and leaves late matchdays empty).
  const isKept = (g: typeof allGames[number]) =>
    isPlayed(g) || (lockedMatchdayIds.has(g.matchdayId) && !g.isCatchUp)
  const lockedGames = allGames.filter(isKept)

  // Rebuild everything else: unplayed games in unlocked matchdays, and every pending
  // catch-up game (even those pinned to a locked matchday). Then drop now-empty matchdays.
  const staleGameIds = allGames.filter(g => !isKept(g)).map(g => g.id)
  if (staleGameIds.length) await db.delete(games).where(inArray(games.id, staleGameIds))
  const staleMatchdayIds = allMatchdays.filter(m => !lockedMatchdayIds.has(m.id)).map(m => m.id)
  if (staleMatchdayIds.length) await db.delete(matchdays).where(inArray(matchdays.id, staleMatchdayIds))

  if (roster.length < 2) return { matchdays: lockedMatchdays.length, games: lockedGames.length }

  // ── Nothing played: clean canonical rebuild from scratch ──────────────────────────────
  if (lockedMatchdays.length === 0) {
    const schedule = generateSchedule(roster)
    let weekStart = firstWeekMonday
    let gameCount = 0
    for (const md of schedule) {
      weekStart = nextOpenWeek(weekStart)
      const [row] = await db.insert(matchdays).values({
        tournamentId,
        number: md.number,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(addDays(weekStart, 4), 'yyyy-MM-dd'), // Mon–Fri; weekends left free
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

  // ── Some matchdays are locked: keep them, fill fresh future matchdays ─────────────────
  // Locked matchdays stay exactly as they are (a played game never moves). Every ordered
  // pair still has to be played once overall, so drop the pairings the locked matchdays
  // already cover and pack the rest into fresh future matchdays.
  //
  // We intentionally DON'T preserve the "play everyone once before any rematch" ordering
  // here: with played games pinned in place that can't always be honoured, so an early
  // rematch is allowed. What we DO keep: every pair exactly twice, at most one game per
  // player per matchday, and matchdays filled as evenly as possible. Even fill is what makes
  // byes even — a player who plays every matchday they can byes as often as everyone else.
  // Anything that genuinely can't fit becomes a catch-up game (playable anytime).
  const covered = new Set(lockedGames.map(g => `${g.homePlayerId}-${g.awayPlayerId}`))
  const remaining: [number, number][] = []
  for (const h of roster) for (const a of roster) {
    if (h !== a && !covered.has(`${h}-${a}`)) remaining.push([h, a])
  }

  // Canonical season length for this roster: even N → 2·(N−1) matchdays and no byes; odd N →
  // 2·N matchdays with one bye each (so each player byes exactly twice). Keep that many
  // matchdays in total (already-locked + future).
  const n = roster.length
  const gamesPerMatchday = Math.floor(n / 2)
  const canonicalTotal = n % 2 === 0 ? 2 * (n - 1) : 2 * n
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
      weekEnd: format(addDays(weekStart, 4), 'yyyy-MM-dd'), // Mon–Fri; weekends left free
    }).returning()
    futureMds.push({ id: row.id })
  }

  // ── Reserve the unavoidable catch-up games between the "short" players ─────────────────
  // A player can play at most one game per future matchday, i.e. `futureCount` grid games.
  // Anyone still owed more than that — typically someone who missed a locked matchday, e.g.
  // a mid-season joiner — must play the surplus as catch-up. Settle those surpluses by
  // pairing short players against EACH OTHER: one catch-up game then covers two shortfalls,
  // which keeps catch-ups (and the lop-sided byes they cause) to the theoretical minimum.
  const owed = new Map<string, [number, number]>(remaining.map(e => [`${e[0]}-${e[1]}`, e]))
  const owes = (h: number, a: number) => owed.has(`${h}-${a}`)
  const deficit = new Map<number, number>()
  for (const p of roster) {
    const cnt = remaining.filter(([h, a]) => h === p || a === p).length
    deficit.set(p, Math.max(0, cnt - futureCount))
  }
  const reserved: [number, number][] = []
  const reservedCount = new Map<number, number>(roster.map(p => [p, 0]))
  while ([...deficit.values()].some(d => d > 0)) {
    const short = roster.filter(p => (deficit.get(p) ?? 0) > 0).sort((a, b) => deficit.get(b)! - deficit.get(a)!)
    const p = short[0]
    const cands = roster.filter(x => x !== p && (owes(p, x) || owes(x, p)))
    // Prefer another short player p still owes (one catch-up settles two shortfalls at once);
    // otherwise spread the load onto whoever has taken the fewest catch-up games so far, so
    // the extra byes fall thinly across many players instead of piling onto one or two.
    let q = cands.filter(x => (deficit.get(x) ?? 0) > 0).sort((a, b) => deficit.get(b)! - deficit.get(a)!)[0]
    if (q === undefined) q = cands.sort((a, b) => reservedCount.get(a)! - reservedCount.get(b)!)[0]
    if (q === undefined) { deficit.set(p, 0); continue }
    const key = owes(p, q) ? `${p}-${q}` : `${q}-${p}`
    reserved.push(owed.get(key)!); owed.delete(key)
    reservedCount.set(p, reservedCount.get(p)! + 1); reservedCount.set(q, reservedCount.get(q)! + 1)
    deficit.set(p, Math.max(0, deficit.get(p)! - 1))
    if ((deficit.get(q) ?? 0) > 0) deficit.set(q, deficit.get(q)! - 1)
  }
  const reservedKeys = new Set(reserved.map(([h, a]) => `${h}-${a}`))
  const gridPool = remaining.filter(([h, a]) => !reservedKeys.has(`${h}-${a}`))

  // Pick the largest set of games playable in one matchday: a matching over the games still
  // owed (no player appears twice), capped at `cap`. "Most-constrained first" — match the
  // players who still owe the most games before the rest, so nobody is stranded for last.
  // Jittered attempts break ties differently and keep the fullest.
  const pickMatchday = (edges: [number, number][], cap: number): [number, number][] => {
    let best: [number, number][] = []
    for (let attempt = 0; attempt < 60 && best.length < cap; attempt++) {
      const deg = new Map<number, number>()
      for (const [h, a] of edges) { deg.set(h, (deg.get(h) ?? 0) + 1); deg.set(a, (deg.get(a) ?? 0) + 1) }
      const scored = edges.map(e => ({ e, score: deg.get(e[0])! + deg.get(e[1])! + Math.random() }))
      scored.sort((x, y) => y.score - x.score)
      const used = new Set<number>()
      const chosen: [number, number][] = []
      for (const { e } of scored) {
        if (chosen.length >= cap) break
        if (used.has(e[0]) || used.has(e[1])) continue
        used.add(e[0]); used.add(e[1])
        chosen.push(e)
      }
      if (chosen.length > best.length) best = chosen
    }
    return best
  }

  // Even per-matchday target: spread the grid games across all future matchdays instead of
  // packing early ones full and starving the last. When there aren't quite enough games to
  // fill every matchday, the shortfall shows up as one fewer game in a handful of matchdays
  // rather than a jarringly half-empty final matchday. Never exceed `gamesPerMatchday`.
  const base = futureCount > 0 ? Math.floor(gridPool.length / futureCount) : 0
  const withExtra = futureCount > 0 ? gridPool.length - base * futureCount : 0
  const targetFor = (i: number) => Math.min(gamesPerMatchday, base + (i < withExtra ? 1 : 0))

  // Fill every future matchday from the grid pool. Sequential greedy can strand a game near
  // the end, so run it a few times and keep the attempt that leaves the fewest unplaced.
  const fillOnce = () => {
    const pool = [...gridPool]
    const assign: [number, number][][] = futureMds.map(() => [])
    for (let i = 0; i < futureMds.length && pool.length; i++) {
      const chosen = pickMatchday(pool, targetFor(i))
      assign[i] = chosen
      const take = new Set(chosen.map(([h, a]) => `${h}-${a}`))
      for (let k = pool.length - 1; k >= 0; k--) {
        if (take.has(`${pool[k][0]}-${pool[k][1]}`)) pool.splice(k, 1)
      }
    }
    return { assign, stranded: pool }
  }
  let bestFill = fillOnce()
  for (let attempt = 1; attempt < 12 && bestFill.stranded.length > 0; attempt++) {
    const cand = fillOnce()
    if (cand.stranded.length < bestFill.stranded.length) bestFill = cand
  }

  type Insert = { matchdayId: number; tournamentId: number; homePlayerId: number; awayPlayerId: number; status: 'pending'; isCatchUp: boolean }
  const inserts: Insert[] = []
  bestFill.assign.forEach((edges, i) => {
    for (const [h, a] of edges) {
      inserts.push({ matchdayId: futureMds[i].id, tournamentId, homePlayerId: h, awayPlayerId: a, status: 'pending', isCatchUp: false })
    }
  })

  // Reserved surpluses plus anything the fill couldn't place become catch-up games (they
  // still need a matchday FK, so pin them to the most recent locked matchday).
  const catchUpMatchdayId = lockedMatchdays[lockedMatchdays.length - 1].id
  const catchUpEdges = [...reserved, ...bestFill.stranded]
  for (const [h, a] of catchUpEdges) {
    inserts.push({ matchdayId: catchUpMatchdayId, tournamentId, homePlayerId: h, awayPlayerId: a, status: 'pending', isCatchUp: true })
  }

  if (inserts.length) await db.insert(games).values(inserts)

  return { matchdays: lockedMatchdays.length + futureMds.length, games: lockedGames.length + inserts.length, catchUp: catchUpEdges.length }
}
