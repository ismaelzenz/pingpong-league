import type { DisplayData } from '@/lib/data/display'
import type { FormResult, StandingRow } from '@/lib/domain/standings'

/** A plausible last-5 for a preview player, in line with their win rate (deterministic, no random). */
function withForm(r: Omit<StandingRow, 'form'>): StandingRow {
  const rate = r.victories / Math.max(1, r.gamesPlayed)
  const form: FormResult[] = [0, 1, 2, 3, 4].map(i => ((i * 7 + r.userId * 3) % 10) / 10 < rate ? 'W' : 'L')
  return { ...r, form }
}

// Hardcoded board data for the /display/preview pages — no database, safe in production.
// Models a 20-player league mid-season (10 games/matchday): mix of played, awaiting-confirmation,
// postponed and not-yet-played games.
export const PREVIEW: DisplayData = {
  matchdayNumber: 14,
  matchdayWeek: { start: '2026-11-02', end: '2026-11-06', daysLeft: 2 },
  latestResults: [], // filled in below, from the week's games
  leaderboard: ([
    { userId: 1, name: 'Nadia', email: '', avatarColor: '#f43f5e', gamesPlayed: 13, victories: 12, losses: 1, setsWon: 26, setsLost: 8, points: 38, rank: 1, movement: 1 },
    { userId: 2, name: 'Marco', email: '', avatarColor: '#0ea5e9', gamesPlayed: 13, victories: 11, losses: 2, setsWon: 24, setsLost: 10, points: 35, rank: 2, movement: -1 },
    { userId: 3, name: 'Priya', email: '', avatarColor: '#8b5cf6', gamesPlayed: 13, victories: 10, losses: 3, setsWon: 23, setsLost: 12, points: 33, rank: 3, movement: 2 },
    { userId: 4, name: 'Lucas', email: '', avatarColor: '#22c55e', gamesPlayed: 13, victories: 10, losses: 3, setsWon: 22, setsLost: 13, points: 32, rank: 4, movement: 0 },
    { userId: 5, name: 'Sofia', email: '', avatarColor: '#eab308', gamesPlayed: 13, victories: 9, losses: 4, setsWon: 21, setsLost: 14, points: 30, rank: 5, movement: 1 },
    { userId: 6, name: 'Daan', email: '', avatarColor: '#ec4899', gamesPlayed: 13, victories: 8, losses: 5, setsWon: 20, setsLost: 15, points: 28, rank: 6, movement: -2 },
    { userId: 7, name: 'Ravi', email: '', avatarColor: '#f97316', gamesPlayed: 13, victories: 8, losses: 5, setsWon: 19, setsLost: 15, points: 27, rank: 7, movement: 3 },
    { userId: 8, name: 'Emma', email: '', avatarColor: '#14b8a6', gamesPlayed: 13, victories: 7, losses: 6, setsWon: 18, setsLost: 16, points: 25, rank: 8, movement: 0 },
    { userId: 9, name: 'Jonas', email: '', avatarColor: '#6366f1', gamesPlayed: 13, victories: 7, losses: 6, setsWon: 17, setsLost: 17, points: 24, rank: 9, movement: -1 },
    { userId: 10, name: 'Yuki', email: '', avatarColor: '#84cc16', gamesPlayed: 13, victories: 6, losses: 7, setsWon: 16, setsLost: 18, points: 22, rank: 10, movement: 1 },
    { userId: 11, name: 'Omar', email: '', avatarColor: '#ef4444', gamesPlayed: 13, victories: 6, losses: 7, setsWon: 15, setsLost: 18, points: 21, rank: 11, movement: -3 },
    { userId: 12, name: 'Lena', email: '', avatarColor: '#a855f7', gamesPlayed: 13, victories: 5, losses: 8, setsWon: 14, setsLost: 19, points: 19, rank: 12, movement: 0 },
    { userId: 13, name: 'Bruno', email: '', avatarColor: '#10b981', gamesPlayed: 13, victories: 5, losses: 8, setsWon: 13, setsLost: 20, points: 18, rank: 13, movement: 2 },
    { userId: 14, name: 'Carla', email: '', avatarColor: '#3b82f6', gamesPlayed: 13, victories: 4, losses: 9, setsWon: 12, setsLost: 21, points: 16, rank: 14, movement: -1 },
    { userId: 15, name: 'Erik', email: '', avatarColor: '#d946ef', gamesPlayed: 13, victories: 4, losses: 9, setsWon: 11, setsLost: 21, points: 15, rank: 15, movement: 0 },
    { userId: 16, name: 'Fatima', email: '', avatarColor: '#06b6d4', gamesPlayed: 13, victories: 3, losses: 10, setsWon: 10, setsLost: 22, points: 13, rank: 16, movement: 1 },
    { userId: 17, name: 'Gijs', email: '', avatarColor: '#65a30d', gamesPlayed: 13, victories: 3, losses: 10, setsWon: 9, setsLost: 23, points: 12, rank: 17, movement: -2 },
    { userId: 18, name: 'Ines', email: '', avatarColor: '#e11d48', gamesPlayed: 13, victories: 2, losses: 11, setsWon: 8, setsLost: 24, points: 10, rank: 18, movement: 0 },
    { userId: 19, name: 'Klara', email: '', avatarColor: '#7c3aed', gamesPlayed: 13, victories: 1, losses: 12, setsWon: 6, setsLost: 25, points: 8, rank: 19, movement: 1 },
    { userId: 20, name: 'Noah', email: '', avatarColor: '#f59e0b', gamesPlayed: 13, victories: 1, losses: 12, setsWon: 5, setsLost: 26, points: 7, rank: 20, movement: -1 },
    { userId: 21, name: 'Timo', email: '', avatarColor: '#fb7185', gamesPlayed: 13, victories: 1, losses: 12, setsWon: 4, setsLost: 26, points: 6, rank: 21, movement: 1 },
    { userId: 22, name: 'Vera', email: '', avatarColor: '#38bdf8', gamesPlayed: 13, victories: 1, losses: 12, setsWon: 4, setsLost: 27, points: 5, rank: 22, movement: -1 },
    { userId: 23, name: 'Wout', email: '', avatarColor: '#c084fc', gamesPlayed: 12, victories: 0, losses: 12, setsWon: 3, setsLost: 25, points: 4, rank: 23, movement: 0 },
  ] as Omit<StandingRow, 'form'>[]).map(withForm),
  records: [
    { key: 'onFire', userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '8 wins in a row' },
    { key: 'destroyer', userId: 2, name: 'Marco', avatarColor: '#0ea5e9', value: '11 clean sweeps' },
    { key: 'clutch', userId: 3, name: 'Priya', avatarColor: '#8b5cf6', value: '6 deciders won' },
    { key: 'bestWinRate', userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '92% (12/13)' },
    { key: 'theWall', userId: 5, name: 'Sofia', avatarColor: '#eab308', value: '0.7 sets lost/game' },
    { key: 'setMachine', userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '26 sets won' },
    { key: 'nailBiter', userId: 4, name: 'Lucas', avatarColor: '#22c55e', value: '9 deciders played' },
  ],
  // Odd roster (23) → one player rests this matchday.
  byePlayers: [{ userId: 23, name: 'Wout', avatarColor: '#c084fc' }],
  weekGames: [
    { id: 1, homePlayerId: 1, awayPlayerId: 20, homeName: 'Nadia', awayName: 'Noah', homeColor: '#f43f5e', awayColor: '#f59e0b', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 2, homePlayerId: 2, awayPlayerId: 19, homeName: 'Marco', awayName: 'Klara', homeColor: '#0ea5e9', awayColor: '#7c3aed', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 3, homePlayerId: 3, awayPlayerId: 18, homeName: 'Priya', awayName: 'Ines', homeColor: '#8b5cf6', awayColor: '#e11d48', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 4, homePlayerId: 4, awayPlayerId: 17, homeName: 'Lucas', awayName: 'Gijs', homeColor: '#22c55e', awayColor: '#65a30d', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 5, homePlayerId: 5, awayPlayerId: 16, homeName: 'Sofia', awayName: 'Fatima', homeColor: '#eab308', awayColor: '#06b6d4', homeSets: null, awaySets: null, status: 'pending' },
    { id: 6, homePlayerId: 6, awayPlayerId: 15, homeName: 'Daan', awayName: 'Erik', homeColor: '#ec4899', awayColor: '#d946ef', homeSets: null, awaySets: null, status: 'postponed' },
    { id: 7, homePlayerId: 7, awayPlayerId: 14, homeName: 'Ravi', awayName: 'Carla', homeColor: '#f97316', awayColor: '#3b82f6', homeSets: null, awaySets: null, status: 'postponed' },
    { id: 8, homePlayerId: 8, awayPlayerId: 13, homeName: 'Emma', awayName: 'Bruno', homeColor: '#14b8a6', awayColor: '#10b981', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 9, homePlayerId: 9, awayPlayerId: 12, homeName: 'Jonas', awayName: 'Lena', homeColor: '#6366f1', awayColor: '#a855f7', homeSets: null, awaySets: null, status: 'pending' },
    { id: 10, homePlayerId: 10, awayPlayerId: 11, homeName: 'Yuki', awayName: 'Omar', homeColor: '#84cc16', awayColor: '#ef4444', homeSets: null, awaySets: null, status: 'pending' },
    { id: 11, homePlayerId: 21, awayPlayerId: 22, homeName: 'Timo', awayName: 'Vera', homeColor: '#fb7185', awayColor: '#38bdf8', homeSets: 2, awaySets: 1, status: 'confirmed' },
  ],
  // Backlog games owed outside the weekly grid — playable anytime. In a real 22-player season this
  // grows large (most players end up owing a game or two), so the board scrolls them in a marquee.
  catchUpGames: [
    { id: 101, homePlayerId: 23, awayPlayerId: 7, homeName: 'Wout', awayName: 'Ravi', homeColor: '#c084fc', awayColor: '#f97316', homeSets: null, awaySets: null, status: 'pending' },
    { id: 102, homePlayerId: 23, awayPlayerId: 12, homeName: 'Wout', awayName: 'Lena', homeColor: '#c084fc', awayColor: '#a855f7', homeSets: null, awaySets: null, status: 'pending' },
    { id: 103, homePlayerId: 1, awayPlayerId: 21, homeName: 'Nadia', awayName: 'Timo', homeColor: '#f43f5e', awayColor: '#fb7185', homeSets: null, awaySets: null, status: 'pending' },
    { id: 104, homePlayerId: 2, awayPlayerId: 22, homeName: 'Marco', awayName: 'Vera', homeColor: '#0ea5e9', awayColor: '#38bdf8', homeSets: null, awaySets: null, status: 'postponed' },
    { id: 105, homePlayerId: 3, awayPlayerId: 20, homeName: 'Priya', awayName: 'Noah', homeColor: '#8b5cf6', awayColor: '#f59e0b', homeSets: null, awaySets: null, status: 'pending' },
    { id: 106, homePlayerId: 4, awayPlayerId: 19, homeName: 'Lucas', awayName: 'Klara', homeColor: '#22c55e', awayColor: '#7c3aed', homeSets: null, awaySets: null, status: 'pending' },
    { id: 107, homePlayerId: 5, awayPlayerId: 18, homeName: 'Sofia', awayName: 'Ines', homeColor: '#eab308', awayColor: '#e11d48', homeSets: null, awaySets: null, status: 'pending' },
    { id: 108, homePlayerId: 6, awayPlayerId: 17, homeName: 'Daan', awayName: 'Gijs', homeColor: '#ec4899', awayColor: '#65a30d', homeSets: null, awaySets: null, status: 'postponed' },
    { id: 109, homePlayerId: 8, awayPlayerId: 16, homeName: 'Emma', awayName: 'Fatima', homeColor: '#14b8a6', awayColor: '#06b6d4', homeSets: null, awaySets: null, status: 'pending' },
    { id: 110, homePlayerId: 9, awayPlayerId: 15, homeName: 'Jonas', awayName: 'Erik', homeColor: '#6366f1', awayColor: '#d946ef', homeSets: null, awaySets: null, status: 'pending' },
    { id: 111, homePlayerId: 10, awayPlayerId: 14, homeName: 'Yuki', awayName: 'Carla', homeColor: '#84cc16', awayColor: '#3b82f6', homeSets: null, awaySets: null, status: 'pending' },
    { id: 112, homePlayerId: 11, awayPlayerId: 13, homeName: 'Omar', awayName: 'Bruno', homeColor: '#ef4444', awayColor: '#10b981', homeSets: null, awaySets: null, status: 'pending' },
    { id: 113, homePlayerId: 7, awayPlayerId: 16, homeName: 'Ravi', awayName: 'Fatima', homeColor: '#f97316', awayColor: '#06b6d4', homeSets: null, awaySets: null, status: 'pending' },
    { id: 114, homePlayerId: 12, awayPlayerId: 20, homeName: 'Lena', awayName: 'Noah', homeColor: '#a855f7', awayColor: '#f59e0b', homeSets: null, awaySets: null, status: 'pending' },
    { id: 115, homePlayerId: 3, awayPlayerId: 9, homeName: 'Priya', awayName: 'Jonas', homeColor: '#8b5cf6', awayColor: '#6366f1', homeSets: null, awaySets: null, status: 'postponed' },
  ],
}

// The preview's played games this week, so the demo banner has a real result to show — the first
// one, whose row is on the board's first page and can be seen to glow.
PREVIEW.latestResults = PREVIEW.weekGames.filter(g => g.status === 'confirmed')
