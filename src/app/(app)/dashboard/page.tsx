import Link from 'next/link'
import { requireSession, getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { participants, games, users, matchdays } from '@/lib/db/schema'
import { eq, or, inArray, and, lte, gte } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameCard from '@/components/game/GameCard'
import HowItWorks from '@/components/common/HowItWorks'
import JoinTournamentButton from '@/components/common/JoinTournamentButton'
import EmptyState from '@/components/common/EmptyState'
import WhatsNewBanner from '@/components/layout/WhatsNewBanner'
import { shouldShowWhatsNew } from '@/lib/domain/whatsNew'
import { SETTINGS, getBoolSetting } from '@/lib/services/settings'
import { computeStandingsWithMovement } from '@/lib/data/standings'
import { getLiveTournament } from '@/lib/data/tournaments'
import { getLatestFinishedTournament, computeRecap } from '@/lib/data/recap'
import { todayISO, deadlineLabel } from '@/lib/dates'
import { ChevronRight } from 'lucide-react'
import { UNPLAYED_STATUSES, isFinished, isUnplayed } from '@/lib/domain/gameStatus'
import StandingsTable from '@/components/scoreboard/StandingsTable'
import SectionCard from '@/components/common/SectionCard'
import ShowMoreList from '@/components/common/ShowMoreList'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()

  // The release note lives here rather than in the layout: home is where people land and where
  // they have a moment to read, whereas a push notification deep-links straight to a game and a
  // changelog on top of that is just something in the way of entering a score.
  const [tournament, me, whatsNewEnabled] = await Promise.all([
    getLiveTournament(),
    getCurrentUser(session.userId),
    getBoolSetting(SETTINGS.whatsNewEnabled),
  ])
  const showWhatsNew = shouldShowWhatsNew(me?.whatsNewSeen, whatsNewEnabled)

  if (!tournament) {
    const lastFinished = await getLatestFinishedTournament()
    const champion = lastFinished ? (await computeRecap(lastFinished.id, lastFinished.name)).champion : null
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {showWhatsNew && <WhatsNewBanner />}
        {lastFinished && (
          <Card className="border-yellow-400/50 bg-gradient-to-b from-yellow-400/10 to-transparent">
            <CardContent className="py-8 flex flex-col items-center text-center gap-4">
              <div className="text-5xl">🏆</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-400">Season complete</p>
                <h1 className="text-2xl font-black">{lastFinished.name} has wrapped!</h1>
                {champion && (
                  <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                    <PlayerAvatar name={champion.name} avatarColor={champion.avatarColor} className="h-6 w-6" fallbackClassName="text-[10px]" />
                    Champion: <span className="font-semibold text-foreground">{champion.name}</span> 🎉
                  </p>
                )}
              </div>
              <Link href="/recap" className={buttonVariants({ size: 'lg' })}>🎬 See the season recap</Link>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="text-5xl">🏓</div>
          <h2 className="text-xl font-bold">No active tournament</h2>
          <p className="text-muted-foreground">
            {session.isAdmin
              ? 'Head to the Admin panel to create the next season.'
              : 'Check back later when the admin starts the next season.'}
          </p>
          {session.isAdmin && (
            <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>Go to Admin panel</Link>
          )}
        </div>
      </div>
    )
  }

  if (tournament.status === 'registration') {
    const enrolledPlayers = await db
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournament.id))
      .orderBy(participants.joinedAt)
    const myParticipation = enrolledPlayers.some(p => p.id === session.userId)

    return (
      <div className="space-y-6">
        {showWhatsNew && <WhatsNewBanner />}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">Registration is open</p>
          </div>
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">Registration open</Badge>
        </div>

        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-5xl">📋</div>
            <div>
              <p className="text-lg font-medium">{enrolledPlayers.length} player{enrolledPlayers.length !== 1 ? 's' : ''} registered</p>
              <p className="text-muted-foreground text-sm mt-1">
                The tournament starts once the admin closes registration and generates the schedule.
              </p>
            </div>
            {myParticipation ? (
              <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900 rounded-full px-4 py-2 text-sm font-medium">
                ✓ You&apos;re in! Waiting for the tournament to start…
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  You&apos;re not in this tournament yet — registration is open!
                </p>
                <JoinTournamentButton />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Players signed up" compact contentClassName="space-y-3">
            {enrolledPlayers.length === 0 && (
              <p className="text-sm text-muted-foreground">No players yet.</p>
            )}
            {enrolledPlayers.map((player, i) => {
              const isMe = player.id === session.userId
              return (
                <div key={player.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <PlayerLink userId={player.id!} currentUserId={session.userId} className="flex items-center gap-3 w-fit">
                    <PlayerAvatar name={player.name} avatarColor={player.avatarColor} className="h-7 w-7" fallbackClassName="text-xs" />
                    <span className={`text-sm font-medium ${isMe ? 'text-primary' : 'hover:underline'}`}>
                      {player.name}{isMe && ' (you)'}
                    </span>
                  </PlayerLink>
                </div>
              )
            })}
          </SectionCard>

          <HowItWorks />
        </div>
      </div>
    )
  }

  // Active tournament. Everything below is independent, so it goes out in one parallel batch.
  const today = todayISO()
  const homeUser = alias(users, 'home_user')
  const awayUser = alias(users, 'away_user')
  const [myPendingGames, scores, weekGames] = await Promise.all([
    db.select({
      game: games,
      homePlayer: { id: homeUser.id, name: homeUser.name, email: homeUser.email, avatarColor: homeUser.avatarColor },
      awayPlayer: { id: awayUser.id, name: awayUser.name, email: awayUser.email, avatarColor: awayUser.avatarColor },
      matchday: { number: matchdays.number, weekStart: matchdays.weekStart, weekEnd: matchdays.weekEnd },
    })
      .from(games)
      .leftJoin(homeUser, eq(homeUser.id, games.homePlayerId))
      .leftJoin(awayUser, eq(awayUser.id, games.awayPlayerId))
      .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
      .where(and(
        eq(games.tournamentId, tournament.id),
        or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
        inArray(games.status, [...UNPLAYED_STATUSES])
      ))
      // Explicit, so "the game to play next" below doesn't depend on whichever index SQLite uses.
      .orderBy(games.id),
    computeStandingsWithMovement(tournament.id),
    // This week's matchday progress: the regular games of the matchday whose Mon–Fri window
    // covers today. Joined in one query, so no separate "which matchday is current" lookup.
    db.select({ status: games.status, matchdayId: matchdays.id, number: matchdays.number })
      .from(games)
      .innerJoin(matchdays, eq(matchdays.id, games.matchdayId))
      .where(and(
        eq(matchdays.tournamentId, tournament.id),
        lte(matchdays.weekStart, today),
        gte(matchdays.weekEnd, today),
        eq(games.isCatchUp, false),
      )),
  ])

  const enrichedGames = myPendingGames.map(row => ({
    ...row.game, homePlayer: row.homePlayer, awayPlayer: row.awayPlayer, matchday: row.matchday,
    weekStart: row.matchday?.weekStart ?? null, weekEnd: row.matchday?.weekEnd ?? null,
  }))

  // Catch-up = explicit backlog games (a newcomer's owed games) plus any regular game
  // whose matchday week has already started but is still unplayed (overdue).
  const catchUpGames = enrichedGames
    .filter(g => g.isCatchUp || (g.weekStart && g.weekStart <= today))
    .sort((a, b) => (a.matchday?.number ?? 0) - (b.matchday?.number ?? 0))
  const upcomingGames = enrichedGames
    .filter(g => !g.isCatchUp && (!g.weekStart || g.weekStart > today))
    .sort((a, b) => (a.matchday?.number ?? 0) - (b.matchday?.number ?? 0))
    .slice(0, 4)

  const currentMatchday = weekGames[0] ? { id: weekGames[0].matchdayId, number: weekGames[0].number } : null
  const weekPlayed = weekGames.filter(g => isFinished(g.status)).length
  const weekPct = weekGames.length ? Math.round((weekPlayed / weekGames.length) * 100) : 0

  // The single most important thing for this player to do right now (catch up > play).
  const opponentName = (g: (typeof enrichedGames)[number]) =>
    g.homePlayerId === session.userId ? (g.awayPlayer?.name ?? '—') : (g.homePlayer?.name ?? '—')
  const overdue = enrichedGames.find(g =>
    isUnplayed(g.status) &&
    (g.isCatchUp || (g.weekEnd != null && g.weekEnd < today)))
  const thisWeekPlay = enrichedGames.find(g =>
    isUnplayed(g.status) &&
    g.weekStart && g.weekEnd && g.weekStart <= today && today <= g.weekEnd)

  let nextAction: { emoji: string; title: string; detail: string; gameId: number; tone: string } | null = null
  if (overdue) {
    nextAction = { emoji: '⏳', title: 'You have a game to catch up on', detail: `Play ${opponentName(overdue)} as soon as you can.`, gameId: overdue.id, tone: 'ring-orange-400 bg-orange-50 dark:ring-orange-500/80 dark:bg-orange-500/15' }
  } else if (thisWeekPlay) {
    const dl = deadlineLabel(thisWeekPlay.weekStart, thisWeekPlay.weekEnd)
    nextAction = { emoji: '🏓', title: 'Play your game this week', detail: `You're up against ${opponentName(thisWeekPlay)}${dl ? ` — ${dl.text}` : ''}.`, gameId: thisWeekPlay.id, tone: 'ring-emerald-400 bg-emerald-50 dark:ring-emerald-500/80 dark:bg-emerald-500/15' }
  }

  // The game in the banner above isn't repeated in the list below it.
  const listedCatchUp = catchUpGames.filter(g => g.id !== nextAction?.gameId)

  return (
    <div className="space-y-6">
      {showWhatsNew && <WhatsNewBanner />}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{tournament.name}</h1>
          <p className="text-muted-foreground">League in progress</p>
        </div>
        <Badge className="bg-green-600 shrink-0">Active</Badge>
      </div>

      {nextAction && (
        <Link href={`/games/${nextAction.gameId}`} className="block">
          <Card className={`${nextAction.tone} hover:shadow-md transition-shadow`}>
            <CardContent className="py-4 flex items-center gap-3">
              <span className="text-2xl shrink-0">{nextAction.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{nextAction.title}</p>
                <p className="text-sm text-muted-foreground">{nextAction.detail}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {currentMatchday && weekGames.length > 0 && (
        <Link href={`/matchdays/${currentMatchday.id}`} className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="font-medium text-sm">Matchday {currentMatchday.number} — this week</p>
                <span className="text-sm text-muted-foreground tabular-nums shrink-0">{weekPlayed}/{weekGames.length} games played</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${weekPct}%` }} />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {listedCatchUp.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-orange-700 dark:text-orange-400">
              ⏳ {nextAction ? 'More to catch up' : 'Catch-up games'}
            </h2>
            <Badge variant="outline" className="border-orange-400 text-orange-700 dark:border-orange-500/60 dark:text-orange-400">{listedCatchUp.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            These are from matchdays that have already started. Play them to catch up.
          </p>
          {/* Oldest first; the rest fold away so a long backlog doesn't push the standings off-screen. */}
          <ShowMoreList initial={2} label="catch-up games" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {listedCatchUp.map(game => (
              <GameCard key={game.id} game={game} currentUserId={session.userId} />
            ))}
          </ShowMoreList>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My upcoming games</h2>
            <Link href="/my-games" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {upcomingGames.length > 0 ? (
            <div className="flex-1 flex flex-col gap-3">
              {upcomingGames.map(game => (
                <GameCard key={game.id} game={game} currentUserId={session.userId} className="flex-1" />
              ))}
            </div>
          ) : (
            <Card className="flex-1">
              <CardContent className="pt-6">
                <EmptyState emoji="🎉" title="You're all caught up!" hint="No upcoming games right now — enjoy the break." />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Top standings</h2>
            <Link href="/scoreboard" className="text-sm text-primary hover:underline">Full table</Link>
          </div>
          <Card className="flex-1 py-0">
            <CardContent className="p-0">
              <StandingsTable rows={scores.slice(0, 8)} columns="compact" currentUserId={session.userId} />
              {scores.length > 8 && (
                <Link
                  href="/scoreboard"
                  className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent transition-colors"
                >
                  View all {scores.length} players →
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <HowItWorks />
    </div>
  )
}
