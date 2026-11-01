import { cache } from 'react'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Tournament } from '@/lib/db/schema'
import { cached } from '@/lib/cache'

/**
 * The single tournament players see across the app (dashboard, scoreboard, matchdays…).
 *
 * It's the one flagged `isLive` that hasn't finished. Any other non-finished tournament
 * (e.g. an admin's test/bug-repro copy) is deliberately invisible to players until an
 * admin promotes it via the "Set as live" action.
 *
 * Always a fresh read — this is the version for API routes, which act on the answer.
 */
export async function getLiveTournamentFresh(): Promise<Tournament | null> {
  return db.select().from(tournaments)
    .where(and(eq(tournaments.isLive, true), inArray(tournaments.status, ['registration', 'active'])))
    .limit(1)
    .then(r => r[0] ?? null)
}

/**
 * `getLiveTournamentFresh` for pages: cached across requests (every page's layout asks), and
 * wrapped in React's `cache()` so the layout and the page share one lookup per render.
 */
export const getLiveTournament = cache(cached('liveTournament', ['league'], getLiveTournamentFresh))

/**
 * Tournament to show on stats pages (profile, player profiles): the live one if there is
 * one, otherwise the most recently finished season so history stays visible between seasons.
 */
export const getDisplayTournament = cache(async (): Promise<Tournament | null> => {
  const live = await getLiveTournament()
  if (live) return live
  return getLatestFinishedTournament()
})

/** The most recently finished tournament, or null if none has finished yet. */
export const getLatestFinishedTournament = cached('latestFinishedTournament', ['league'], async (): Promise<Tournament | null> =>
  db.select().from(tournaments)
    .where(eq(tournaments.status, 'finished'))
    .orderBy(desc(tournaments.finishedAt), desc(tournaments.createdAt))
    .limit(1)
    .then(r => r[0] ?? null))
