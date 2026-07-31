// Everything the office wall board (/display) shows, in one query pass: the full standings with
// weekly rank movement, this week's fixtures, and the "fun wall" record tiles. Reuses the shared
// scoreboard scoring so the board never drifts from the real table.

import { db } from '@/lib/db'
import { games, matchdays, participants, users } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { buildScoreboard, type ScoreboardEntry, type ScoreboardPlayer } from '@/lib/scoreboard'
import { perspective } from '@/lib/gameResult'
import { todayISO } from '@/lib/dates'

const MIN_GAMES_FOR_WIN_RATE = 4

export interface LeaderRow extends ScoreboardEntry {
  rank: number
  /** Rank change vs before this matchday: >0 climbed, <0 dropped, 0 same, null if unknown. */
  movement: number | null
}

export interface FunWallEntry {
  userId: number
  name: string
  avatarColor: string | null
  value: string
}

export type RecordKey = 'onFire' | 'destroyer' | 'clutch' | 'bestWinRate' | 'theWall' | 'setMachine' | 'nailBiter'

export interface RecordEntry {
  key: RecordKey
  userId: number
  name: string
  avatarColor: string | null
  value: string
}

export interface WeekGame {
  id: number
  homePlayerId: number
  awayPlayerId: number
  homeName: string
  awayName: string
  homeColor: string | null
  awayColor: string | null
  homeSets: number | null
  awaySets: number | null
  status: string
}

export interface ByePlayer {
  userId: number
  name: string
  avatarColor: string | null
}

export interface DisplayData {
  leaderboard: LeaderRow[]
  /** Fun-wall records (on fire, destroyer, clutch, best win rate, iron man, set machine, nail-biter). */
  records: RecordEntry[]
  matchdayNumber: number | null
  weekGames: WeekGame[]
  /** Participants with no game this matchday (odd roster → one player rests each round). */
  byePlayers: ByePlayer[]
}

export async function computeDisplayData(tournamentId: number): Promise<DisplayData> {
  const playerList = await db.select({ userId: participants.userId, name: users.name, email: users.email, avatarColor: users.avatarColor })
    .from(participants)
    .leftJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.tournamentId, tournamentId))

  const players: ScoreboardPlayer[] = playerList.map(p => ({
    userId: p.userId!, name: p.name!, email: p.email!, avatarColor: p.avatarColor ?? null,
  }))
  const playerById = new Map(players.map(p => [p.userId, p]))

  const allFinished = await db.select().from(games)
    .where(and(eq(games.tournamentId, tournamentId), inArray(games.status, ['confirmed', 'forfeited'])))

  const mds = await db.select().from(matchdays).where(eq(matchdays.tournamentId, tournamentId))

  // Current standings.
  const current = buildScoreboard(players, allFinished)

  // "Current" matchday: the one in progress today, else the latest that has any finished game.
  const today = todayISO()
  let currentMd = mds.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd) ?? null
  if (!currentMd) {
    const withGames = mds.filter(m => allFinished.some(g => g.matchdayId === m.id))
    currentMd = withGames.sort((a, b) => b.number - a.number)[0] ?? null
  }

  // Movement: compare each player's rank now vs before this matchday's games were played.
  let movement: Map<number, number> | null = null
  if (currentMd) {
    const baseline = buildScoreboard(players, allFinished.filter(g => g.matchdayId !== currentMd!.id))
    const baseRank = new Map(baseline.map((e, i) => [e.userId, i]))
    movement = new Map(current.map((e, i) => [e.userId, (baseRank.get(e.userId) ?? i) - i]))
  }

  const leaderboard: LeaderRow[] = current.map((e, i) => ({
    ...e, rank: i + 1, movement: movement ? (movement.get(e.userId) ?? 0) : null,
  }))

  // This week's fixtures (current matchday, excluding catch-up games).
  const weekGames: WeekGame[] = currentMd
    ? (await db.select().from(games).where(and(eq(games.matchdayId, currentMd.id), eq(games.isCatchUp, false))))
        .map(g => ({
          id: g.id,
          homePlayerId: g.homePlayerId,
          awayPlayerId: g.awayPlayerId,
          homeName: playerById.get(g.homePlayerId)?.name ?? '—',
          awayName: playerById.get(g.awayPlayerId)?.name ?? '—',
          homeColor: playerById.get(g.homePlayerId)?.avatarColor ?? null,
          awayColor: playerById.get(g.awayPlayerId)?.avatarColor ?? null,
          homeSets: g.homeSets,
          awaySets: g.awaySets,
          status: g.status,
        }))
    : []

  const records = computeRecords(players, allFinished.filter(g => g.status === 'confirmed'))

  // Bye: participants with no game in the current matchday (odd roster → one player rests).
  const inGame = new Set<number>()
  for (const g of weekGames) { inGame.add(g.homePlayerId); inGame.add(g.awayPlayerId) }
  const byePlayers = currentMd && weekGames.length > 0
    ? players.filter(p => !inGame.has(p.userId)).map(p => ({ userId: p.userId, name: p.name, avatarColor: p.avatarColor }))
    : []

  return { leaderboard, records, matchdayNumber: currentMd?.number ?? null, weekGames, byePlayers }
}

interface ConfirmedGame {
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  status: string
  confirmedAt: string | null
}

type RecordAcc = { twoOh: number; twoOne: number; wins: number; played: number; setsWon: number; setsLost: number; deciders: number }

function computeRecords(players: ScoreboardPlayer[], confirmed: ConfirmedGame[]): RecordEntry[] {
  const acc = new Map<number, RecordAcc>(players.map(p => [p.userId, { twoOh: 0, twoOne: 0, wins: 0, played: 0, setsWon: 0, setsLost: 0, deciders: 0 }]))

  for (const g of confirmed) {
    for (const pid of [g.homePlayerId, g.awayPlayerId]) {
      const s = acc.get(pid)
      if (!s) continue
      const { mySets, oppSets, won } = perspective(g, pid)
      s.played++
      s.setsWon += mySets
      s.setsLost += oppSets
      if (mySets + oppSets === 3) s.deciders++ // went to a decider (2–1), won or lost
      if (won) {
        s.wins++
        if (oppSets === 0) s.twoOh++
        else if (oppSets === 1) s.twoOne++
      }
    }
  }

  // Current win streak: consecutive wins ending at each player's most recent confirmed game.
  const streak = new Map<number, number>()
  for (const p of players) {
    const mine = confirmed
      .filter(g => g.homePlayerId === p.userId || g.awayPlayerId === p.userId)
      .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
    let run = 0
    for (let i = mine.length - 1; i >= 0; i--) {
      if (perspective(mine[i], p.userId).won) run++
      else break
    }
    streak.set(p.userId, run)
  }

  const byId = new Map(players.map(p => [p.userId, p]))
  const records: RecordEntry[] = []
  const add = (key: RecordKey, userId: number, value: string) => {
    const p = byId.get(userId)
    if (p) records.push({ key, userId, name: p.name, avatarColor: p.avatarColor, value })
  }
  const topAcc = (sel: (s: RecordAcc) => number, min: number): { id: number; best: number } => {
    let best = min - 1, id = -1
    for (const [uid, s] of acc) { const v = sel(s); if (v > best) { best = v; id = uid } }
    return { id, best }
  }

  // On fire: longest current streak, only worth showing at 2+.
  {
    let best = 1, id = -1
    for (const [uid, s] of streak) if (s > best) { best = s; id = uid }
    if (id !== -1) add('onFire', id, `${best} wins in a row`)
  }
  { const { id, best } = topAcc(s => s.twoOh, 1); if (id !== -1) add('destroyer', id, `${best} clean sweep${best !== 1 ? 's' : ''}`) }
  { const { id, best } = topAcc(s => s.twoOne, 1); if (id !== -1) add('clutch', id, `${best} deciders won`) }
  // Best win rate among players with enough games.
  {
    let bestRate = -1, bestPlayed = -1, id = -1
    for (const [uid, s] of acc) {
      if (s.played < MIN_GAMES_FOR_WIN_RATE) continue
      const rate = s.wins / s.played
      if (rate > bestRate || (rate === bestRate && s.played > bestPlayed)) { bestRate = rate; bestPlayed = s.played; id = uid }
    }
    if (id !== -1) { const s = acc.get(id)!; add('bestWinRate', id, `${Math.round(bestRate * 100)}% (${s.wins}/${s.played})`) }
  }
  // The Wall: best defence — fewest sets lost per game (min games, so early flukes don't win it).
  {
    let bestAvg = Infinity, id = -1
    for (const [uid, s] of acc) {
      if (s.played < MIN_GAMES_FOR_WIN_RATE) continue
      const avg = s.setsLost / s.played
      if (avg < bestAvg) { bestAvg = avg; id = uid }
    }
    if (id !== -1) add('theWall', id, `${bestAvg.toFixed(1)} sets lost/game`)
  }
  { const { id, best } = topAcc(s => s.setsWon, 1); if (id !== -1) add('setMachine', id, `${best} sets won`) }
  { const { id, best } = topAcc(s => s.deciders, 1); if (id !== -1) add('nailBiter', id, `${best} deciders played`) }

  return records
}
