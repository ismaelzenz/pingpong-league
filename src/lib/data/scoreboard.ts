import { db } from '@/lib/db'
import { games, participants, users } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { cached } from '@/lib/cache'
import { FINISHED_STATUSES } from '@/lib/domain/gameStatus'
import { buildScoreboard, type ScoreboardEntry, type ScoreboardPlayer } from '@/lib/domain/scoreboard'

/** A tournament's league table, computed from its finished games. Cached; see lib/cache.ts. */
export const computeScoreboard = cached('scoreboard', ['league'], scoreboard)

async function scoreboard(tournamentId: number): Promise<ScoreboardEntry[]> {
  const [playerList, finishedGames] = await Promise.all([
    db.select({ userId: participants.userId, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournamentId)),
    db.select().from(games)
      .where(and(
        eq(games.tournamentId, tournamentId),
        inArray(games.status, [...FINISHED_STATUSES])
      )),
  ])

  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!,
    name: p.name!,
    email: p.email!,
    avatarColor: p.avatarColor ?? null,
  }))

  return buildScoreboard(players, finishedGames)
}
