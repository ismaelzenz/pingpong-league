import { db } from '@/lib/db'
import { games, matchdays } from '@/lib/db/schema'
import { and, eq, lt, inArray } from 'drizzle-orm'

/**
 * Auto-confirm results left "awaiting confirmation" in matchdays that have already ended. Once the
 * league has moved on to a new matchday, a forgotten confirmation shouldn't keep a played result
 * out of the standings — so any `result_entered` game whose matchday's week is now in the past is
 * treated as confirmed. Idempotent: already-confirmed games never match again. Returns the count.
 */
export async function autoConfirmEndedMatchdays(tournamentId: number, today: string): Promise<number> {
  const endedMds = await db.select({ id: matchdays.id }).from(matchdays)
    .where(and(eq(matchdays.tournamentId, tournamentId), lt(matchdays.weekEnd, today)))
  const ids = endedMds.map(m => m.id)
  if (ids.length === 0) return 0

  const now = new Date().toISOString()
  const updated = await db.update(games).set({
    status: 'confirmed',
    // No confirmedBy — a null confirmer marks this as a system auto-confirmation.
    confirmedAt: now,
    updatedAt: now,
  }).where(and(inArray(games.matchdayId, ids), eq(games.status, 'result_entered')))
    .returning({ id: games.id })

  return updated.length
}
