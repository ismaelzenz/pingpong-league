import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users, matchdays, eloHistory } from '@/lib/db/schema'
import { and, asc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { todayISO, shortDate, shortRange } from '@/lib/dates'
import GameStatusBadge from '@/components/game/GameStatusBadge'
import { isFinished, isUnplayed } from '@/lib/domain/gameStatus'
import { Card, CardContent } from '@/components/ui/card'
import GameScoreCard from '@/components/game/GameScoreCard'
import GameRow from '@/components/game/GameRow'
import Disclosure from '@/components/common/Disclosure'
import GameResultForm from '@/components/game/GameResultForm'
import PostponeButton from '@/components/game/PostponeButton'
import ReportResultForm from '@/components/game/ReportResultForm'
import AdminGameActions from '@/components/admin/AdminGameActions'
import AdminEditResultForm from '@/components/admin/AdminEditResultForm'
import BackLink from '@/components/common/BackLink'
import SectionCard from '@/components/common/SectionCard'

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
    matchday: { id: matchdays.id, number: matchdays.number, weekStart: matchdays.weekStart, weekEnd: matchdays.weekEnd },
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

  // Every meeting between these two this season, this one included — the one thing you actually
  // want to know while looking at a fixture ("didn't they beat me last time?") — plus what this
  // game did to each player's rating, once it's rated.
  const [meetings, eloRows] = await Promise.all([
    db.select({
      id: games.id,
      status: games.status,
      homePlayerId: games.homePlayerId,
      awayPlayerId: games.awayPlayerId,
      homeSets: games.homeSets,
      awaySets: games.awaySets,
      isCatchUp: games.isCatchUp,
      mdNumber: matchdays.number,
    })
      .from(games)
      .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
      .where(and(
        eq(games.tournamentId, game.tournamentId),
        or(
          and(eq(games.homePlayerId, game.homePlayerId), eq(games.awayPlayerId, game.awayPlayerId)),
          and(eq(games.homePlayerId, game.awayPlayerId), eq(games.awayPlayerId, game.homePlayerId)),
        ),
      ))
      .orderBy(asc(matchdays.number), asc(games.id)),
    db.select({ userId: eloHistory.userId, delta: eloHistory.delta })
      .from(eloHistory)
      .where(and(eq(eloHistory.source, 'league'), eq(eloHistory.refId, game.id))),
  ])
  const eloDelta = new Map(eloRows.map(r => [r.userId, r.delta]))

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

  const home = { id: game.homePlayerId, name: homePlayer?.name ?? '—', avatarColor: homePlayer?.avatarColor ?? null }
  const away = { id: game.awayPlayerId, name: awayPlayer?.name ?? '—', avatarColor: awayPlayer?.avatarColor ?? null }
  // Outcome buttons: "You won", "Cristiano won" — a full name truncates on a phone.
  const short = (p: { id: number; name: string }) => p.id === session.userId ? 'You' : p.name.split(' ')[0]
  const isPostponed = game.status === 'postponed'

  // The line under the score: when and by whom it was recorded, or what state the game is in.
  const recordedAt = game.correctedAt ?? game.submittedAt ?? game.confirmedAt
  const footer = game.status === 'confirmed' ? (
    <>
      Recorded by {setterName === 'You' ? 'you' : (setterName ?? 'an admin')}
      {recordedAt && ` · ${shortDate(recordedAt.replace(' ', 'T'))}`}
      {game.correctedAt && ' · corrected since'}
    </>
  ) : game.status === 'forfeited' ? (
    'Forfeited — a 0–2 loss for both players, with no ELO change.'
  ) : isPostponed ? (
    <span className="font-medium text-amber-700 dark:text-amber-400">Postponed — play it whenever you both can, then enter the result.</span>
  ) : isParticipant && isFutureMatchday ? (
    'This is a future matchday. Played it early? Enter the result below — it counts straight away.'
  ) : null

  // Head-to-head, oriented like this page and summed up from the viewer's side when they're in it.
  const playerById = new Map([[home.id, home], [away.id, away]])
  const decided = meetings.filter(m => m.status === 'confirmed' && m.homeSets != null && m.awaySets != null)
  const winsOf = (id: number) => decided.filter(m => (m.homePlayerId === id) === (m.homeSets! > m.awaySets!)).length
  const [first, second] = isParticipant && session.userId === away.id ? [away, home] : [home, away]
  const [aWins, bWins] = [winsOf(first.id), winsOf(second.id)]
  const lead = (p: typeof home) => (p.id === session.userId ? 'You lead' : `${p.name} leads`)
  const h2hSummary = decided.length === 0 ? 'No meetings played yet'
    : aWins === bWins ? `Level ${aWins}–${bWins}`
    : aWins > bWins ? `${lead(first)} ${aWins}–${bWins}` : `${lead(second)} ${bWins}–${aWins}`

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div>
        <BackLink href={matchday ? `/matchdays/${matchday.id}` : '/matchdays'} className="mb-2">
          {matchday ? `Matchday ${matchday.number}` : 'Matchdays'}
        </BackLink>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{game.isCatchUp ? 'Catch-up game' : matchday ? `Matchday ${matchday.number}` : 'Game'}</h1>
            {!game.isCatchUp && matchday?.weekStart && matchday.weekEnd && (
              <p className="text-sm text-muted-foreground">{shortRange(matchday.weekStart, matchday.weekEnd)}</p>
            )}
          </div>
          <GameStatusBadge status={game.status} look="detail" />
        </div>
      </div>

      <GameScoreCard game={game} home={home} away={away} viewerId={session.userId} eloDelta={eloDelta} footer={footer} />

      {canReport && (
        <div className="px-1">
          <Disclosure label="Wrong score? Report it" closeLabel="Never mind — it’s right" opensBelow>
            <ReportResultForm
              gameId={game.id}
              homeName={short(home)}
              awayName={short(away)}
              homeSets={game.homeSets!}
              awaySets={game.awaySets!}
            />
          </Disclosure>
        </div>
      )}

      {canEnter && (
        <SectionCard title="Enter result" compact contentClassName="space-y-4">
          <GameResultForm gameId={game.id} homeName={home.name} awayName={away.name} homeLabel={short(home)} awayLabel={short(away)} />
          {canPostpone && <PostponeButton gameId={game.id} isPostponed={isPostponed} inline />}
        </SectionCard>
      )}

      {meetings.length > 1 && (
        <SectionCard
          title={<span className="flex items-baseline justify-between gap-3">Head-to-head <span className="text-sm font-normal text-muted-foreground">{h2hSummary}</span></span>}
          compact
          className="gap-0 pb-0"
          contentClassName="p-0"
        >
          <div className="divide-y border-t">
            {meetings.map(m => (
              <GameRow
                key={m.id}
                current={m.id === game.id}
                label={m.isCatchUp ? 'Catch-up' : `Matchday ${m.mdNumber ?? '?'}`}
                game={{
                  id: m.id,
                  status: m.status,
                  homeSets: m.homeSets,
                  awaySets: m.awaySets,
                  homePlayer: playerById.get(m.homePlayerId) ?? home,
                  awayPlayer: playerById.get(m.awayPlayerId) ?? away,
                }}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {session.isAdmin && (
        <Card className="ring-orange-300 bg-orange-50/50 dark:ring-orange-500/50 dark:bg-orange-950/30">
          <CardContent className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin{isFinished(game.status) ? ' · correct result' : ''}
            </p>
            {isFinished(game.status)
              ? <AdminEditResultForm gameId={game.id} homeSets={game.homeSets} awaySets={game.awaySets} />
              : <AdminGameActions gameId={game.id} isPostponed={isPostponed} />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
