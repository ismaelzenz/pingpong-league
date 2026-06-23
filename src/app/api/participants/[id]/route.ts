import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq, and } from 'drizzle-orm'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params
  const participantId = parseInt(id)
  if (isNaN(participantId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const participant = await db.select().from(participants).where(eq(participants.id, participantId)).then(r => r[0])
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, participant.tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  if (tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Can only unenroll players during registration' }, { status: 400 })
  }

  await db.delete(participants).where(eq(participants.id, participantId))
  return NextResponse.json({ ok: true })
}
