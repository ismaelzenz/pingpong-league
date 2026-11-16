// The ELO wall board (/display/elo/ranks): the rating ladder, the ELO record tiles and everyone's
// rating over the last month, for the rank-by-day chart. One read of the ledger, split here, like
// the league board's computeDisplayData.

import { db } from '@/lib/db'
import { eloHistory, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { cached } from '@/lib/cache'
import { todayISO } from '@/lib/dates'
import { START_ELO } from '@/lib/domain/elo'
import { showElo } from '@/lib/utils'
import type { RecordEntry } from '@/lib/data/display'

/** "This week" for the climber tile and the ladder's movement column: a rolling seven days. */
const WEEK_DAYS = 7
/** How far back the rank chart and the "biggest upset" tile look. */
const RACE_DAYS = 30

export interface EloLadderRow {
  userId: number
  name: string
  avatarColor: string | null
  rank: number
  rating: number
  peak: number
  wins: number
  losses: number
  /** Rating gained or lost over the last seven days; 0 when they haven't played. */
  weekDelta: number
}

export interface EloRaceSeries {
  userId: number
  name: string
  avatarColor: string | null
  /** Rating at the window's start (or 1000 at their first game, for a newcomer), then after each
   *  game in it, then held to today. */
  points: { at: string; rating: number }[]
}

export interface DisplayElo {
  ladder: EloLadderRow[]
  /** The ELO record tiles: top rating, climber of the week, biggest upset, all-time peak. */
  records: RecordEntry[]
  /** Everyone's rating over the last month, for the rank chart. */
  race: { from: string; to: string; series: EloRaceSeries[] }
}

export function computeDisplayElo(): Promise<DisplayElo> {
  // Today is in the key: "this week" and the race window move with the date, not only with data.
  return displayEloCached(todayISO())
}

const displayEloCached = cached('displayElo', ['elo'], displayElo)

async function displayElo(today: string): Promise<DisplayElo> {
  const rows = await db.select({
    userId: eloHistory.userId,
    opponentId: eloHistory.opponentId,
    won: eloHistory.won,
    delta: eloHistory.delta,
    ratingAfter: eloHistory.ratingAfter,
    playedAt: eloHistory.playedAt,
    name: users.name,
    avatarColor: users.avatarColor,
  }).from(eloHistory).leftJoin(users, eq(users.id, eloHistory.userId)).orderBy(eloHistory.seq, eloHistory.id)

  const dayStart = (daysAgo: number) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - daysAgo)
    return d.toISOString()
  }
  const weekFrom = dayStart(WEEK_DAYS - 1)
  const raceFrom = dayStart(RACE_DAYS - 1)
  const now = new Date().toISOString()

  // The ladder, replaying the ledger in order: the last row per player is their current rating.
  const byUser = new Map<number, Omit<EloLadderRow, 'rank'>>()
  for (const r of rows) {
    let e = byUser.get(r.userId)
    if (!e) {
      e = { userId: r.userId, name: r.name ?? '—', avatarColor: r.avatarColor ?? null, rating: START_ELO, peak: START_ELO, wins: 0, losses: 0, weekDelta: 0 }
      byUser.set(r.userId, e)
    }
    e.rating = r.ratingAfter
    e.peak = Math.max(e.peak, r.ratingAfter)
    if (r.won) e.wins++
    else e.losses++
    if (r.playedAt >= weekFrom) e.weekDelta += r.delta
  }
  const ladder: EloLadderRow[] = [...byUser.values()]
    .sort((a, b) => b.rating - a.rating || (b.wins + b.losses) - (a.wins + a.losses) || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const records: RecordEntry[] = []
  const add = (key: RecordEntry['key'], userId: number, value: string) => {
    const p = byUser.get(userId)
    if (p) records.push({ key, userId, name: p.name, avatarColor: p.avatarColor, value })
  }
  if (ladder[0]) add('eloTop', ladder[0].userId, `${showElo(ladder[0].rating)} rating`)
  const climber = [...ladder].sort((a, b) => b.weekDelta - a.weekDelta)[0]
  if (climber && Math.round(climber.weekDelta) > 0) add('eloClimber', climber.userId, `+${Math.round(climber.weekDelta)} this week`)
  // Biggest upset: the most a single win paid this month — ELO pays most when the favourite loses.
  let upset: (typeof rows)[number] | null = null
  for (const r of rows) if (r.won && r.playedAt >= raceFrom && (!upset || r.delta > upset.delta)) upset = r
  if (upset) {
    const opp = upset.opponentId != null ? byUser.get(upset.opponentId)?.name : null
    add('eloUpset', upset.userId, `+${Math.round(upset.delta)} ${opp ? `vs ${opp}` : 'in a team game'}`)
  }
  const peak = [...ladder].sort((a, b) => b.peak - a.peak)[0]
  if (peak) add('eloPeak', peak.userId, `Peaked at ${showElo(peak.peak)}`)

  // The race: everyone on the ladder, from where each stood when the window opened. A player whose
  // first rated game falls inside the window starts there, at 1000 — before it they weren't ranked.
  const series: EloRaceSeries[] = ladder.map(p => {
    const mine = rows.filter(r => r.userId === p.userId)
    const before = mine.filter(r => r.playedAt < raceFrom).at(-1)
    const inWindow = mine.filter(r => r.playedAt >= raceFrom)
    const points = before
      ? [{ at: raceFrom, rating: before.ratingAfter }]
      : [{ at: inWindow[0].playedAt, rating: START_ELO }]
    for (const r of inWindow) points.push({ at: r.playedAt, rating: r.ratingAfter })
    points.push({ at: now, rating: p.rating })
    return { userId: p.userId, name: p.name, avatarColor: p.avatarColor, points }
  })

  return { ladder, records, race: { from: raceFrom, to: now, series } }
}
