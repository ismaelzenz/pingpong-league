import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/apiAuth'
import { eq } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

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
