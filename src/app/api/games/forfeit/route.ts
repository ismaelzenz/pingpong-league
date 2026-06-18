import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq, and, inArray, lt } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tournamentId } = await req.json()
  const today = new Date().toISOString().split('T')[0]

  const pastMatchdays = await db.select({ id: matchdays.id })
    .from(matchdays)
    .where(and(eq(matchdays.tournamentId, tournamentId), lt(matchdays.weekEnd, today)))

  if (pastMatchdays.length === 0) {
    return NextResponse.json({ ok: true, forfeited: 0 })
  }

  const ids = pastMatchdays.map(m => m.id)
  const result = await db.update(games)
    .set({ status: 'forfeited', homeSets: 0, awaySets: 0, updatedAt: new Date().toISOString() })
    .where(and(inArray(games.matchdayId, ids), inArray(games.status, ['pending', 'postponed'])))
    .returning()

  return NextResponse.json({ ok: true, forfeited: result.length })
}
