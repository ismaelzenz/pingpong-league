import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants, tournaments, matchdays, games, users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { distributeNewPlayerGames } from '@/lib/schedule'

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

  // Everyone already in the tournament becomes an opponent of the newcomer.
  const opponents = await db.select({ userId: participants.userId }).from(participants)
    .where(eq(participants.tournamentId, tournamentId))
  const opponentIds = opponents.map(o => o.userId)

  const tournamentMatchdays = await db.select({ id: matchdays.id, weekStart: matchdays.weekStart, number: matchdays.number })
    .from(matchdays)
    .where(eq(matchdays.tournamentId, tournamentId))
    .orderBy(matchdays.number)

  if (tournamentMatchdays.length === 0) {
    return NextResponse.json({ error: 'Tournament has no matchdays to schedule into' }, { status: 400 })
  }

  // Enroll, then graft the new player's double round-robin games onto existing matchdays.
  await db.insert(participants).values({ tournamentId, userId })

  const distributed = distributeNewPlayerGames(userId, opponentIds, tournamentMatchdays.map(m => m.id))

  if (distributed.length > 0) {
    await db.insert(games).values(distributed.map(g => ({
      matchdayId: g.matchdayId,
      tournamentId,
      homePlayerId: g.home,
      awayPlayerId: g.away,
    })))
  }

  // Count how many landed in already-started matchdays — those are catch-up games.
  const today = new Date().toISOString().split('T')[0]
  const startedMatchdayIds = new Set(
    tournamentMatchdays.filter(m => !m.weekStart || m.weekStart <= today).map(m => m.id)
  )
  const catchUp = distributed.filter(g => startedMatchdayIds.has(g.matchdayId)).length

  return NextResponse.json({
    ok: true,
    name: user.name,
    totalGames: distributed.length,
    catchUpGames: catchUp,
    upcomingGames: distributed.length - catchUp,
  })
}
