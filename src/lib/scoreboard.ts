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
  /** Games lost by forfeit (a subset of `losses`). A forfeit already counts as a 0–2 loss in the
   *  set totals; this extra count lets ranking push a no-show BELOW an actual played loss. Optional
   *  so hardcoded/preview entries don't have to set it (treated as 0). */
  forfeits?: number
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

    let points = 0, setsWon = 0, setsLost = 0, victories = 0, losses = 0, forfeits = 0

    for (const g of myGames) {
      // A forfeit reads as a 0–2 loss here (see perspective), so it dents set difference.
      const { mySets, oppSets, won } = perspective(g, p.userId)
      setsWon += mySets
      setsLost += oppSets
      if (g.status === 'confirmed') {
        points += pointsFor(mySets, oppSets)
        if (won) victories++
        else losses++
      }
      // forfeited: 0 points, counts as a loss — and tracked separately so a no-show ranks below
      // someone who actually played and lost.
      if (g.status === 'forfeited') { losses++; forfeits++ }
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
      forfeits,
    }
  })

  // Ranking order, each step only breaking ties left by the previous one:
  //   1. Points (more is better) — the league table's whole point.
  //   2. Has played — anyone who's played a game outranks anyone who hasn't yet. Without this a
  //      player sitting on 0 games (and so 0 set difference) would float above someone who played
  //      and lost. Only ever matters at 0 points, since any points at all imply a game was played.
  //   3. Victories — more match wins.
  //   4. Fewer forfeits — a forfeit is a no-show, so it ranks below an actual played loss. This is
  //      BEFORE set difference on purpose: a forfeit already counts as a 0–2 loss, but that alone
  //      would let a single no-show (−2) outrank someone who showed up twice and lost (−4). Ranking
  //      the forfeiter lower here makes "played and lost" always beat "didn't show up".
  //   5. Set difference (sets won − sets lost) — a better margin across all games.
  //   6. Sets won — reward the more aggressive record when the margin is equal.
  //   7. Name (A→Z), then id — a stable, deterministic order for genuine dead heats.
  const hasPlayed = (e: ScoreboardEntry) => (e.gamesPlayed > 0 ? 1 : 0)
  const setDiff = (e: ScoreboardEntry) => e.setsWon - e.setsLost
  return entries.sort((a, b) =>
    b.points - a.points ||
    hasPlayed(b) - hasPlayed(a) ||
    b.victories - a.victories ||
    (a.forfeits ?? 0) - (b.forfeits ?? 0) ||
    setDiff(b) - setDiff(a) ||
    b.setsWon - a.setsWon ||
    a.name.localeCompare(b.name) ||
    a.userId - b.userId
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
