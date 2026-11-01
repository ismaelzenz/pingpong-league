import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/apiAuth'
import { eq } from 'drizzle-orm'
import { isValid } from 'date-fns'
import { mondayOf } from '@/lib/dates'
import { afterLeagueChange } from '@/lib/cache'

// Set the holiday break weeks (weeks left matchday-free) while registration is open.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { tournamentId, weeks } = await req.json() as { tournamentId: number; weeks: string[] }

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Breaks can only be set while registration is open' }, { status: 400 })
  }

  // Normalise every chosen date to its Monday, dedupe, and sort.
  const mondays = [...new Set(
    (Array.isArray(weeks) ? weeks : [])
      .filter(w => isValid(new Date(w)))
      .map(w => mondayOf(w))
  )].sort()

  await db.update(tournaments).set({ breakWeeks: JSON.stringify(mondays) }).where(eq(tournaments.id, tournamentId))

  afterLeagueChange()
  return NextResponse.json({ ok: true, weeks: mondays })
}
