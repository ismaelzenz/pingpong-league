import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants, matchdays, games } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const tournamentId = parseInt(id)

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tournament.status !== 'finished') {
    return NextResponse.json({ error: 'Only finished tournaments can be deleted' }, { status: 400 })
  }

  // Cascade delete in order: games → matchdays → participants → tournament
  const tournamentMatchdays = await db.select({ id: matchdays.id }).from(matchdays).where(eq(matchdays.tournamentId, tournamentId))
  for (const md of tournamentMatchdays) {
    await db.delete(games).where(eq(games.matchdayId, md.id))
  }
  await db.delete(matchdays).where(eq(matchdays.tournamentId, tournamentId))
  await db.delete(participants).where(eq(participants.tournamentId, tournamentId))
  await db.delete(tournaments).where(eq(tournaments.id, tournamentId))

  return NextResponse.json({ ok: true })
}
