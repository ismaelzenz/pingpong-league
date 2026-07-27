import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/apiAuth'
import { eq } from 'drizzle-orm'
import { regenerateSchedule } from '@/lib/regenerateSchedule'
import { sendPush } from '@/lib/push'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { tournamentId } = await req.json()

  const pList = await db.select().from(participants).where(eq(participants.tournamentId, tournamentId))
  if (pList.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 participants' }, { status: 400 })
  }

  // Mark tournament active, then build the schedule (skipping any holiday break weeks).
  const startedAt = new Date().toISOString()
  await db.update(tournaments).set({ status: 'active', startedAt }).where(eq(tournaments.id, tournamentId))

  const result = await regenerateSchedule(tournamentId, startedAt)

  // Let every registered player know the tournament is officially underway. This is a one-off,
  // always-on notification (not user-configurable), so it bypasses per-type preferences.
  const tournament = await db.select({ name: tournaments.name }).from(tournaments)
    .where(eq(tournaments.id, tournamentId)).then(r => r[0])
  // Fire the "tournament started" pushes after the response so starting doesn't block on
  // delivering to every participant.
  after(() => Promise.all(pList.map(p => sendPush(p.userId, {
    title: '🏓 The tournament has started!',
    body: `${tournament?.name ?? 'Your tournament'} is officially underway — check your first matchday and get playing.`,
    url: '/my-games',
  }, 'tournamentStarted'))))

  return NextResponse.json({ ok: true, matchdays: result.matchdays })
}
