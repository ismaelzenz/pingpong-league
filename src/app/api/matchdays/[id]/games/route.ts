import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matchdays, games, participants } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

// Admin adds a game to a not-yet-started matchday.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const matchdayId = parseInt(id)
  const matchday = await db.select().from(matchdays).where(eq(matchdays.id, matchdayId)).then(r => r[0])
  if (!matchday) return NextResponse.json({ error: 'Matchday not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  if (!matchday.weekStart || matchday.weekStart <= today) {
    return NextResponse.json({ error: 'Can only edit future matchdays' }, { status: 400 })
  }

  const body = await req.json()
  const homePlayerId = Number(body.homePlayerId)
  const awayPlayerId = Number(body.awayPlayerId)
  if (!homePlayerId || !awayPlayerId || homePlayerId === awayPlayerId) {
    return NextResponse.json({ error: 'Pick two different players' }, { status: 400 })
  }

  const enrolled = await db.select({ userId: participants.userId }).from(participants)
    .where(eq(participants.tournamentId, matchday.tournamentId))
  const ids = new Set(enrolled.map(p => p.userId))
  if (!ids.has(homePlayerId) || !ids.has(awayPlayerId)) {
    return NextResponse.json({ error: 'Both players must be in this tournament' }, { status: 400 })
  }

  await db.insert(games).values({
    matchdayId,
    tournamentId: matchday.tournamentId,
    homePlayerId,
    awayPlayerId,
    status: 'pending',
  })

  return NextResponse.json({ ok: true })
}
