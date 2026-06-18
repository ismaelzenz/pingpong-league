import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, matchdays, games } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MatchdaysPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const tournament = await db.select().from(tournaments)
    .where(inArray(tournaments.status, ['active', 'finished']))
    .orderBy(tournaments.createdAt)
    .limit(1)
    .then(r => r[0] ?? null)

  if (!tournament) {
    return <div className="text-center py-24 text-muted-foreground">No active tournament yet.</div>
  }

  const allMatchdays = await db.select().from(matchdays)
    .where(eq(matchdays.tournamentId, tournament.id))
    .orderBy(matchdays.number)

  const allGames = await db.select().from(games)
    .where(eq(games.tournamentId, tournament.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matchdays</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      <div className="space-y-3">
        {allMatchdays.map(matchday => {
          const dayGames = allGames.filter(g => g.matchdayId === matchday.id)
          const confirmed = dayGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length
          const pending = dayGames.filter(g => g.status === 'pending').length
          const hasMyGame = dayGames.some(g => g.homePlayerId === session.userId || g.awayPlayerId === session.userId)

          return (
            <Link key={matchday.id} href={`/matchdays/${matchday.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Matchday {matchday.number}</h3>
                        {hasMyGame && (
                          <Badge variant="outline" className="text-xs text-primary border-primary">You play</Badge>
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
