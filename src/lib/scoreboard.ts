import { db } from '@/lib/db'
import { games, participants, users } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

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

  const entries: ScoreboardEntry[] = playerList.map(p => {
    const myGames = finishedGames.filter(
      g => g.homePlayerId === p.userId || g.awayPlayerId === p.userId
    )

    let points = 0, setsWon = 0, setsLost = 0, victories = 0, losses = 0

    for (const g of myGames) {
      const isHome = g.homePlayerId === p.userId
      const mySets = isHome ? (g.homeSets ?? 0) : (g.awaySets ?? 0)
      const oppSets = isHome ? (g.awaySets ?? 0) : (g.homeSets ?? 0)
      setsWon += mySets
      setsLost += oppSets
      if (g.status === 'confirmed') {
        points += mySets + (mySets > oppSets ? 1 : 0)
        if (mySets > oppSets) victories++
        else losses++
      }
      // forfeited: 0 points, counts as a loss
      if (g.status === 'forfeited') losses++
    }

    return {
      userId: p.userId!,
      name: p.name!,
      email: p.email!,
      avatarColor: p.avatarColor ?? null,
      points,
      setsWon,
      setsLost,
      victories,
      losses,
      gamesPlayed: myGames.length,
    }
  })

  return entries.sort((a, b) =>
    b.points - a.points ||
    b.setsWon - a.setsWon ||
    b.victories - a.victories
  )
}
