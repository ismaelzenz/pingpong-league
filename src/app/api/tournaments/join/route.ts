import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { participants } from '@/lib/db/schema'
import { requireUser } from '@/lib/apiAuth'
import { getLiveTournament } from '@/lib/tournament'
import { and, eq } from 'drizzle-orm'

// Self-serve join: the logged-in user enrolls themselves in the current tournament while
// registration is open. Once the tournament is active, joining is admin-only (adding a player
// mid-season requires rebuilding the schedule for the new roster).
export async function POST() {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const tournament = await getLiveTournament()
  if (!tournament) {
    return NextResponse.json({ error: 'There is no tournament open for registration right now.' }, { status: 404 })
  }
  if (tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Registration is closed — ask an admin to add you.' }, { status: 403 })
  }

  // Idempotent: joining again is a no-op success rather than an error.
  const existing = await db.select().from(participants)
    .where(and(eq(participants.tournamentId, tournament.id), eq(participants.userId, session.userId)))
    .then(r => r[0])
  if (existing) return NextResponse.json({ ok: true, alreadyJoined: true })

  await db.insert(participants).values({ tournamentId: tournament.id, userId: session.userId })
  return NextResponse.json({ ok: true })
}
