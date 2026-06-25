import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, matchdays, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'

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

  const allGames = await db.select().from(games)
    .where(eq(games.tournamentId, tournament.id))
    .then(rows => rows.filter(g => !g.isCatchUp)) // catch-up games aren't part of any matchday line-up

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matchdays</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

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
