import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tournamentId } = await req.json()
  await db.update(tournaments)
    .set({ status: 'finished', finishedAt: new Date().toISOString() })
    .where(eq(tournaments.id, tournamentId))

  return NextResponse.json({ ok: true })
}
