import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments, games, users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { and, eq, or } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { tournamentId, userId } = await req.json()
  if (!tournamentId || !userId) {
    return NextResponse.json({ error: 'tournamentId and userId are required' }, { status: 400 })
  }

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status !== 'active') {
    // Registration uses the self-serve join flow; finished tournaments are read-only.
    return NextResponse.json({ error: 'Players can only be added to an active tournament here' }, { status: 400 })
  }

  const user = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId)).then(r => r[0])
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await db.select().from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.userId, userId)))
    .then(r => r[0])
  if (existing) return NextResponse.json({ error: 'Player is already in this tournament' }, { status: 409 })

  // Enroll, then rebuild the whole schedule for the new roster. This re-applies already
  // played results and lays out a clean double round-robin — so the newcomer gets games
  // against everyone without double-booking anyone or breaking byes.
  await db.insert(participants).values({ tournamentId, userId })
  await regenerateSchedule(tournamentId, tournament.startedAt)

  // Tally the newcomer's games: catch-up backlog vs games slotted into matchdays.
  const newGames = await db.select({ isCatchUp: games.isCatchUp })
    .from(games)
    .where(and(
      eq(games.tournamentId, tournamentId),
      or(eq(games.homePlayerId, userId), eq(games.awayPlayerId, userId)),
    ))
  const total = newGames.length
  const catchUp = newGames.filter(g => g.isCatchUp).length

  return NextResponse.json({
    ok: true,
    name: user.name,
    totalGames: total,
    catchUpGames: catchUp,
    upcomingGames: total - catchUp,
  })
}
