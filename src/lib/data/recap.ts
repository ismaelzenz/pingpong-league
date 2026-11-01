// End-of-season recap: champion, podium, season awards, league totals and per-player streaks
// for a FINISHED tournament. Reuses the shared scoreboard scoring so the recap matches the table.

import { cache } from 'react'
import { db } from '@/lib/db'
import { games, matchdays, participants, tournaments, users } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { buildScoreboard, type ScoreboardEntry, type ScoreboardPlayer } from '@/lib/domain/scoreboard'
import { perspective } from '@/lib/domain/gameResult'
import { cached } from '@/lib/cache'
import { FINISHED_STATUSES } from '@/lib/domain/gameStatus'

export interface RecapAward {
  userId: number
  name: string
  avatarColor: string | null
  value: string
}

export interface RecapStanding extends ScoreboardEntry {
  rank: number
}

/** One opponent from a player's perspective (wins/losses are the player's, vs this opponent). */
export interface HeadToHead {
  opponentId: number
  name: string
  avatarColor: string | null
  wins: number
  losses: number
}

/** Extra per-player detail for the personal "Your season" card. */
export interface PersonalRecap {
  cleanSweeps: number   // 2–0 wins
  decidersWon: number   // 2–1 wins
  favorite: HeadToHead | null // opponent you beat the most
  nemesis: HeadToHead | null  // opponent who beat you the most
}

export interface RecapData {
  tournament: { id: number; name: string }
  standings: RecapStanding[]
  champion: RecapStanding | null
  podium: RecapStanding[]
  awards: {
    onFire: RecapAward | null       // longest win streak
    destroyer: RecapAward | null    // most 2–0 wins
    clutch: RecapAward | null       // most 2–1 wins
    bestWinRate: RecapAward | null
    theWall: RecapAward | null      // best defence — fewest sets lost per game
    setMachine: RecapAward | null   // most sets won
    mostImproved: RecapAward | null // biggest rank climb mid-season → final
    nailBiter: RecapAward | null    // most 2–1 games played (won or lost)
  }
  totals: {
    games: number      // confirmed games
    sets: number       // total sets played
    straightSets: number // 2–0 results
    deciders: number   // 2–1 results
    forfeits: number
  }
  /** Longest win streak per user (for the personal "Your season" card). */
  bestStreakByUser: Record<number, number>
  /** Extra per-user detail (sweeps, deciders, head-to-head) for the "Your season" card. */
  personalByUser: Record<number, PersonalRecap>
}

const MIN_GAMES_FOR_WIN_RATE = 3

export { getLatestFinishedTournament } from '@/lib/data/tournaments'

/** All finished tournaments, most recently finished first (for the "Past seasons" list). */
export const getFinishedTournaments = cached('finishedTournaments', ['league'], async () =>
  db.select().from(tournaments)
    .where(eq(tournaments.status, 'finished'))
    .orderBy(desc(tournaments.finishedAt), desc(tournaments.createdAt)))

/** A specific tournament, but only if it has finished; null otherwise (so recaps stay finished-only). */
// Also request-cached: the recap page's `generateMetadata` and the page itself both look it up.
export const getFinishedTournamentById = cache(cached('finishedTournamentById', ['league'], async (id: number) =>
  db.select().from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.status, 'finished')))
    .limit(1)
    .then(r => r[0] ?? null)))

/**
 * The season recap. Cached: a finished season's recap only changes if an admin edits its results
 * afterwards, and the dashboard shows the last champion between seasons.
 */
export const computeRecap = cached('recap', ['league'], recap)

async function recap(tournamentId: number, tournamentName: string): Promise<RecapData> {
  const [playerList, finished, mds] = await Promise.all([
    db.select({ userId: participants.userId, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournamentId)),
    db.select().from(games)
      .where(and(eq(games.tournamentId, tournamentId), inArray(games.status, [...FINISHED_STATUSES]))),
    db.select({ id: matchdays.id, number: matchdays.number }).from(matchdays)
      .where(eq(matchdays.tournamentId, tournamentId)),
  ])
  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!, name: p.name!, email: p.email!, avatarColor: p.avatarColor ?? null,
  }))
  const byId = new Map(players.map(p => [p.userId, p]))

  const confirmed = finished.filter(g => g.status === 'confirmed')

  const sorted = buildScoreboard(players, finished)
  const standings: RecapStanding[] = sorted.map((e, i) => ({ ...e, rank: i + 1 }))

  // ── Per-player counts for awards + head-to-head (confirmed games only) ──────────────────
  const acc = new Map(players.map(p => [p.userId, { twoOh: 0, twoOne: 0, deciders: 0 }]))
  // h2h[playerId][opponentId] = the player's record vs that opponent.
  const h2h = new Map(players.map(p => [p.userId, new Map<number, { wins: number; losses: number }>()]))
  for (const g of confirmed) {
    const wentToDecider = (g.homeSets ?? 0) + (g.awaySets ?? 0) === 3
    for (const pid of [g.homePlayerId, g.awayPlayerId]) {
      const s = acc.get(pid)
      if (!s) continue
      const { oppSets, won } = perspective(g, pid)
      if (won) { if (oppSets === 0) s.twoOh++; else if (oppSets === 1) s.twoOne++ }
      if (wentToDecider) s.deciders++

      const oppId = pid === g.homePlayerId ? g.awayPlayerId : g.homePlayerId
      const mine = h2h.get(pid)
      if (!mine || !byId.has(oppId)) continue
      const rec = mine.get(oppId) ?? { wins: 0, losses: 0 }
      if (won) rec.wins++; else rec.losses++
      mine.set(oppId, rec)
    }
  }

  // Longest win streak per player (confirmed games, chronological).
  const bestStreakByUser: Record<number, number> = {}
  for (const p of players) {
    const mine = confirmed
      .filter(g => g.homePlayerId === p.userId || g.awayPlayerId === p.userId)
      .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
    let run = 0, best = 0
    for (const g of mine) {
      if (perspective(g, p.userId).won) { run++; best = Math.max(best, run) } else run = 0
    }
    bestStreakByUser[p.userId] = best
  }

  const mk = (userId: number, value: string): RecapAward | null => {
    const p = byId.get(userId)
    return p ? { userId, name: p.name, avatarColor: p.avatarColor, value } : null
  }
  const topBy = <T>(items: T[], score: (t: T) => number, min: number, id: (t: T) => number, fmt: (n: number) => string): RecapAward | null => {
    let best = min - 1, bestId = -1
    for (const it of items) { const v = score(it); if (v > best) { best = v; bestId = id(it) } }
    return bestId === -1 ? null : mk(bestId, fmt(best))
  }

  const accList = [...acc.entries()].map(([userId, s]) => ({ userId, ...s }))

  // ── Most improved: rank climb from mid-season to final ─────────────────────────────────
  const maxNumber = mds.reduce((m, x) => Math.max(m, x.number), 0)
  const midNumber = Math.floor(maxNumber / 2)
  const midMatchdayIds = new Set(mds.filter(m => m.number <= midNumber).map(m => m.id))
  let mostImproved: RecapAward | null = null
  if (midNumber >= 1) {
    const midStandings = buildScoreboard(players, finished.filter(g => midMatchdayIds.has(g.matchdayId)))
    const midRank = new Map(midStandings.map((e, i) => [e.userId, i]))
    let bestClimb = 0, climbId = -1
    for (const s of standings) {
      const climb = (midRank.get(s.userId) ?? (s.rank - 1)) - (s.rank - 1)
      if (climb > bestClimb) { bestClimb = climb; climbId = s.userId }
    }
    if (climbId !== -1) mostImproved = mk(climbId, `+${bestClimb} place${bestClimb !== 1 ? 's' : ''} since mid-season`)
  }

  // ── Best win rate (min games) ───────────────────────────────────────────────────────────
  let bestWinRate: RecapAward | null = null
  {
    const cand = standings
      .filter(s => s.gamesPlayed >= MIN_GAMES_FOR_WIN_RATE)
      .sort((a, b) => (b.victories / b.gamesPlayed) - (a.victories / a.gamesPlayed) || b.gamesPlayed - a.gamesPlayed)[0]
    if (cand) bestWinRate = mk(cand.userId, `${Math.round((cand.victories / cand.gamesPlayed) * 100)}% (${cand.victories}/${cand.gamesPlayed})`)
  }

  // ── The Wall: best defence — fewest sets lost per game (min games) ──────────────────────────
  let theWall: RecapAward | null = null
  {
    const cand = standings
      .filter(s => s.gamesPlayed >= MIN_GAMES_FOR_WIN_RATE)
      .sort((a, b) => (a.setsLost / a.gamesPlayed) - (b.setsLost / b.gamesPlayed))[0]
    if (cand) theWall = mk(cand.userId, `${(cand.setsLost / cand.gamesPlayed).toFixed(1)} sets lost/game`)
  }

  // ── League totals ───────────────────────────────────────────────────────────────────────
  let sets = 0, straightSets = 0, deciders = 0
  for (const g of confirmed) {
    const h = g.homeSets ?? 0, a = g.awaySets ?? 0
    sets += h + a
    if (h + a === 2) straightSets++
    else if (h + a === 3) deciders++
  }

  // ── Personal detail per player: sweeps, deciders, favourite opponent & nemesis ──────────
  const personalByUser: Record<number, PersonalRecap> = {}
  for (const p of players) {
    const s = acc.get(p.userId) ?? { twoOh: 0, twoOne: 0, deciders: 0 }
    let favorite: HeadToHead | null = null
    let nemesis: HeadToHead | null = null
    for (const [oppId, rec] of h2h.get(p.userId) ?? []) {
      const opp = byId.get(oppId)
      if (!opp) continue
      const h: HeadToHead = { opponentId: oppId, name: opp.name, avatarColor: opp.avatarColor, wins: rec.wins, losses: rec.losses }
      // Favourite: most wins (break ties by fewest losses). Nemesis: most losses (fewest wins).
      if (rec.wins > 0 && (!favorite || rec.wins > favorite.wins || (rec.wins === favorite.wins && rec.losses < favorite.losses))) favorite = h
      if (rec.losses > 0 && (!nemesis || rec.losses > nemesis.losses || (rec.losses === nemesis.losses && rec.wins < nemesis.wins))) nemesis = h
    }
    personalByUser[p.userId] = { cleanSweeps: s.twoOh, decidersWon: s.twoOne, favorite, nemesis }
  }

  return {
    tournament: { id: tournamentId, name: tournamentName },
    standings,
    champion: standings[0] ?? null,
    podium: standings.slice(0, 3),
    awards: {
      onFire: topBy(players, p => bestStreakByUser[p.userId] ?? 0, 2, p => p.userId, n => `${n} wins in a row`),
      destroyer: topBy(accList, s => s.twoOh, 1, s => s.userId, n => `${n} clean sweep${n !== 1 ? 's' : ''}`),
      clutch: topBy(accList, s => s.twoOne, 1, s => s.userId, n => `${n} deciders won`),
      bestWinRate,
      theWall,
      setMachine: topBy(standings, s => s.setsWon, 1, s => s.userId, n => `${n} sets won`),
      mostImproved,
      nailBiter: topBy(accList, s => s.deciders, 1, s => s.userId, n => `${n} deciders played (2–1)`),
    },
    totals: {
      games: confirmed.length,
      sets,
      straightSets,
      deciders,
      forfeits: finished.length - confirmed.length,
    },
    bestStreakByUser,
    personalByUser,
  }
}
