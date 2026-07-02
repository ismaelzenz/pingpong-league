import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { isValid } from 'date-fns'
import { getLiveTournament } from '@/lib/tournament'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, startDate } = await req.json() as { name?: string; startDate?: string }
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Optional first-week date ('yyyy-MM-dd'). Kept null if empty/invalid.
  const cleanStart = startDate && isValid(new Date(startDate)) ? startDate : null

  // The very first non-finished tournament becomes the live one players see; any created
  // while a live tournament already exists start hidden (a test/next-season copy) until an
  // admin promotes them.
  const hasLive = !!(await getLiveTournament())

  const [tournament] = await db.insert(tournaments)
    .values({ name: name.trim(), startDate: cleanStart, isLive: !hasLive })
    .returning()
  return NextResponse.json({ tournament })
}
