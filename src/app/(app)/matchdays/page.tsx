import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { matchdays, games, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import EmptyState from '@/components/common/EmptyState'
import Disclosure from '@/components/common/Disclosure'
import MatchdayList from '@/components/matchday/MatchdayList'
import ThisWeekCard from '@/components/matchday/ThisWeekCard'
import type { MatchdayRowData, MyMatchday } from '@/components/matchday/MatchdayRow'
import { analyzeSchedule } from '@/lib/domain/scheduleHealth'
import { getLiveTournament } from '@/lib/data/tournaments'
import { todayISO } from '@/lib/dates'
import { isCatchUpBacklog } from '@/lib/domain/backlog'
import { isFinished } from '@/lib/domain/gameStatus'
import { perspective } from '@/lib/domain/gameResult'
import { AlertTriangle, Hourglass, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

/** Upcoming matchdays shown before the rest fold away, and likewise for played ones. */
const SHOW_UPCOMING = 4
const SHOW_PLAYED = 3

export default async function MatchdaysPage() {
  const session = await requireSession()

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    return <EmptyState emoji="🏓" title="No active tournament" hint="Once a season starts, its matchdays and fixtures will appear here." />
  }

  const [allMatchdays, allGamesRaw, rosterRows] = await Promise.all([
    db.select().from(matchdays)
      .where(eq(matchdays.tournamentId, tournament.id))
      .orderBy(matchdays.number),
    db.select().from(games)
      .where(eq(games.tournamentId, tournament.id)),
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournament.id)),
  ])
  const allGames = allGamesRaw.filter(g => !g.isCatchUp) // catch-up games aren't part of any matchday line-up

  // Schedule-health check: did manual edits break the "each pair exactly twice" rule?
  const roster = rosterRows.filter((p): p is { id: number; name: string; avatarColor: string | null } => p.id != null)
  const matchdayNumberById = new Map(allMatchdays.map(m => [m.id, m.number]))
  const health = analyzeSchedule(allGamesRaw, matchdayNumberById, roster.map(({ id, name }) => ({ id, name })))

  const personById = new Map(roster.map(p => [p.id, p]))
  // Only players in the tournament get a personal line; an admin who isn't playing sees counts.
  const me = personById.get(session.userId) ?? null
  const today = todayISO()

  // Per-matchday rows, computed once, plus the viewer's own game in each.
  const myGameIdByMd = new Map<number, number>()
  const rows: MatchdayRowData[] = allMatchdays.map(m => {
    const dayGames = allGames.filter(g => g.matchdayId === m.id)
    const past = !!m.weekEnd && m.weekEnd < today
    let mine: MyMatchday | undefined
    if (me && dayGames.length > 0) {
      const myGame = dayGames.find(g => g.homePlayerId === session.userId || g.awayPlayerId === session.userId)
      if (myGame) {
        myGameIdByMd.set(m.id, myGame.id)
        const opp = personById.get(myGame.homePlayerId === session.userId ? myGame.awayPlayerId : myGame.homePlayerId)
        const p = isFinished(myGame.status) ? perspective(myGame, session.userId) : null
        mine = {
          resting: false,
          me: { name: me.name, avatarColor: me.avatarColor },
          opponent: { name: opp?.name ?? '—', avatarColor: opp?.avatarColor ?? null },
          result: p ? { won: p.won, mySets: p.mySets, oppSets: p.oppSets, forfeited: p.forfeited } : undefined,
          owed: past && !p,
        }
      } else {
        mine = { resting: true }
      }
    }
    return {
      id: m.id, number: m.number, weekStart: m.weekStart, weekEnd: m.weekEnd,
      total: dayGames.length,
      played: dayGames.filter(g => isFinished(g.status)).length,
      past,
      hasIssue: health.matchdayIdsWithIssue.has(m.id),
      mine,
    }
  })

  // The featured matchday: the one whose week contains today — or, between matchdays (a weekend,
  // a break), the next one to start.
  const inProgress = rows.find(r => r.weekStart && r.weekEnd && r.weekStart <= today && today <= r.weekEnd) ?? null
  const featured = inProgress ?? rows.find(r => r.weekStart != null && r.weekStart > today) ?? null
  const upcoming = rows.filter(r => !r.past && r.id !== featured?.id)
  const played = rows.filter(r => r.past && r.id !== featured?.id).reverse() // newest first

  // Season progress, across every regular fixture.
  const seasonPlayed = rows.reduce((n, r) => n + r.played, 0)
  const seasonTotal = rows.reduce((n, r) => n + r.total, 0)
  const seasonPct = seasonTotal ? Math.round((seasonPlayed / seasonTotal) * 100) : 0

  // Catch-up backlog count — everything still to play that isn't this week's fixtures (overdue
  // games from earlier matchdays + any newcomer's catch-up games). Admins see the whole league's
  // count; everyone else only their own. Full list lives on its own page (/matchdays/catch-up).
  const latestStarted = [...allMatchdays].reverse().find(m => m.weekStart != null && m.weekStart <= today)
  const currentMdId = inProgress?.id ?? latestStarted?.id ?? null
  const weekStartByMd = new Map(allMatchdays.map(m => [m.id, m.weekStart]))
  const backlog = allGamesRaw.filter(g => isCatchUpBacklog(g, weekStartByMd, currentMdId, today))
  const backlogCount = session.isAdmin
    ? backlog.length
    : backlog.filter(g => g.homePlayerId === session.userId || g.awayPlayerId === session.userId).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matchdays</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
        {seasonTotal > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{featured ? `Matchday ${featured.number} of ${rows.length}` : `${rows.length} matchdays`}</span>
              <span className="tabular-nums">{seasonPlayed}/{seasonTotal} games played</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary/70" style={{ width: `${seasonPct}%` }} />
            </div>
          </div>
        )}
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

      {featured && (
        <ThisWeekCard
          row={featured}
          label={featured === inProgress ? 'This week' : 'Next up'}
          me={me ? { name: me.name, avatarColor: me.avatarColor } : null}
          gameId={myGameIdByMd.get(featured.id) ?? null}
        />
      )}

      {backlogCount > 0 && (
        <Link href="/matchdays/catch-up" className="block">
          <Card className="border-orange-300 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-500/15 hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-3">
              <Hourglass className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {session.isAdmin
                    ? `${backlogCount} game${backlogCount !== 1 ? 's' : ''} to catch up on across the league`
                    : `You have ${backlogCount} game${backlogCount !== 1 ? 's' : ''} to catch up on`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.isAdmin ? 'See who’s behind and chase them up.' : 'Unplayed games from earlier matchdays — playable anytime.'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coming up</h2>
          <MatchdayList rows={upcoming.slice(0, SHOW_UPCOMING)} before={featured} />
          {upcoming.length > SHOW_UPCOMING && (
            <Disclosure label={`Show ${upcoming.length - SHOW_UPCOMING} more matchdays`}>
              <MatchdayList rows={upcoming.slice(SHOW_UPCOMING)} before={upcoming[SHOW_UPCOMING - 1]} months />
            </Disclosure>
          )}
        </section>
      )}

      {played.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Played</h2>
          <MatchdayList rows={played.slice(0, SHOW_PLAYED)} before={featured} />
          {played.length > SHOW_PLAYED && (
            <Disclosure label={`Show ${played.length - SHOW_PLAYED} earlier matchdays`}>
              <MatchdayList rows={played.slice(SHOW_PLAYED)} before={played[SHOW_PLAYED - 1]} />
            </Disclosure>
          )}
        </section>
      )}
    </div>
  )
}
