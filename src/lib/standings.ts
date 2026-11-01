import { db } from '@/lib/db'
import { games, matchdays, participants, users } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { buildScoreboard, type ScoreboardEntry, type ScoreboardPlayer } from '@/lib/scoreboard'
import { todayISO } from '@/lib/dates'
import { cached } from '@/lib/cache'

export interface StandingRow extends ScoreboardEntry {
  rank: number
  /** Rank change vs before the current matchday: >0 climbed, <0 dropped, 0 same, null unknown. */
  movement: number | null
}

/**
 * Standings plus each player's weekly rank movement — their rank now vs their rank before the
 * current matchday's games were played. Shared by the scoreboard page and the display board.
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
      .where(and(eq(games.tournamentId, tournamentId), inArray(games.status, ['confirmed', 'forfeited']))),
    db.select().from(matchdays).where(eq(matchdays.tournamentId, tournamentId)),
  ])
  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!, name: p.name!, email: p.email!, avatarColor: p.avatarColor ?? null,
  }))

  const current = buildScoreboard(players, finished)

  // Current matchday: the one whose week contains today, else the latest with any finished game.
  let currentMd = mds.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd) ?? null
  if (!currentMd) {
    const withGames = mds.filter(m => finished.some(g => g.matchdayId === m.id))
    currentMd = withGames.sort((a, b) => b.number - a.number)[0] ?? null
  }

  let movement: Map<number, number> | null = null
  if (currentMd) {
    const baseline = buildScoreboard(players, finished.filter(g => g.matchdayId !== currentMd!.id))
    const baseRank = new Map(baseline.map((e, i) => [e.userId, i]))
    movement = new Map(current.map((e, i) => [e.userId, (baseRank.get(e.userId) ?? i) - i]))
  }

  return current.map((e, i) => ({
    ...e, rank: i + 1, movement: movement ? (movement.get(e.userId) ?? 0) : null,
  }))
}
