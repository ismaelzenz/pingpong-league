import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { matchdays, games, users, participants } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import GameCard from '@/components/game/GameCard'
import GameRow from '@/components/game/GameRow'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import MatchdayEditor from '@/components/admin/MatchdayEditor'
import { analyzeSchedule } from '@/lib/domain/scheduleHealth'
import { deadlineLabel, shortRange, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Coffee } from 'lucide-react'
import { isFinished } from '@/lib/domain/gameStatus'
import BackLink from '@/components/common/BackLink'

export const dynamic = 'force-dynamic'

export default async function MatchdayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()

  const matchday = await db.select().from(matchdays).where(eq(matchdays.id, parseInt(id))).then(r => r[0] ?? null)
  if (!matchday) notFound()

  // Everything else depends only on the matchday, so it goes out in one parallel batch. The
  // whole-tournament reads are for the admin-only schedule-health check below.
  const homeUser = alias(users, 'home_user')
  const awayUser = alias(users, 'away_user')
  const [dayRows, roster, tournamentGames, tournamentMatchdays] = await Promise.all([
    // Catch-up games are only FK-pinned to a matchday; they aren't part of its line-up.
    db.select({
      game: games,
      homePlayer: { id: homeUser.id, name: homeUser.name, email: homeUser.email, avatarColor: homeUser.avatarColor },
      awayPlayer: { id: awayUser.id, name: awayUser.name, email: awayUser.email, avatarColor: awayUser.avatarColor },
    })
      .from(games)
      .leftJoin(homeUser, eq(homeUser.id, games.homePlayerId))
      .leftJoin(awayUser, eq(awayUser.id, games.awayPlayerId))
      .where(and(eq(games.matchdayId, matchday.id), eq(games.isCatchUp, false)))
      .orderBy(games.id),
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, matchday.tournamentId)),
    session.isAdmin ? db.select().from(games).where(eq(games.tournamentId, matchday.tournamentId)) : null,
    // Every matchday's id and number: the previous/next arrows, and the admin schedule check.
    db.select({ id: matchdays.id, number: matchdays.number }).from(matchdays)
      .where(eq(matchdays.tournamentId, matchday.tournamentId)).orderBy(matchdays.number),
  ])
  const dayGames = dayRows.map(r => r.game)
  const enriched = dayRows.map(r => ({
    ...r.game,
    homePlayer: { id: r.game.homePlayerId, name: r.homePlayer?.name ?? '—', avatarColor: r.homePlayer?.avatarColor ?? null },
    awayPlayer: { id: r.game.awayPlayerId, name: r.awayPlayer?.name ?? '—', avatarColor: r.awayPlayer?.avatarColor ?? null },
    matchday: { number: matchday.number }, weekStart: matchday.weekStart, weekEnd: matchday.weekEnd,
  }))

  // The viewer's own game is pinned as a full card; everyone else's are compact rows, split into
  // what's been played and what's still to play.
  const involvesMe = (g: { homePlayerId: number; awayPlayerId: number }) => g.homePlayerId === session.userId || g.awayPlayerId === session.userId
  const myGames = enriched.filter(involvesMe)
  const otherGames = enriched.filter(g => !involvesMe(g))
  const results = otherGames.filter(g => isFinished(g.status))
  const toPlay = otherGames.filter(g => !isFinished(g.status))

  const confirmed = dayGames.filter(g => isFinished(g.status)).length
  const pct = dayGames.length ? Math.round((confirmed / dayGames.length) * 100) : 0
  const deadline = deadlineLabel(matchday.weekStart, matchday.weekEnd)
  const complete = dayGames.length > 0 && confirmed === dayGames.length
  const index = tournamentMatchdays.findIndex(m => m.id === matchday.id)
  const prevMd = index > 0 ? tournamentMatchdays[index - 1] : null
  const nextMd = index >= 0 && index < tournamentMatchdays.length - 1 ? tournamentMatchdays[index + 1] : null

  // Players enrolled in the tournament who have no game this matchday are on a bye
  // (this is how odd player counts are handled — one or more players sit out each round).
  const playingIds = new Set(dayGames.flatMap(g => [g.homePlayerId, g.awayPlayerId]))
  const byePlayers = roster.filter(p => p.id != null && !playingIds.has(p.id))

  // Admins can restructure a matchday's line-up until its week starts.
  const today = todayISO()
  const isFuture = !!matchday.weekStart && matchday.weekStart > today
  const canEdit = session.isAdmin && isFuture
  const rosterPlayers = roster.filter(p => p.id != null).map(p => ({ id: p.id!, name: p.name ?? '—' }))

  // Schedule-health check across the whole tournament, narrowed to over-scheduled pairs
  // that appear in this matchday — so an editing admin sees what's wrong here.
  let localOverIssues: { aName: string; bName: string; count: number; matchdayNumbers: number[] }[] = []
  if (tournamentGames) {
    const health = analyzeSchedule(tournamentGames, new Map(tournamentMatchdays.map(m => [m.id, m.number])), rosterPlayers)

    const nameById = new Map(rosterPlayers.map(p => [p.id, p.name]))
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
    const pairsHere = new Set(dayGames.map(g =>
      pairKey(nameById.get(g.homePlayerId) ?? '', nameById.get(g.awayPlayerId) ?? '')))
    localOverIssues = health.issues.filter(iss =>
      iss.kind === 'over' && pairsHere.has(pairKey(iss.aName, iss.bName)))
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/matchdays" className="mb-2">All matchdays</BackLink>
        <div className="flex items-center justify-between gap-3">
          {/* Step through the season without going back to the list. */}
          <MatchdayStep md={prevMd} dir="prev" />
          <div className="min-w-0 text-center">
            <h1 className="text-2xl font-bold">Matchday {matchday.number}</h1>
            {matchday.weekStart && matchday.weekEnd && (
              <p className="text-muted-foreground text-sm">{shortRange(matchday.weekStart, matchday.weekEnd)}</p>
            )}
          </div>
          <MatchdayStep md={nextMd} dir="next" />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="tabular-nums">{confirmed}/{dayGames.length} played</span>
            {/* A finished matchday isn't "overdue", however long ago its week ended. */}
            {complete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                <Check className="w-3.5 h-3.5" /> All played
              </span>
            ) : deadline && (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
                deadline.overdue ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
                  : deadline.urgent ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                {deadline.text}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {myGames.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your game</h2>
          {myGames.map(game => (
            <GameCard key={game.id} game={game} currentUserId={session.userId} className="ring-1 ring-primary/50" />
          ))}
        </section>
      )}

      {toPlay.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Still to play · {toPlay.length}</h2>
          <Card className="py-0 gap-0 divide-y">
            {toPlay.map(g => <GameRow key={g.id} game={g} />)}
          </Card>
        </section>
      )}

      {results.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Results · {results.length}</h2>
          <Card className="py-0 gap-0 divide-y">
            {results.map(g => <GameRow key={g.id} game={g} />)}
          </Card>
        </section>
      )}

      {byePlayers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5" /> Resting this matchday
          </h2>
          <div className="flex flex-wrap gap-2">
            {byePlayers.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                <PlayerAvatar name={p.name} avatarColor={p.avatarColor} className="h-5 w-5" fallbackClassName="text-[9px]" />
                {p.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {session.isAdmin && localOverIssues.length > 0 && (
        <Card className="ring-yellow-400 bg-yellow-50 dark:ring-yellow-500/50 dark:bg-yellow-950/40">
          <CardContent className="py-4 space-y-1.5">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Duplicate pairing in this matchday
            </p>
            <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1 list-disc pl-4">
              {localOverIssues.map((iss, i) => (
                <li key={i}>
                  <span className="font-medium">{iss.aName} vs {iss.bName}</span> meet {iss.count}× across the tournament
                  {iss.matchdayNumbers.length > 0 && <span className="text-yellow-700 dark:text-yellow-400"> (MD {iss.matchdayNumbers.join(', ')})</span>}
                  {' '}— they should meet twice. Edit a game below, or use <span className="font-medium">Regenerate schedule</span> (Admin panel) to rebuild the unplayed matchdays cleanly.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card className="ring-orange-300 bg-orange-50/40 dark:ring-orange-500/50 dark:bg-orange-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Admin: edit line-up</CardTitle>
            <p className="text-sm text-muted-foreground">
              Change who plays whom, add or remove games, and reorder — only while this matchday hasn&apos;t started.
            </p>
          </CardHeader>
          <CardContent>
            <MatchdayEditor
              matchdayId={matchday.id}
              games={dayGames.map(g => ({ id: g.id, homePlayerId: g.homePlayerId, awayPlayerId: g.awayPlayerId }))}
              roster={rosterPlayers}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** The ‹ / › arrow beside the title: the neighbouring matchday, or an invisible spacer at either end. */
function MatchdayStep({ md, dir }: { md: { id: number; number: number } | null; dir: 'prev' | 'next' }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  if (!md) return <span className="w-9 shrink-0" />
  return (
    <Link
      href={`/matchdays/${md.id}`}
      aria-label={`Matchday ${md.number}`}
      title={`Matchday ${md.number}`}
      className="w-9 h-9 shrink-0 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="w-4 h-4" />
    </Link>
  )
}
