import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { startOfWeek, format, isValid } from 'date-fns'

// Set the holiday break weeks (weeks left matchday-free) while registration is open.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { tournamentId, weeks } = await req.json() as { tournamentId: number; weeks: string[] }

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Breaks can only be set while registration is open' }, { status: 400 })
  }

  // Normalise every chosen date to its Monday, dedupe, and sort.
  const mondays = [...new Set(
    (Array.isArray(weeks) ? weeks : [])
      .map(w => new Date(w))
      .filter(d => isValid(d))
      .map(d => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  )].sort()

  await db.update(tournaments).set({ breakWeeks: JSON.stringify(mondays) }).where(eq(tournaments.id, tournamentId))

  return NextResponse.json({ ok: true, weeks: mondays })
}
