import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/api'
import { eq, and, inArray, lt } from 'drizzle-orm'
import { todayISO } from '@/lib/dates'
import { afterLeagueChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { tournamentId } = json
  const today = todayISO()

  const pastMatchdays = await db.select({ id: matchdays.id })
    .from(matchdays)
    .where(and(eq(matchdays.tournamentId, tournamentId), lt(matchdays.weekEnd, today)))

  if (pastMatchdays.length === 0) {
    return NextResponse.json({ ok: true, forfeited: 0 })
  }

  const ids = pastMatchdays.map(m => m.id)
  // Only forfeit genuinely unplayed games. Postponed games are deliberate catch-ups — leave them.
  const result = await db.update(games)
    .set({ status: 'forfeited', homeSets: 0, awaySets: 0, updatedAt: new Date().toISOString() })
    .where(and(inArray(games.matchdayId, ids), eq(games.status, 'pending')))
    .returning()

  afterLeagueChange()
  return NextResponse.json({ ok: true, forfeited: result.length })
}
