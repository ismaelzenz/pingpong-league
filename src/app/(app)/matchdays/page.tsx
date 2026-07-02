import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { matchdays, games, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import GameCard from '@/components/GameCard'
import { analyzeSchedule } from '@/lib/scheduleHealth'
import { getLiveTournament } from '@/lib/tournament'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MatchdaysPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="text-5xl">🏓</div>
        <p className="text-muted-foreground">No active tournament. Check back once one starts!</p>
      </div>
    )
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

  // Catch-up games live outside the regular matchday grid, so they never show inside a
  // matchday. List them here so everyone (and especially admins, who can forfeit them from
  // the game page) can find them. Unplayed first, then any already settled.
  const nameById = new Map(roster.map(p => [p.id, p.name]))
  const catchUpGames = allGamesRaw
    .filter(g => g.isCatchUp)
    .map(g => ({
      ...g,
      homePlayer: { id: g.homePlayerId, name: nameById.get(g.homePlayerId) ?? '—' },
      awayPlayer: { id: g.awayPlayerId, name: nameById.get(g.awayPlayerId) ?? '—' },
    }))
    .sort((a, b) => {
      const done = (s: string) => (s === 'confirmed' || s === 'forfeited' ? 1 : 0)
      return done(a.status) - done(b.status)
    })

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

      {catchUpGames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-yellow-700 dark:text-yellow-400">⏳ Catch-up games</h2>
            <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">{catchUpGames.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            Owed games that sit outside the regular matchdays (a newcomer&apos;s backlog). They&apos;re
            playable anytime{session.isAdmin ? ' — open one to enter a result, postpone, or forfeit it' : ''}.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catchUpGames.map(game => (
              <GameCard key={game.id} game={game} currentUserId={session.userId} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {allMatchdays.map(matchday => {
          const dayGames = allGames.filter(g => g.matchdayId === matchday.id)
          const confirmed = dayGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length
          const pending = dayGames.filter(g => g.status === 'pending').length

          return (
            <Link key={matchday.id} href={`/matchdays/${matchday.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Matchday {matchday.number}</h3>
                        {health.matchdayIdsWithIssue.has(matchday.id) && (
                          <span title="Scheduling conflict — a pairing here happens more than twice, or a player is double-booked">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          </span>
                        )}
                      </div>
                      {matchday.weekStart && matchday.weekEnd && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(matchday.weekStart), 'MMM d')} – {format(new Date(matchday.weekEnd), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">{confirmed}/{dayGames.length} played</p>
                      {pending > 0 && <p className="text-xs text-yellow-600">{pending} pending</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
