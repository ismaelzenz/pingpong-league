import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { matchdays, games } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

const HAS_RESULT = ['confirmed', 'forfeited', 'result_entered']

/**
 * Reorder the games of a future matchday. Games are displayed in id order, so to reorder
 * without a sort column we reassign each game's (home, away) pair to the id-sorted slots
 * in the requested sequence. Safe because future-matchday games have no results.
 */
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

  const { order } = await req.json() as { order: number[] }
  const dayGames = await db.select().from(games).where(eq(games.matchdayId, matchdayId)).orderBy(games.id)

  if (dayGames.some(g => HAS_RESULT.includes(g.status))) {
    return NextResponse.json({ error: 'Cannot reorder a matchday that has results' }, { status: 400 })
  }
  const idSet = new Set(dayGames.map(g => g.id))
  if (!Array.isArray(order) || order.length !== dayGames.length || !order.every(gid => idSet.has(gid))) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }

  const byId = new Map(dayGames.map(g => [g.id, g]))
  const desired = order.map(gid => byId.get(gid)!)
  const slots = [...dayGames].sort((a, b) => a.id - b.id)

  for (let i = 0; i < slots.length; i++) {
    const want = desired[i]
    const slot = slots[i]
    if (slot.homePlayerId !== want.homePlayerId || slot.awayPlayerId !== want.awayPlayerId) {
      await db.update(games).set({
        homePlayerId: want.homePlayerId,
        awayPlayerId: want.awayPlayerId,
        status: want.status,
        updatedAt: new Date().toISOString(),
      }).where(eq(games.id, slot.id))
    }
  }

  return NextResponse.json({ ok: true })
}
