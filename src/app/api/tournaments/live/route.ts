import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq, ne } from 'drizzle-orm'

// Promote a tournament to "live" — the one players see. Exactly one tournament is live at a
// time, so this clears the flag on every other tournament.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tournamentId } = await req.json() as { tournamentId: number }

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status === 'finished') {
    return NextResponse.json({ error: 'A finished tournament cannot be made live' }, { status: 400 })
  }

  await db.update(tournaments).set({ isLive: false }).where(ne(tournaments.id, tournamentId))
  await db.update(tournaments).set({ isLive: true }).where(eq(tournaments.id, tournamentId))

  return NextResponse.json({ ok: true })
}
