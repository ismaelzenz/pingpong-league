import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments, games } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq, and, or } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'

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

  // During registration: simple unenroll (no games exist yet).
  if (tournament.status === 'registration') {
    await db.delete(participants).where(eq(participants.id, participantId))
    return NextResponse.json({ ok: true })
  }

  // Finished tournaments are historical records — leave them intact.
  if (tournament.status === 'finished') {
    return NextResponse.json({ error: 'Cannot remove players from a finished tournament' }, { status: 400 })
  }

  // Active tournament: eliminate the player mid-season.
  // 1) Drop every game they were in (so they vanish from played matchdays too, and the
  //    live scoreboard deducts any points others earned against them).
  // 2) Remove them from the roster.
  // 3) Regenerate so the schedule is resized to the new roster — correct matchday count,
  //    games-per-matchday, and byes — preserving the remaining players' played results.
  const { userId, tournamentId } = participant

  const deletedGames = await db.delete(games)
    .where(and(
      eq(games.tournamentId, tournamentId),
      or(eq(games.homePlayerId, userId), eq(games.awayPlayerId, userId)),
    ))
    .returning({ id: games.id })

  await db.delete(participants).where(eq(participants.id, participantId))

  const result = await regenerateSchedule(tournamentId, tournament.startedAt)

  return NextResponse.json({
    ok: true,
    deletedGames: deletedGames.length,
    matchdays: result.matchdays,
  })
}
