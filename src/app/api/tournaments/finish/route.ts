import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/api'
import { eq } from 'drizzle-orm'
import { afterLeagueChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { tournamentId } = json
  // Finished tournaments are never live — players fall back to "no active tournament"
  // until an admin promotes another one.
  await db.update(tournaments)
    .set({ status: 'finished', finishedAt: new Date().toISOString(), isLive: false })
    .where(eq(tournaments.id, tournamentId))

  afterLeagueChange()
  return NextResponse.json({ ok: true })
}
