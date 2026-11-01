import { db } from '@/lib/db'
import { games, matchdays, participants, users } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { ScoreboardPlayer } from '@/lib/domain/scoreboard'
import { rankStandings, type StandingRow } from '@/lib/domain/standings'
import { todayISO } from '@/lib/dates'
import { cached } from '@/lib/cache'
import { FINISHED_STATUSES } from '@/lib/domain/gameStatus'

/**
 * Standings plus each player's weekly rank movement and recent form. Used by the scoreboard page
 * and the dashboard; the display board ranks the same way from its own one-pass read.
 */
export function computeStandingsWithMovement(tournamentId: number): Promise<StandingRow[]> {
  // Today is part of the cache key: which matchday is "current" (and so the movement baseline)
  // changes with the date, not just with the data.
  return standingsCached(tournamentId, todayISO())
}

const standingsCached = cached('standingsWithMovement', ['league'], standingsWithMovement)

async function standingsWithMovement(tournamentId: number, today: string): Promise<StandingRow[]> {
  const [playerList, finished, mds] = await Promise.all([
    db.select({ userId: participants.userId, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournamentId)),
    db.select().from(games)
      .where(and(eq(games.tournamentId, tournamentId), inArray(games.status, [...FINISHED_STATUSES]))),
    db.select().from(matchdays).where(eq(matchdays.tournamentId, tournamentId)),
  ])
  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!, name: p.name!, email: p.email!, avatarColor: p.avatarColor ?? null,
  }))
  return rankStandings(players, finished, mds, today)
}
