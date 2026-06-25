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
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MatchdayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const matchday = await db.select().from(matchdays).where(eq(matchdays.id, parseInt(id))).then(r => r[0] ?? null)
  if (!matchday) notFound()

  const dayGames = await db.select().from(games).where(eq(games.matchdayId, matchday.id)).orderBy(games.id)

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

      {canEdit && (
        <Card className="border-orange-200 bg-orange-50/40">
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
