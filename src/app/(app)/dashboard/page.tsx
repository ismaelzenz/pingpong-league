import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { participants, games, users, matchdays } from '@/lib/db/schema'
import { eq, or, inArray, and, lte, gte } from 'drizzle-orm'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameCard from '@/components/game/GameCard'
import HowItWorks from '@/components/common/HowItWorks'
import JoinTournamentButton from '@/components/common/JoinTournamentButton'
import EmptyState from '@/components/common/EmptyState'
import { computeStandingsWithMovement } from '@/lib/standings'
import { getLiveTournament } from '@/lib/tournament'
import { todayISO, deadlineLabel } from '@/lib/dates'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()

  const tournament = await getLiveTournament()

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-6xl">🏓</div>
        <h1 className="text-2xl font-bold">No active tournament</h1>
        <p className="text-muted-foreground">
          {session.isAdmin
            ? 'Head to the Admin panel to create a new tournament.'
            : 'Check back later when the admin creates a new tournament.'}
        </p>
        {session.isAdmin && (
          <Link href="/admin" className={buttonVariants()}>Go to Admin panel</Link>
        )}
      </div>
    )
  }

  const myParticipation = await db.select().from(participants)
    .where(and(eq(participants.tournamentId, tournament.id), eq(participants.userId, session.userId)))
    .then(r => r[0] ?? null)

  const enrolledPlayers = await db
    .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
    .from(participants)
    .leftJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.tournamentId, tournament.id))
    .orderBy(participants.joinedAt)

  if (tournament.status === 'registration') {
    return (
      <div className="space-y-6">
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Players signed up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          <HowItWorks />
        </div>
      </div>
    )
  }

  // Active tournament
  const myPendingGames = await db.select({
    game: games,
    homePlayer: { id: users.id, name: users.name, email: users.email },
    matchday: { number: matchdays.number, weekStart: matchdays.weekStart, weekEnd: matchdays.weekEnd },
  })
    .from(games)
    .leftJoin(users, eq(users.id, games.homePlayerId))
    .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
    .where(and(
      eq(games.tournamentId, tournament.id),
      or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
      inArray(games.status, ['pending', 'result_entered', 'postponed'])
    ))

  // Enrich with away player names
  const enrichedGames = await Promise.all(myPendingGames.map(async row => {
    const awayPlayer = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, row.game.awayPlayerId)).then(r => r[0])
    return { ...row.game, homePlayer: row.homePlayer, awayPlayer, matchday: row.matchday, weekStart: row.matchday?.weekStart ?? null, weekEnd: row.matchday?.weekEnd ?? null }
  }))

  // Catch-up = explicit backlog games (a newcomer's owed games) plus any regular game
  // whose matchday week has already started but is still unplayed (overdue).
  const today = todayISO()
  const catchUpGames = enrichedGames
    .filter(g => g.isCatchUp || (g.weekStart && g.weekStart <= today))
    .sort((a, b) => (a.matchday?.number ?? 0) - (b.matchday?.number ?? 0))
  const upcomingGames = enrichedGames
    .filter(g => !g.isCatchUp && (!g.weekStart || g.weekStart > today))
    .sort((a, b) => (a.matchday?.number ?? 0) - (b.matchday?.number ?? 0))
    .slice(0, 4)

  const scores = await computeStandingsWithMovement(tournament.id)

  // This week's matchday progress (the in-progress matchday whose Mon–Fri window covers today).
  const currentMatchday = await db.select({ id: matchdays.id, number: matchdays.number }).from(matchdays)
    .where(and(
      eq(matchdays.tournamentId, tournament.id),
      lte(matchdays.weekStart, today),
      gte(matchdays.weekEnd, today),
    ))
    .then(r => r[0] ?? null)
  const weekGames = currentMatchday
    ? await db.select({ status: games.status }).from(games)
        .where(and(eq(games.matchdayId, currentMatchday.id), eq(games.isCatchUp, false)))
    : []
  const weekPlayed = weekGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length
  const weekPct = weekGames.length ? Math.round((weekPlayed / weekGames.length) * 100) : 0

  // The single most important thing for this player to do right now (confirm > catch up > play).
  const opponentName = (g: (typeof enrichedGames)[number]) =>
    g.homePlayerId === session.userId ? (g.awayPlayer?.name ?? '—') : (g.homePlayer?.name ?? '—')
  const toConfirm = enrichedGames.find(g => g.status === 'result_entered' && g.submittedBy !== session.userId)
  const overdue = enrichedGames.find(g =>
    (g.status === 'pending' || g.status === 'postponed') &&
    (g.isCatchUp || (g.weekEnd != null && g.weekEnd < today)))
  const thisWeekPlay = enrichedGames.find(g =>
    (g.status === 'pending' || g.status === 'postponed') &&
    g.weekStart && g.weekEnd && g.weekStart <= today && today <= g.weekEnd)

  let nextAction: { emoji: string; title: string; detail: string; gameId: number; tone: string } | null = null
  if (toConfirm) {
    nextAction = { emoji: '✅', title: 'A result needs your confirmation', detail: `${opponentName(toConfirm)} entered a score — check it's right.`, gameId: toConfirm.id, tone: 'border-amber-400/60 bg-amber-400/10 dark:border-amber-400/50 dark:bg-amber-400/15' }
  } else if (overdue) {
    nextAction = { emoji: '⏳', title: 'You have a game to catch up on', detail: `Play ${opponentName(overdue)} as soon as you can.`, gameId: overdue.id, tone: 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40' }
  } else if (thisWeekPlay) {
    const dl = deadlineLabel(thisWeekPlay.weekStart, thisWeekPlay.weekEnd)
    nextAction = { emoji: '🏓', title: 'Play your game this week', detail: `You're up against ${opponentName(thisWeekPlay)}${dl ? ` — ${dl.text}` : ''}.`, gameId: thisWeekPlay.id, tone: 'border-primary/40 bg-primary/5' }
  }

  return (
    <div className="space-y-6">
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

      {catchUpGames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-yellow-700 dark:text-yellow-400">⏳ Catch-up games</h2>
            <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-400">{catchUpGames.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            These are from matchdays that have already started. Play them to catch up.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catchUpGames.map(game => (
              <GameCard key={game.id} game={game} currentUserId={session.userId} />
            ))}
          </div>
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
          <Card className="flex-1">
            <CardContent className="pt-4 p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pl-4 pr-1 py-2 text-muted-foreground font-medium">#</th>
                    <th className="text-left pl-1 pr-4 py-2 text-muted-foreground font-medium w-full">Player</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">W</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">L</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.slice(0, 8).map((entry) => {
                    const isMe = entry.userId === session.userId
                    return (
                      <tr key={entry.userId} className={`border-b last:border-0 ${isMe ? 'bg-primary/5' : ''}`}>
                        <td className="pl-4 pr-1 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 text-center shrink-0 text-muted-foreground">{entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}</span>
                            <span className="w-7 shrink-0 text-xs tabular-nums text-center">
                              {entry.movement == null
                                ? null
                                : entry.movement > 0
                                  ? <span className="text-green-500">▲{entry.movement}</span>
                                  : entry.movement < 0
                                    ? <span className="text-red-500">▼{Math.abs(entry.movement)}</span>
                                    : <span className="text-muted-foreground">–</span>}
                            </span>
                          </div>
                        </td>
                        <td className="pl-1 pr-4 py-2.5">
                          {isMe ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-6 w-6 shrink-0" fallbackClassName="text-[10px]" />
                              <span className="text-primary font-medium truncate">{entry.name} (you)</span>
                            </div>
                          ) : (
                            <PlayerLink userId={entry.userId} currentUserId={session.userId} className="flex items-center gap-2 w-fit min-w-0">
                              <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-6 w-6 shrink-0" fallbackClassName="text-[10px]" />
                              <span className="font-medium truncate hover:underline">{entry.name}</span>
                            </PlayerLink>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-green-600">{entry.victories}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{entry.losses}</td>
                        <td className="px-4 py-2.5 text-right font-bold">{entry.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
