import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments, matchdays, games } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq, and, or } from 'drizzle-orm'

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
  // Deleting every game they took part in (past and future) makes the live-computed
  // scoreboard automatically deduct any points/victories/sets others earned against them.
  const { userId, tournamentId } = participant

  const deletedGames = await db.delete(games)
    .where(and(
      eq(games.tournamentId, tournamentId),
      or(eq(games.homePlayerId, userId), eq(games.awayPlayerId, userId)),
    ))
    .returning({ id: games.id })

  // Remove any matchday left with no games (e.g. a round that was only this player's game).
  const tournamentMatchdays = await db.select({ id: matchdays.id }).from(matchdays)
    .where(eq(matchdays.tournamentId, tournamentId))
  let deletedMatchdays = 0
  for (const md of tournamentMatchdays) {
    const remaining = await db.select({ id: games.id }).from(games)
      .where(eq(games.matchdayId, md.id))
      .then(r => r.length)
    if (remaining === 0) {
      await db.delete(matchdays).where(eq(matchdays.id, md.id))
      deletedMatchdays++
    }
  }

  await db.delete(participants).where(eq(participants.id, participantId))

  return NextResponse.json({
    ok: true,
    deletedGames: deletedGames.length,
    deletedMatchdays,
  })
}
