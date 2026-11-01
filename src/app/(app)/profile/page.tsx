import { requireSession, getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays, notificationPrefs } from '@/lib/db/schema'
import { eq, inArray, or, and, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { computeScoreboard } from '@/lib/scoreboard'
import { getDisplayTournament } from '@/lib/tournament'
import { computePlayerForm } from '@/lib/playerStats'
import { perspective } from '@/lib/gameResult'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import ProfileEditForm from '@/components/profile/ProfileEditForm'
import ProfileColorForm from '@/components/profile/ProfileColorForm'
import ChangePasswordForm from '@/components/profile/ChangePasswordForm'
import NotificationToggle from '@/components/profile/NotificationToggle'
import NotificationPrefs from '@/components/profile/NotificationPrefs'
import EloSummary, { loadEloSummary } from '@/components/elo/EloSummary'
import { withDefaults } from '@/lib/notificationTypes'

export const dynamic = 'force-dynamic'

/** How many games "Recent results" lists. */
const RECENT_LIMIT = 10

export default async function ProfilePage() {
  const session = await requireSession()

  // One parallel batch. The season stats wait only on which tournament to show; nothing else on
  // the page depends on it, so the rest goes out alongside.
  const opponent = alias(users, 'opponent')
  const [season, userRecord, prefRow, eloData] = await Promise.all([
    getDisplayTournament().then(async tournament => {
      if (!tournament) return null
      return Promise.all([
        computeScoreboard(tournament.id),
        // My finished games (oldest → newest) with the opponent's name and the matchday number
        // joined in — feeds both the form/streak stats and the recent-results list.
        db.select({ game: games, opponentName: opponent.name, matchdayNumber: matchdays.number })
          .from(games)
          .leftJoin(opponent, sql`${opponent.id} = CASE WHEN ${games.homePlayerId} = ${session.userId} THEN ${games.awayPlayerId} ELSE ${games.homePlayerId} END`)
          .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
          .where(and(
            eq(games.tournamentId, tournament.id),
            or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
            inArray(games.status, ['confirmed', 'forfeited'])
          ))
          .orderBy(games.confirmedAt),
      ])
    }),
    getCurrentUser(session.userId),
    db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, session.userId)).then(r => r[0]),
    loadEloSummary(session.userId),
  ])
  const [scores, myFinished] = season ?? [[], []]
  const myStats = scores.find(s => s.userId === session.userId)
  const myForm = computePlayerForm(myFinished.map(r => r.game), session.userId)
  // The last 10, newest first.
  const recentGames = myFinished.slice(-RECENT_LIMIT).reverse()
  const notifPrefs = withDefaults(prefRow)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <PlayerAvatar name={session.name} avatarColor={userRecord?.avatarColor} className="h-16 w-16" fallbackClassName="text-xl" />
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
        <CardContent className="space-y-4">
          <NotificationToggle />
          <Separator />
          <NotificationPrefs initial={notifPrefs} />
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

      <EloSummary userId={session.userId} possessive="your" data={eloData} />

      {recentGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentGames.map(({ game, opponentName, matchdayNumber }) => {
              const { mySets, oppSets, won } = perspective(game, session.userId)
              return (
                <div key={game.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${won ? 'bg-green-500' : 'bg-red-500'}`}>
                      {won ? 'W' : 'L'}
                    </span>
                    <span>vs {opponentName ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">{mySets} – {oppSets}</span>
                    <span className="text-xs w-12 text-right shrink-0">MD {matchdayNumber ?? '?'}</span>
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
