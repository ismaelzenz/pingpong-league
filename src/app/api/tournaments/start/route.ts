import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'

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

  // Mark tournament active, then build the schedule (skipping any holiday break weeks).
  const startedAt = new Date().toISOString()
  await db.update(tournaments).set({ status: 'active', startedAt }).where(eq(tournaments.id, tournamentId))

  const result = await regenerateSchedule(tournamentId, startedAt)

  return NextResponse.json({ ok: true, matchdays: result.matchdays })
}
