import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { matchdays, games, users, participants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import GameCard from '@/components/GameCard'
import MatchdayEditor from '@/components/MatchdayEditor'
import { analyzeSchedule } from '@/lib/scheduleHealth'
import { format } from 'date-fns'
import { ChevronLeft, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MatchdayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const matchday = await db.select().from(matchdays).where(eq(matchdays.id, parseInt(id))).then(r => r[0] ?? null)
  if (!matchday) notFound()

  // Catch-up games are only FK-pinned to a matchday; they aren't part of its line-up.
  const allDayGames = await db.select().from(games).where(eq(games.matchdayId, matchday.id)).orderBy(games.id)
  const dayGames = allDayGames.filter(g => !g.isCatchUp)

  const enriched = await Promise.all(dayGames.map(async g => {
    const homePlayer = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, g.homePlayerId)).then(r => r[0])
    const awayPlayer = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, g.awayPlayerId)).then(r => r[0])
    return { ...g, homePlayer, awayPlayer, matchday: { number: matchday.number } }
  }))

  const confirmed = dayGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length

  // Players enrolled in the tournament who have no game this matchday are on a bye
  // (this is how odd player counts are handled — one or more players sit out each round).
  const roster = await db.select({ id: users.id, name: users.name })
    .from(participants)
    .leftJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.tournamentId, matchday.tournamentId))
  const playingIds = new Set(dayGames.flatMap(g => [g.homePlayerId, g.awayPlayerId]))
  const byePlayers = roster.filter(p => p.id != null && !playingIds.has(p.id))

  // Admins can restructure a matchday's line-up until its week starts.
  const today = new Date().toISOString().split('T')[0]
  const isFuture = !!matchday.weekStart && matchday.weekStart > today
  const canEdit = session.isAdmin && isFuture
  const rosterPlayers = roster.filter(p => p.id != null).map(p => ({ id: p.id!, name: p.name ?? '—' }))

  // Schedule-health check across the whole tournament, narrowed to over-scheduled pairs
  // that appear in this matchday — so an editing admin sees what's wrong here.
  let localOverIssues: { aName: string; bName: string; count: number; matchdayNumbers: number[] }[] = []
  if (session.isAdmin) {
    const tournamentGames = await db.select().from(games).where(eq(games.tournamentId, matchday.tournamentId))
    const tournamentMatchdays = await db.select({ id: matchdays.id, number: matchdays.number })
      .from(matchdays).where(eq(matchdays.tournamentId, matchday.tournamentId))
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
        <Link href="/matchdays" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 -ml-2 px-2 py-1 rounded-md hover:bg-accent transition-colors">
          <ChevronLeft className="w-4 h-4" />
          All matchdays
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Matchday {matchday.number}</h1>
            {matchday.weekStart && matchday.weekEnd && (
              <p className="text-muted-foreground text-sm">
                {format(new Date(matchday.weekStart), 'MMM d')} – {format(new Date(matchday.weekEnd), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <Badge variant="outline">{confirmed}/{dayGames.length} played</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {enriched.map(game => (
          <GameCard key={game.id} game={game} currentUserId={session.userId} />
        ))}
      </div>

      {byePlayers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Bye this matchday:</span>{' '}
          {byePlayers.map(p => p.name).join(', ')}
        </p>
      )}

      {session.isAdmin && localOverIssues.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40">
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
        <Card className="border-orange-200 bg-orange-50/40 dark:border-orange-900 dark:bg-orange-950/30">
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
