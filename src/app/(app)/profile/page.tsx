import { requireSession, getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users, matchdays, notificationPrefs } from '@/lib/db/schema'
import { eq, inArray, or, and, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { computeScoreboard } from '@/lib/data/scoreboard'
import { getDisplayTournament } from '@/lib/data/tournaments'
import { computePlayerForm } from '@/lib/domain/playerStats'
import { Separator } from '@/components/ui/separator'
import ProfileEditForm from '@/components/profile/ProfileEditForm'
import ProfileColorForm from '@/components/profile/ProfileColorForm'
import ChangePasswordForm from '@/components/profile/ChangePasswordForm'
import NotificationToggle from '@/components/profile/NotificationToggle'
import NotificationPrefs from '@/components/profile/NotificationPrefs'
import { withDefaults } from '@/lib/domain/notificationTypes'
import { FINISHED_STATUSES } from '@/lib/domain/gameStatus'
import PlayerStatsCard from '@/components/player/PlayerStatsCard'
import ProfileHeader from '@/components/player/ProfileHeader'
import RecentGames from '@/components/player/RecentGames'
import Disclosure from '@/components/common/Disclosure'
import { loadPlayerElo } from '@/lib/data/elo'
import SectionCard from '@/components/common/SectionCard'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await requireSession()

  // One parallel batch. The season stats wait only on which tournament to show; nothing else on
  // the page depends on it, so the rest goes out alongside.
  const opponent = alias(users, 'opponent')
  const [season, userRecord, prefRow, elo] = await Promise.all([
    getDisplayTournament().then(async tournament => {
      if (!tournament) return null
      return Promise.all([
        computeScoreboard(tournament.id),
        // My finished games (oldest → newest) with the opponent's name and the matchday number
        // joined in — feeds the form/streak stats, and the recent-games list's matchdays and forfeits.
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
    loadPlayerElo(session.userId),
  ])
  const [scores, myFinished] = season ?? [[], []]
  const rank = scores.findIndex(s => s.userId === session.userId)
  const myStats = rank >= 0 ? scores[rank] : null
  const myForm = computePlayerForm(myFinished.map(r => r.game), session.userId)
  const notifPrefs = withDefaults(prefRow)

  return (
    <div className="space-y-6">
      <ProfileHeader
        isMe
        player={{ name: session.name, email: session.email, avatarColor: userRecord?.avatarColor ?? null }}
        league={myStats ? { rank: rank + 1, of: scores.length, points: myStats.points } : null}
        elo={elo.entry ? { rating: elo.entry.rating, rank: elo.rank, of: elo.of, peak: elo.entry.peak } : null}
      />

      {/* Two columns from lg: how you're doing on the left, your settings on the right. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          {myStats && <PlayerStatsCard stats={myStats} form={myForm} />}
          <RecentGames playerId={session.userId} viewerId={session.userId} elo={elo.recent} league={myFinished} />
        </div>

        <SectionCard title="Settings" compact contentClassName="space-y-5">
          <div className="space-y-4">
            <ProfileEditForm currentName={session.name} />
            <ProfileColorForm currentColor={userRecord?.avatarColor ?? null} />
          </div>
          <Separator />
          <div className="space-y-4">
            <p className="text-sm font-medium">Notifications</p>
            <NotificationToggle />
            <NotificationPrefs initial={notifPrefs} />
          </div>
          <Separator />
          <Disclosure label="Change password" closeLabel="Cancel" opensBelow>
            <ChangePasswordForm />
          </Disclosure>
        </SectionCard>
      </div>
    </div>
  )
}
