import { requireSession, getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users, matchdays, notificationPrefs } from '@/lib/db/schema'
import { eq, inArray, or, and, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { computeScoreboard } from '@/lib/data/scoreboard'
import { getDisplayTournament } from '@/lib/data/tournaments'
import { computePlayerForm } from '@/lib/domain/playerStats'
import { perspective } from '@/lib/domain/gameResult'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import ProfileEditForm from '@/components/profile/ProfileEditForm'
import ProfileColorForm from '@/components/profile/ProfileColorForm'
import ChangePasswordForm from '@/components/profile/ChangePasswordForm'
import NotificationToggle from '@/components/profile/NotificationToggle'
import NotificationPrefs from '@/components/profile/NotificationPrefs'
import EloSummary, { loadEloSummary } from '@/components/elo/EloSummary'
import { withDefaults } from '@/lib/domain/notificationTypes'
import { FINISHED_STATUSES } from '@/lib/domain/gameStatus'
import ResultChip from '@/components/common/ResultChip'
import PlayerStatsCard from '@/components/player/PlayerStatsCard'
import SectionCard from '@/components/common/SectionCard'

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
            inArray(games.status, [...FINISHED_STATUSES])
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

      <SectionCard title="Notifications" compact contentClassName="space-y-4">
        <NotificationToggle />
        <Separator />
        <NotificationPrefs initial={notifPrefs} />
      </SectionCard>

      <SectionCard title="Change password" compact>
        <ChangePasswordForm />
      </SectionCard>

      {myStats && (
        <PlayerStatsCard stats={myStats} form={myForm} />
      )}

      <EloSummary userId={session.userId} possessive="your" data={eloData} />

      {recentGames.length > 0 && (
        <SectionCard title="Recent results" compact contentClassName="space-y-2">
          {recentGames.map(({ game, opponentName, matchdayNumber }) => {
            const { mySets, oppSets, won } = perspective(game, session.userId)
            return (
              <div key={game.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ResultChip won={won} className="text-xs" />
                  <span>vs {opponentName ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">{mySets} – {oppSets}</span>
                  <span className="text-xs w-12 text-right shrink-0">MD {matchdayNumber ?? '?'}</span>
                </div>
              </div>
            )
          })}
        </SectionCard>
      )}
    </div>
  )
}
