import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays } from '@/lib/db/schema'
import { and, asc, eq, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { todayISO } from '@/lib/dates'
import GameStatusBadge from '@/components/game/GameStatusBadge'
import { isFinished, isUnplayed } from '@/lib/gameStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameResultForm from '@/components/game/GameResultForm'
import ReportResultForm from '@/components/game/ReportResultForm'
import AdminGameActions from '@/components/admin/AdminGameActions'
import AdminEditResultForm from '@/components/admin/AdminEditResultForm'
import BackLink from '@/components/common/BackLink'

export const dynamic = 'force-dynamic'

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()

  // The game, both players and its matchday in one joined query.
  const homeUser = alias(users, 'home_user')
  const awayUser = alias(users, 'away_user')
  const row = await db.select({
    game: games,
    homePlayer: { id: homeUser.id, name: homeUser.name, avatarColor: homeUser.avatarColor },
    awayPlayer: { id: awayUser.id, name: awayUser.name, avatarColor: awayUser.avatarColor },
    matchday: { id: matchdays.id, number: matchdays.number, weekStart: matchdays.weekStart },
  })
    .from(games)
    .leftJoin(homeUser, eq(homeUser.id, games.homePlayerId))
    .leftJoin(awayUser, eq(awayUser.id, games.awayPlayerId))
    .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
    .where(eq(games.id, parseInt(id)))
    .then(r => r[0] ?? null)
  if (!row) notFound()
  const { game } = row
  const homePlayer = row.homePlayer ?? undefined
  const awayPlayer = row.awayPlayer ?? undefined
  const matchday = row.matchday ?? undefined

  // Every other meeting between these two this season — the one thing you actually want to know
  // while looking at a fixture ("didn't they beat me last time?") and previously only reachable by
  // going to the other player's profile.
  const otherMeetings = await db.select({
    id: games.id,
    status: games.status,
    homePlayerId: games.homePlayerId,
    awayPlayerId: games.awayPlayerId,
    homeSets: games.homeSets,
    awaySets: games.awaySets,
    isCatchUp: games.isCatchUp,
    mdNumber: matchdays.number,
    weekStart: matchdays.weekStart,
  })
    .from(games)
    .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
    .where(and(
      eq(games.tournamentId, game.tournamentId),
      ne(games.id, game.id),
      or(
        and(eq(games.homePlayerId, game.homePlayerId), eq(games.awayPlayerId, game.awayPlayerId)),
        and(eq(games.homePlayerId, game.awayPlayerId), eq(games.awayPlayerId, game.homePlayerId)),
      ),
    ))
    .orderBy(asc(matchdays.number), asc(games.id))

  const isParticipant = session.userId === game.homePlayerId || session.userId === game.awayPlayerId
  // Who put the current score on the board — the corrector if there's been one, otherwise whoever
  // entered it. "You" when that's the reader, so the prompt doesn't read as if they're a stranger.
  const setterId = game.correctedBy ?? game.submittedBy
  const setterName = setterId === session.userId
    ? 'You'
    : setterId === game.homePlayerId ? homePlayer?.name
    : setterId === game.awayPlayerId ? awayPlayer?.name
    : null
  // Results are auto-approved, so the only thing left for the other player to do is correct one
  // that's wrong. Either player can, for as long as the result stands.
  const hasResult = game.homeSets !== null && game.awaySets !== null
  const canReport = game.status === 'confirmed' && isParticipant && hasResult
  const today = todayISO()
  // Playing ahead of schedule is allowed, so a future matchday no longer blocks entry — it's just
  // worth pointing out, in case someone opened the wrong week's game.
  const isFutureMatchday = !!matchday?.weekStart && matchday.weekStart > today
  const canEnter = isUnplayed(game.status) && isParticipant
  const canPostpone = isUnplayed(game.status) && (isParticipant || session.isAdmin)
  const canAdminAct = session.isAdmin && !isFinished(game.status)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <BackLink href={matchday ? `/matchdays/${matchday.id}` : '/matchdays'} className="mb-2">
          {matchday ? `Matchday ${matchday.number}` : 'Matchdays'}
        </BackLink>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Game details</h1>
          <GameStatusBadge status={game.status} look="detail" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-around text-center gap-4">
            <PlayerLink userId={game.homePlayerId} currentUserId={session.userId} className="flex-1 flex flex-col items-center gap-2">
              <PlayerAvatar name={homePlayer?.name} avatarColor={homePlayer?.avatarColor} className="h-14 w-14" fallbackClassName="text-base" />
              <div>
                <p className="text-sm text-muted-foreground">Home</p>
                <p className={`font-bold text-lg ${homePlayer?.id === session.userId ? 'text-primary' : ''}`}>
                  {homePlayer?.name ?? '—'}{homePlayer?.id === session.userId && ' (you)'}
                </p>
              </div>
            </PlayerLink>
            <div className="text-center px-2">
              {game.homeSets !== null && game.awaySets !== null ? (
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-black ${game.homeSets > game.awaySets ? 'text-green-600' : game.homeSets < game.awaySets ? 'text-red-500' : ''}`}>
                    {game.homeSets}
                  </span>
                  <span className="text-2xl text-muted-foreground">–</span>
                  <span className={`text-4xl font-black ${game.awaySets > game.homeSets ? 'text-green-600' : game.awaySets < game.homeSets ? 'text-red-500' : ''}`}>
                    {game.awaySets}
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-black text-muted-foreground">vs</span>
              )}
              {matchday && <p className="text-xs text-muted-foreground mt-1">Matchday {matchday.number}</p>}
            </div>
            <PlayerLink userId={game.awayPlayerId} currentUserId={session.userId} className="flex-1 flex flex-col items-center gap-2">
              <PlayerAvatar name={awayPlayer?.name} avatarColor={awayPlayer?.avatarColor} className="h-14 w-14" fallbackClassName="text-base" />
              <div>
                <p className="text-sm text-muted-foreground">Away</p>
                <p className={`font-bold text-lg ${awayPlayer?.id === session.userId ? 'text-primary' : ''}`}>
                  {awayPlayer?.name ?? '—'}{awayPlayer?.id === session.userId && ' (you)'}
                </p>
              </div>
            </PlayerLink>
          </div>
        </CardContent>
      </Card>

      {isParticipant && (
        <>
          {game.status === 'pending' && isFutureMatchday && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/40">
              <CardContent className="pt-4 pb-4 text-sm text-blue-800 dark:text-blue-300">
                📅 This game belongs to a future matchday. If you&apos;ve played it early, go ahead and enter
                the result — it counts straight away.
              </CardContent>
            </Card>
          )}

          {canEnter && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enter result</CardTitle>
              </CardHeader>
              <CardContent>
                <GameResultForm gameId={game.id} mode="enter" homeName={homePlayer?.name} awayName={awayPlayer?.name} />
              </CardContent>
            </Card>
          )}

          {canReport && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Not the right score?</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {setterName ? `${setterName} recorded` : 'The recorded result is'}{' '}
                  <strong>{homePlayer?.name} {game.homeSets} – {game.awaySets} {awayPlayer?.name}</strong>.
                  If that’s wrong, put it right — no approval needed.
                </p>
              </CardHeader>
              <CardContent>
                <ReportResultForm
                  gameId={game.id}
                  homeName={homePlayer?.name ?? 'Home'}
                  awayName={awayPlayer?.name ?? 'Away'}
                  homeSets={game.homeSets!}
                  awaySets={game.awaySets!}
                />
              </CardContent>
            </Card>
          )}

          {canPostpone && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Game actions</p>
                <GameResultForm gameId={game.id} mode="postpone" isPostponed={game.status === 'postponed'} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {otherMeetings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Head-to-head</CardTitle>
            <p className="text-sm text-muted-foreground">
              {homePlayer?.name} vs {awayPlayer?.name} this season — tap one to open it.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherMeetings.map(m => {
              const played = m.homeSets != null && m.awaySets != null &&
                isFinished(m.status)
              // Scores are stored from that game's own home/away side, which can be the reverse of
              // this one — show them in this page's order so the two rows read consistently.
              const sameOrientation = m.homePlayerId === game.homePlayerId
              const left = sameOrientation ? m.homeSets : m.awaySets
              const right = sameOrientation ? m.awaySets : m.homeSets
              return (
                <Link
                  key={m.id}
                  href={`/games/${m.id}`}
                  className="flex items-center justify-between gap-3 rounded-md -mx-2 px-2 py-2 hover:bg-accent transition-colors"
                >
                  <span className="text-sm text-muted-foreground shrink-0">
                    {m.isCatchUp ? 'Catch-up' : `Matchday ${m.mdNumber ?? '?'}`}
                  </span>
                  {played ? (
                    <span className="font-mono font-bold tabular-nums">{left} – {right}</span>
                  ) : (
                    <span className="text-sm font-medium text-primary">
                      {m.status === 'postponed' ? 'Postponed' : 'Not played yet'} →
                    </span>
                  )}
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {game.status === 'confirmed' && (
        <div className="text-center text-sm text-muted-foreground py-4">
          ✅ Result recorded{game.correctedAt ? ' (corrected since)' : ''}. The scoreboard and ELO ratings are up to date.
        </div>
      )}

      {canAdminAct && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="pt-4">
            <AdminGameActions gameId={game.id} isPostponed={game.status === 'postponed'} />
          </CardContent>
        </Card>
      )}

      {session.isAdmin && isFinished(game.status) && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin: correct result</p>
            <AdminEditResultForm gameId={game.id} homeSets={game.homeSets} awaySets={game.awaySets} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
