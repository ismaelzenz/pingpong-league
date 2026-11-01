import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments, participants, matchdays, games } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/apiAuth'
import { eq } from 'drizzle-orm'
import { isValid } from 'date-fns'
import { rebuildEloLedger } from '@/lib/eloLedger'
import { afterLeagueChange } from '@/lib/cache'

// Edit tournament settings while registration is open — plus the ELO switch, which can be changed
// at any point in a season's life.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const tournamentId = parseInt(id)
  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    startDate?: string | null
    countsForElo?: boolean
    /** Only when switching ELO on: 'all' rates the games already played, 'future' starts from now. */
    includePlayed?: 'all' | 'future'
  }

  // ── The ELO switch ──────────────────────────────────────────────────────────────────────────
  // Unlike the start date, this stays editable for a tournament's whole life: an admin may only
  // realise partway through a season that it should (or shouldn't) count.
  if (typeof body.countsForElo === 'boolean') {
    const turningOn = body.countsForElo && !tournament.countsForElo
    // Switching on midway is the case that needs a decision: rate what's already been played, or
    // start from here. Recorded as a cutoff so it survives every future rebuild — a rebuild replays
    // from the games themselves, so "we skipped those" has to live in the data, not in the moment.
    const eloCountsFrom = !body.countsForElo
      ? null
      : turningOn && body.includePlayed === 'future'
        ? new Date().toISOString()
        : null

    await db.update(tournaments)
      .set({ countsForElo: body.countsForElo, eloCountsFrom })
      .where(eq(tournaments.id, tournamentId))

    // Ratings are chained, and this changes which games are in the chain at all, so replay.
    const { games: rated } = await rebuildEloLedger()
    afterLeagueChange()
    return NextResponse.json({ ok: true, countsForElo: body.countsForElo, eloCountsFrom, ratedGames: rated })
  }

  // ── Start date ──────────────────────────────────────────────────────────────────────────────
  if (tournament.status !== 'registration') {
    return NextResponse.json({ error: 'Start date can only be changed while registration is open' }, { status: 400 })
  }
  const startDate = body.startDate && isValid(new Date(body.startDate)) ? body.startDate : null
  await db.update(tournaments).set({ startDate }).where(eq(tournaments.id, tournamentId))

  afterLeagueChange()
  return NextResponse.json({ ok: true, startDate })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const tournamentId = parseInt(id)

  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0])
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tournament.status === 'active') {
    return NextResponse.json({ error: 'Cannot delete an active tournament — end it first' }, { status: 400 })
  }

  // Cascade delete in order: games → matchdays → participants → tournament
  const tournamentMatchdays = await db.select({ id: matchdays.id }).from(matchdays).where(eq(matchdays.tournamentId, tournamentId))
  for (const md of tournamentMatchdays) {
    await db.delete(games).where(eq(games.matchdayId, md.id))
  }
  await db.delete(matchdays).where(eq(matchdays.tournamentId, tournamentId))
  await db.delete(participants).where(eq(participants.tournamentId, tournamentId))
  await db.delete(tournaments).where(eq(tournaments.id, tournamentId))

  afterLeagueChange()
  return NextResponse.json({ ok: true })
}
