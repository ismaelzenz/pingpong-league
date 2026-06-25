import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { tournamentId } = await req.json()
  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status !== 'active') {
    return NextResponse.json({ error: 'Only active tournaments can be regenerated' }, { status: 400 })
  }

  const result = await regenerateSchedule(tournamentId, tournament.startedAt)
  return NextResponse.json({ ok: true, ...result })
}
