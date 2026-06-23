import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { matchdays, games, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import GameCard from '@/components/GameCard'
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
    </div>
  )
}
