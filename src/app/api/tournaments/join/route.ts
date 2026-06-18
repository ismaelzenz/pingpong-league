import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tournamentId } = await req.json()

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get()
  if (!tournament || tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Tournament not open for registration' }, { status: 400 })
  }

  const existing = await db.select().from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.userId, session.userId)))
    .get()
  if (existing) return NextResponse.json({ error: 'Already joined' }, { status: 409 })

  await db.insert(participants).values({ tournamentId, userId: session.userId })
  return NextResponse.json({ ok: true })
}
