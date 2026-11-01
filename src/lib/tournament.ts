import { cache } from 'react'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Tournament } from '@/lib/db/schema'

/**
 * The single tournament players see across the app (dashboard, scoreboard, matchdays…).
 *
 * It's the one flagged `isLive` that hasn't finished. Any other non-finished tournament
 * (e.g. an admin's test/bug-repro copy) is deliberately invisible to players until an
 * admin promotes it via the "Set as live" action.
 */
// Wrapped in React's `cache()`: the layout and the page both ask for it on every render, and it
// is the same row for both, so one round trip serves the whole request.
export const getLiveTournament = cache(async (): Promise<Tournament | null> => {
  return db.select().from(tournaments)
    .where(and(eq(tournaments.isLive, true), inArray(tournaments.status, ['registration', 'active'])))
    .limit(1)
    .then(r => r[0] ?? null)
})

/**
 * Tournament to show on stats pages (profile, player profiles): the live one if there is
 * one, otherwise the most recently finished season so history stays visible between seasons.
 */
export const getDisplayTournament = cache(async (): Promise<Tournament | null> => {
  const live = await getLiveTournament()
  if (live) return live
  return db.select().from(tournaments)
    .where(eq(tournaments.status, 'finished'))
    .orderBy(desc(tournaments.finishedAt), desc(tournaments.createdAt))
    .limit(1)
    .then(r => r[0] ?? null)
})
