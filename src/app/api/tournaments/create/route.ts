import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/api'
import { isValid } from 'date-fns'
import { getLiveTournamentFresh } from '@/lib/data/tournaments'
import { afterLeagueChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { name, startDate, countsForElo } = json as
    { name?: string; startDate?: string; countsForElo?: boolean }
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Optional first-week date ('yyyy-MM-dd'). Kept null if empty/invalid.
  const cleanStart = startDate && isValid(new Date(startDate)) ? startDate : null

  // The very first non-finished tournament becomes the live one players see; any created
  // while a live tournament already exists start hidden (a test/next-season copy) until an
  // admin promotes them.
  const hasLive = !!(await getLiveTournamentFresh())

  // Counts toward ELO unless the admin says otherwise — a real season is the common case, and
  // a test copy that silently moved everyone's rating would be much worse than one that doesn't.
  const [tournament] = await db.insert(tournaments)
    .values({
      name: name.trim(),
      startDate: cleanStart,
      isLive: !hasLive,
      countsForElo: countsForElo !== false,
    })
    .returning()
  afterLeagueChange()
  return NextResponse.json({ tournament })
}
