import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays } from '@/lib/db/schema'
import { eq, inArray, or, and } from 'drizzle-orm'
import { computeScoreboard } from '@/lib/scoreboard'
import { getDisplayTournament } from '@/lib/tournament'
import { computePlayerForm } from '@/lib/playerStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import ProfileEditForm from '@/components/ProfileEditForm'
import ProfileColorForm from '@/components/ProfileColorForm'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import NotificationToggle from '@/components/NotificationToggle'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const tournament = await getDisplayTournament()

  const scores = tournament ? await computeScoreboard(tournament.id) : []
  const myStats = scores.find(s => s.userId === session.userId)

  const recentGames = tournament
    ? await db.select().from(games)
        .where(and(
          eq(games.tournamentId, tournament.id),
          or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
          inArray(games.status, ['confirmed', 'forfeited'])
        ))
        .orderBy(games.confirmedAt)
        .limit(10)
    : []

  // All finished games (oldest → newest) for accurate form/streak stats.
  const allFinishedGames = tournament
    ? await db.select().from(games)
        .where(and(
          eq(games.tournamentId, tournament.id),
          or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
          inArray(games.status, ['confirmed', 'forfeited'])
        ))
        .orderBy(games.confirmedAt)
    : []
  const myForm = computePlayerForm(allFinishedGames, session.userId)

  const opponentIds = [...new Set(recentGames.map(g =>
    g.homePlayerId === session.userId ? g.awayPlayerId : g.homePlayerId
  ))]
  const opponents = opponentIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users)
        .where(inArray(users.id, opponentIds))
    : []
  const opponentMap = Object.fromEntries(opponents.map(o => [o.id, o.name]))

  const matchdayNums: Record<number, number> = {}
  for (const g of recentGames) {
    if (!matchdayNums[g.matchdayId]) {
      const md = await db.select({ number: matchdays.number }).from(matchdays).where(eq(matchdays.id, g.matchdayId)).then(r => r[0])
      if (md) matchdayNums[g.matchdayId] = md.number
    }
  }

  const userRecord = await db.select({ avatarColor: users.avatarColor }).from(users).where(eq(users.id, session.userId)).then(r => r[0])
  const initials = session.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl text-white" style={{ backgroundColor: userRecord?.avatarColor ?? undefined }}>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xl font-bold">{session.name}</p>
              <p className="text-muted-foreground text-sm">{session.email}</p>
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-6">
            <ProfileEditForm currentName={session.name} />
            <Separator />
            <ProfileColorForm currentColor={userRecord?.avatarColor ?? null} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {myStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tournament stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-black text-primary">{myStats.points}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
              <div>
                <p className="text-3xl font-black text-green-600">{myStats.victories}</p>
                <p className="text-xs text-muted-foreground">Victories</p>
              </div>
              <div>
                <p className="text-3xl font-black text-red-500">{myStats.losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{myStats.setsWon}</p>
                <p className="text-xs text-muted-foreground">Sets Won</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{myStats.setsLost}</p>
                <p className="text-xs text-muted-foreground">Sets Lost</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{Math.round(myForm.winPct * 100)}%</p>
                <p className="text-xs text-muted-foreground">Win rate</p>
              </div>
              <div>
                <p className="text-xl font-bold">{Math.round(myForm.setWinPct * 100)}%</p>
                <p className="text-xs text-muted-foreground">Set rate</p>
              </div>
              <div>
                <p className="text-xl font-bold">{myStats.gamesPlayed ? (myStats.points / myStats.gamesPlayed).toFixed(1) : '0'}</p>
                <p className="text-xs text-muted-foreground">Pts/game</p>
              </div>
              <div>
                <p className="text-xl font-bold">{myForm.longestWinStreak}</p>
                <p className="text-xs text-muted-foreground">Best streak</p>
              </div>
            </div>
            {myForm.form.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Recent form</span>
                <div className="flex gap-1">
                  {myForm.form.map((r, i) => (
                    <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${r === 'W' ? 'bg-green-500' : 'bg-red-500'}`}>{r}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {recentGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentGames.map(game => {
              const isHome = game.homePlayerId === session.userId
              const opponentId = isHome ? game.awayPlayerId : game.homePlayerId
              const mySets = isHome ? (game.homeSets ?? 0) : (game.awaySets ?? 0)
              const oppSets = isHome ? (game.awaySets ?? 0) : (game.homeSets ?? 0)
              const won = mySets > oppSets
              return (
                <div key={game.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${won ? 'bg-green-500' : 'bg-red-500'}`}>
                      {won ? 'W' : 'L'}
                    </span>
                    <span>vs {opponentMap[opponentId] ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">{mySets} – {oppSets}</span>
                    <span className="text-xs">MD {matchdayNums[game.matchdayId] ?? '?'}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
