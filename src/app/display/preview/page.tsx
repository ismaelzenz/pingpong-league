import DisplayBoard from '@/components/display/DisplayBoard'
import type { DisplayData } from '@/lib/display'

// A fully hardcoded board so you can check how /display looks on the office TV BEFORE the real
// season has any data. No database access — safe to open in production. Not linked from the app
// nav; reach it at /display/preview. Sized for a 20-player league mid-season (10 games/matchday).
export const metadata = { title: 'Display preview' }

const PREVIEW: DisplayData = {
  matchdayNumber: 14,
  leaderboard: [
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
  ],
  funWall: {
    onFire: { userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '8 wins in a row' },
    destroyer: { userId: 2, name: 'Marco', avatarColor: '#0ea5e9', value: '11 clean sweeps' },
    bestWinRate: { userId: 1, name: 'Nadia', avatarColor: '#f43f5e', value: '92% (12/13)' },
    clutch: { userId: 3, name: 'Priya', avatarColor: '#8b5cf6', value: '6 deciders won' },
  },
  weekGames: [
    { id: 1, homePlayerId: 1, awayPlayerId: 20, homeName: 'Nadia', awayName: 'Noah', homeColor: '#f43f5e', awayColor: '#f59e0b', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 2, homePlayerId: 2, awayPlayerId: 19, homeName: 'Marco', awayName: 'Klara', homeColor: '#0ea5e9', awayColor: '#7c3aed', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 3, homePlayerId: 3, awayPlayerId: 18, homeName: 'Priya', awayName: 'Ines', homeColor: '#8b5cf6', awayColor: '#e11d48', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 4, homePlayerId: 4, awayPlayerId: 17, homeName: 'Lucas', awayName: 'Gijs', homeColor: '#22c55e', awayColor: '#65a30d', homeSets: 2, awaySets: 1, status: 'result_entered' },
    { id: 5, homePlayerId: 5, awayPlayerId: 16, homeName: 'Sofia', awayName: 'Fatima', homeColor: '#eab308', awayColor: '#06b6d4', homeSets: null, awaySets: null, status: 'pending' },
    { id: 6, homePlayerId: 6, awayPlayerId: 15, homeName: 'Daan', awayName: 'Erik', homeColor: '#ec4899', awayColor: '#d946ef', homeSets: 2, awaySets: 0, status: 'confirmed' },
    { id: 7, homePlayerId: 7, awayPlayerId: 14, homeName: 'Ravi', awayName: 'Carla', homeColor: '#f97316', awayColor: '#3b82f6', homeSets: null, awaySets: null, status: 'pending' },
    { id: 8, homePlayerId: 8, awayPlayerId: 13, homeName: 'Emma', awayName: 'Bruno', homeColor: '#14b8a6', awayColor: '#10b981', homeSets: 2, awaySets: 1, status: 'confirmed' },
    { id: 9, homePlayerId: 9, awayPlayerId: 12, homeName: 'Jonas', awayName: 'Lena', homeColor: '#6366f1', awayColor: '#a855f7', homeSets: null, awaySets: null, status: 'pending' },
    { id: 10, homePlayerId: 10, awayPlayerId: 11, homeName: 'Yuki', awayName: 'Omar', homeColor: '#84cc16', awayColor: '#ef4444', homeSets: null, awaySets: null, status: 'pending' },
  ],
}

export default function DisplayPreviewPage() {
  return <DisplayBoard tournamentName="Zenz Ping Pong League (preview)" data={PREVIEW} />
}
