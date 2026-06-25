import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, matchdays, games, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { analyzeSchedule, suggestFixes } from '@/lib/scheduleHealth'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MatchdaysPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const tournament = await db.select().from(tournaments)
    .where(eq(tournaments.status, 'active'))
    .orderBy(tournaments.createdAt)
    .limit(1)
    .then(r => r[0] ?? null)

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

  const today = new Date().toISOString().split('T')[0]
  const resultMatchdayIds = new Set(
    allGamesRaw.filter(g => ['confirmed', 'forfeited', 'result_entered'].includes(g.status)).map(g => g.matchdayId)
  )
  const editableMatchdayIds = new Set(
    allMatchdays.filter(m => m.weekStart && m.weekStart > today && !resultMatchdayIds.has(m.id)).map(m => m.id)
  )
  const fixes = session.isAdmin && !health.ok
    ? suggestFixes(allGamesRaw, roster, editableMatchdayIds, matchdayNumberById)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matchdays</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      {session.isAdmin && !health.ok && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Schedule needs attention
            </p>
            <p className="text-xs text-yellow-700">
              Every pair should meet exactly twice.
            </p>
            <ul className="text-xs text-yellow-800 space-y-1 list-disc pl-4">
              {health.issues.map((iss, idx) => (
                <li key={idx}>
                  <span className="font-medium">{iss.aName} vs {iss.bName}</span>{' '}
                  {iss.kind === 'over'
                    ? `is scheduled ${iss.count}× (should be 2)`
                    : iss.count === 0
                      ? `is never scheduled (should be 2)`
                      : `is only scheduled ${iss.count}× (should be 2)`}
                  {(iss.matchdayNumbers.length > 0 || iss.catchUpCount > 0) && (
                    <span className="text-yellow-700">
                      {' — '}
                      {iss.matchdayNumbers.map(n => `MD${n}`).join(', ')}
                      {iss.catchUpCount > 0 ? `${iss.matchdayNumbers.length ? ', ' : ''}${iss.catchUpCount} catch-up` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {fixes.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-green-800">Suggested fixes (open the matchday to apply with one click):</p>
                <ul className="text-xs text-green-800 space-y-1 list-disc pl-4 mt-1">
                  {fixes.map((f, idx) => (
                    <li key={idx}>
                      In{' '}
                      <Link href={`/matchdays/${allMatchdays.find(m => m.number === f.matchdayNumber)?.id ?? ''}`} className="font-medium underline">
                        MD{f.matchdayNumber}
                      </Link>
                      , change <span className="font-medium">{f.fromAName} vs {f.fromBName}</span> →{' '}
                      <span className="font-medium">{f.toAName} vs {f.toBName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-yellow-700 pt-1">
              Or use <span className="font-medium">Regenerate schedule</span> on the Admin panel to rebuild all
              unplayed matchdays cleanly at once.
            </p>
          </CardContent>
        </Card>
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
