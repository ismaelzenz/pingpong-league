import DisplayBoard from '@/components/display/DisplayBoard'
import type { DisplayData } from '@/lib/display'

// A fully hardcoded board so you can check how /display looks on the office TV BEFORE the real
// season has any data. No database access — safe to open in production. Not linked from the app
// nav; reach it at /display/preview.
export const metadata = { title: 'Display preview' }

const PREVIEW: DisplayData = {
  matchdayNumber: 6,
  leaderboard: [
    { userId: 1, name: 'Nadia', email: '', avatarColor: '#f43f5e', gamesPlayed: 10, victories: 9, losses: 1, setsWon: 20, setsLost: 6, points: 29, rank: 1, movement: 1 },
    { userId: 2, name: 'Marco', email: '', avatarColor: '#0ea5e9', gamesPlayed: 10, victories: 8, losses: 2, setsWon: 18, setsLost: 8, points: 26, rank: 2, movement: -1 },
    { userId: 3, name: 'Priya', email: '', avatarColor: '#8b5cf6', gamesPlayed: 10, victories: 7, losses: 3, setsWon: 17, setsLost: 10, points: 24, rank: 3, movement: 2 },
    { userId: 4, name: 'Lucas', email: '', avatarColor: '#22c55e', gamesPlayed: 10, victories: 7, losses: 3, setsWon: 16, setsLost: 11, points: 23, rank: 4, movement: 0 },
    { userId: 5, name: 'Sofia', email: '', avatarColor: '#eab308', gamesPlayed: 10, victories: 6, losses: 4, setsWon: 15, setsLost: 12, points: 21, rank: 5, movement: -2 },
    { userId: 6, name: 'Daan', email: '', avatarColor: '#ec4899', gamesPlayed: 10, victories: 5, losses: 5, setsWon: 14, setsLost: 14, points: 19, rank: 6, movement: 1 },
    { userId: 7, name: 'Ravi', email: '', avatarColor: '#f97316', gamesPlayed: 10, victories: 5, losses: 5, setsWon: 13, setsLost: 14, points: 18, rank: 7, movement: -1 },
    { userId: 8, name: 'Emma', email: '', avatarColor: '#14b8a6', gamesPlayed: 10, victories: 4, losses: 6, setsWon: 12, setsLost: 15, points: 16, rank: 8, movement: 3 },
    { userId: 9, name: 'Jonas', email: '', avatarColor: '#6366f1', gamesPlayed: 10, victories: 4, losses: 6, setsWon: 11, setsLost: 16, points: 15, rank: 9, movement: 0 },
    { userId: 10, name: 'Yuki', email: '', avatarColor: '#84cc16', gamesPlayed: 10, victories: 3, losses: 7, setsWon: 10, setsLost: 17, points: 13, rank: 10, movement: -1 },
    { userId: 11, name: 'Omar', email: '', avatarColor: '#ef4444', gamesPlayed: 10, victories: 2, losses: 8, setsWon: 8, setsLost: 18, points: 10, rank: 11, movement: 0 },
    { userId: 12, name: 'Lena', email: '', avatarColor: '#a855f7', gamesPlayed: 10, victories: 1, losses: 9, setsWon: 6, setsLost: 20, points: 7, rank: 12, movement: -2 },
  ],
  funWall: {
    onFire: { userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '6 wins in a row' },
    destroyer: { userId: 2, name: 'Marco', avatarColor: '#0ea5e9', value: '9 clean sweeps' },
    bestWinRate: { userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '90% (9/10)' },
    clutch: { userId: 3, name: 'Priya', avatarColor: '#8b5cf6', value: '5 deciders won' },
  },
  weekGames: [
    { id: 1, homePlayerId: 1, awayPlayerId: 12, homeName: 'Nadia', awayName: 'Lena', homeColor: '#f43f5e', awayColor: '#a855f7', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 2, homePlayerId: 2, awayPlayerId: 11, homeName: 'Marco', awayName: 'Omar', homeColor: '#0ea5e9', awayColor: '#ef4444', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 3, homePlayerId: 3, awayPlayerId: 10, homeName: 'Priya', awayName: 'Yuki', homeColor: '#8b5cf6', awayColor: '#84cc16', homeSets: 2, awaySets: 1, status: 'result_entered' },
    { id: 4, homePlayerId: 6, awayPlayerId: 7, homeName: 'Daan', awayName: 'Ravi', homeColor: '#ec4899', awayColor: '#f97316', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 5, homePlayerId: 4, awayPlayerId: 9, homeName: 'Lucas', awayName: 'Jonas', homeColor: '#22c55e', awayColor: '#6366f1', homeSets: null, awaySets: null, status: 'pending' },
    { id: 6, homePlayerId: 5, awayPlayerId: 8, homeName: 'Sofia', awayName: 'Emma', homeColor: '#eab308', awayColor: '#14b8a6', homeSets: null, awaySets: null, status: 'pending' },
  ],
}

export default function DisplayPreviewPage() {
  return <DisplayBoard tournamentName="Zenz Ping Pong League (preview)" data={PREVIEW} />
}
