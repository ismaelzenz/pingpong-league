import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/api'
import { eq, ne } from 'drizzle-orm'
import { afterLeagueChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

// Promote a tournament to "live" — the one players see. Exactly one tournament is live at a
// time, so this clears the flag on every other tournament.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { tournamentId } = json as { tournamentId: number }

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  if (tournament.status === 'finished') {
    return NextResponse.json({ error: 'A finished tournament cannot be made live' }, { status: 400 })
  }

  await db.update(tournaments).set({ isLive: false }).where(ne(tournaments.id, tournamentId))
  await db.update(tournaments).set({ isLive: true }).where(eq(tournaments.id, tournamentId))

  afterLeagueChange()
  return NextResponse.json({ ok: true })
}
