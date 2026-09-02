import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { matchdays, games, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import MatchdayListItem from '@/components/common/MatchdayListItem'
import EmptyState from '@/components/common/EmptyState'
import { analyzeSchedule } from '@/lib/scheduleHealth'
import { getLiveTournament } from '@/lib/tournament'
import { todayISO } from '@/lib/dates'
import { isCatchUpBacklog } from '@/lib/backlog'
import { AlertTriangle, Hourglass, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MatchdaysPage() {
  const session = await requireSession()

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    return <EmptyState emoji="🏓" title="No active tournament" hint="Once a season starts, its matchdays and fixtures will appear here." />
  }

  const allMatchdays = await db.select().from(matchdays)
    .where(eq(matchdays.tournamentId, tournament.id))
    .orderBy(matchdays.number)

  const allGamesRaw = await db.select().from(games)
    .where(eq(games.tournamentId, tournament.id))
  const allGames = allGamesRaw.filter(g => !g.isCatchUp) // catch-up games aren't part of any matchday line-up

  // Schedule-health check: did manual edits break the "each pair exactly twice" rule?
  const roster = (await db.select({ id: users.id, name: users.name })
    .from(participants)
    .leftJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.tournamentId, tournament.id)))
    .filter((p): p is { id: number; name: string } => p.id != null)
  const matchdayNumberById = new Map(allMatchdays.map(m => [m.id, m.number]))
  const health = analyzeSchedule(allGamesRaw, matchdayNumberById, roster)

  // For the "You play / You rest" chip: who the viewer faces each matchday (or that they sit out).
  // Only for players actually in the tournament — an admin who isn't a participant sees no chip.
  const nameById = new Map(roster.map(p => [p.id, p.name]))
  const isParticipant = roster.some(p => p.id === session.userId)

  // Per-matchday stats, computed once.
  const rows = allMatchdays.map(m => {
    const dayGames = allGames.filter(g => g.matchdayId === m.id)
    let mine: { resting: boolean; opponent?: string | null } | undefined
    if (isParticipant && dayGames.length > 0) {
      const myGame = dayGames.find(g => g.homePlayerId === session.userId || g.awayPlayerId === session.userId)
      if (myGame) {
        const oppId = myGame.homePlayerId === session.userId ? myGame.awayPlayerId : myGame.homePlayerId
        mine = { resting: false, opponent: nameById.get(oppId) ?? '—' }
      } else {
        mine = { resting: true }
      }
    }
    return {
      m,
      total: dayGames.length,
      confirmed: dayGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length,
      pending: dayGames.filter(g => g.status === 'pending').length,
      hasIssue: health.matchdayIdsWithIssue.has(m.id),
      mine,
    }
  })

  // The "current" matchday: the one whose week contains today, else the latest already started.
  // Used to split the list so the relevant matchdays sit at the top (no scrolling mid-season).
  const today = todayISO()
  const inProgress = allMatchdays.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd)
  const latestStarted = [...allMatchdays].reverse().find(m => m.weekStart != null && m.weekStart <= today)
  const currentMd = inProgress ?? latestStarted ?? null
  const currentNumber = currentMd?.number ?? null

  // Catch-up backlog count — everything still to play that isn't this week's fixtures (overdue
  // games from earlier matchdays + any newcomer's catch-up games). Admins see the whole league's
  // count; everyone else only their own. Full list lives on its own page (/matchdays/catch-up).
  const weekStartByMd = new Map(allMatchdays.map(m => [m.id, m.weekStart]))
  const backlog = allGamesRaw.filter(g => isCatchUpBacklog(g, weekStartByMd, currentMd?.id ?? null, today))
  const backlogCount = session.isAdmin
    ? backlog.length
    : backlog.filter(g => g.homePlayerId === session.userId || g.awayPlayerId === session.userId).length

  const upcoming = currentNumber != null ? rows.filter(r => r.m.number >= currentNumber) : rows
  const past = currentNumber != null ? rows.filter(r => r.m.number < currentNumber).reverse() : []

  const renderRow = (r: (typeof rows)[number]) => (
    <MatchdayListItem
      key={r.m.id}
      id={r.m.id}
      number={r.m.number}
      weekStart={r.m.weekStart}
      weekEnd={r.m.weekEnd}
      total={r.total}
      confirmed={r.confirmed}
      pending={r.pending}
      hasIssue={r.hasIssue}
      isCurrent={r.m.number === currentNumber}
      mine={r.mine}
    />
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matchdays</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      {session.isAdmin && !health.ok && (
        <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Schedule needs attention
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Every pair should meet exactly twice.
            </p>
            <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1 list-disc pl-4">
              {health.issues.map((iss, idx) => (
                <li key={idx}>
                  <span className="font-medium">{iss.aName} vs {iss.bName}</span>{' '}
                  {iss.kind === 'over'
                    ? `is scheduled ${iss.count}× (should be 2)`
                    : iss.count === 0
                      ? `is never scheduled (should be 2)`
                      : `is only scheduled ${iss.count}× (should be 2)`}
                  {(iss.matchdayNumbers.length > 0 || iss.catchUpCount > 0) && (
                    <span className="text-yellow-700 dark:text-yellow-400">
                      {' — '}
                      {iss.matchdayNumbers.map(n => `MD${n}`).join(', ')}
                      {iss.catchUpCount > 0 ? `${iss.matchdayNumbers.length ? ', ' : ''}${iss.catchUpCount} catch-up` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <p className="text-xs text-yellow-700 dark:text-yellow-300 pt-1">
              To fix it, use <span className="font-medium">Regenerate schedule</span> on the Admin panel — it rebuilds
              all unplayed matchdays cleanly in one click, without touching games that already have results.
            </p>
          </CardContent>
        </Card>
      )}

      {backlogCount > 0 && (
        <Link href="/matchdays/catch-up" className="block">
          <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40 hover:shadow-md transition-shadow">
            <CardContent className="py-4 flex items-center gap-3">
              <Hourglass className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-yellow-800 dark:text-yellow-300">
                  {session.isAdmin
                    ? `${backlogCount} game${backlogCount !== 1 ? 's' : ''} to catch up on across the league`
                    : `You have ${backlogCount} game${backlogCount !== 1 ? 's' : ''} to catch up on`}
                </p>
                <p className="text-sm text-yellow-700/90 dark:text-yellow-300/80">
                  {session.isAdmin
                    ? 'Overdue games from earlier matchdays and catch-up games outside the matchday grid — playable anytime.'
                    : 'Your unplayed games from earlier matchdays — playable anytime.'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-yellow-700 dark:text-yellow-400 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {currentNumber != null ? (
        <>
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This week &amp; upcoming</h2>
            <div className="flex flex-col gap-4">
              {upcoming.map(renderRow)}
            </div>
          </section>

          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Played</h2>
              <div className="flex flex-col gap-4">
                {past.map(renderRow)}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(renderRow)}
        </div>
      )}
    </div>
  )
}
