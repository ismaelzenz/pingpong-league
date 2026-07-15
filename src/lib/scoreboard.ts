import { db } from '@/lib/db'
import { games, participants, users } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { perspective, pointsFor } from '@/lib/gameResult'

export interface ScoreboardEntry {
  userId: number
  name: string
  email: string
  avatarColor: string | null
  points: number
  setsWon: number
  setsLost: number
  victories: number
  losses: number
  gamesPlayed: number
}

export interface ScoreboardPlayer {
  userId: number
  name: string
  email: string
  avatarColor: string | null
}

interface FinishedGame {
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  status: string
}

/**
 * Pure standings computation from a roster + a set of finished games. Kept separate from the DB
 * query so callers (e.g. the display board's rank-movement) can score arbitrary game subsets.
 */
export function buildScoreboard(players: ScoreboardPlayer[], finishedGames: FinishedGame[]): ScoreboardEntry[] {
  const entries: ScoreboardEntry[] = players.map(p => {
    const myGames = finishedGames.filter(
      g => g.homePlayerId === p.userId || g.awayPlayerId === p.userId
    )

    let points = 0, setsWon = 0, setsLost = 0, victories = 0, losses = 0

    for (const g of myGames) {
      const { mySets, oppSets, won } = perspective(g, p.userId)
      setsWon += mySets
      setsLost += oppSets
      if (g.status === 'confirmed') {
        points += pointsFor(mySets, oppSets)
        if (won) victories++
        else losses++
      }
      // forfeited: 0 points, counts as a loss
      if (g.status === 'forfeited') losses++
    }

    return {
      userId: p.userId,
      name: p.name,
      email: p.email,
      avatarColor: p.avatarColor,
      points,
      setsWon,
      setsLost,
      victories,
      losses,
      gamesPlayed: myGames.length,
    }
  })

  // Tiebreakers, in order: points, then victories, then sets won, then fewest sets lost.
  return entries.sort((a, b) =>
    b.points - a.points ||
    b.victories - a.victories ||
    b.setsWon - a.setsWon ||
    a.setsLost - b.setsLost
  )
}

export async function computeScoreboard(tournamentId: number): Promise<ScoreboardEntry[]> {
  const playerList = await db.select({ userId: participants.userId, name: users.name, email: users.email, avatarColor: users.avatarColor })
    .from(participants)
    .leftJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.tournamentId, tournamentId))

  const finishedGames = await db.select().from(games)
    .where(and(
      eq(games.tournamentId, tournamentId),
      inArray(games.status, ['confirmed', 'forfeited'])
    ))

  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!,
    name: p.name!,
    email: p.email!,
    avatarColor: p.avatarColor ?? null,
  }))

  return buildScoreboard(players, finishedGames)
}
