import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants, matchdays, games } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { generateSchedule } from '@/lib/schedule'
import { addDays, nextMonday, format } from 'date-fns'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tournamentId } = await req.json()

  const pList = await db.select().from(participants).where(eq(participants.tournamentId, tournamentId))
  if (pList.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 participants' }, { status: 400 })
  }

  // Mark tournament active
  await db.update(tournaments)
    .set({ status: 'active', startedAt: new Date().toISOString() })
    .where(eq(tournaments.id, tournamentId))

  // Generate schedule
  const playerIds = pList.map(p => p.userId)
  const schedule = generateSchedule(playerIds)

  let weekStart = nextMonday(new Date())

  for (const matchday of schedule) {
    const weekEnd = addDays(weekStart, 6)

    const [md] = await db.insert(matchdays).values({
      tournamentId,
      number: matchday.number,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    }).returning()

    await db.insert(games).values(
      matchday.games.map(g => ({
        matchdayId: md.id,
        tournamentId,
        homePlayerId: g.home,
        awayPlayerId: g.away,
      }))
    )

    weekStart = addDays(weekStart, 7)
  }

  return NextResponse.json({ ok: true, matchdays: schedule.length })
}
