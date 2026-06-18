import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants, games, users, matchdays } from '@/lib/db/schema'
import { eq, or, inArray, and } from 'drizzle-orm'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import JoinTournamentButton from '@/components/JoinTournamentButton'
import GameCard from '@/components/GameCard'
import { computeScoreboard } from '@/lib/scoreboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const tournament = await db.select().from(tournaments)
    .where(inArray(tournaments.status, ['registration', 'active']))
    .orderBy(tournaments.createdAt)
    .limit(1)
    .then(r => r[0] ?? null)

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-6xl">🏓</div>
        <h1 className="text-2xl font-bold">No active tournament</h1>
        <p className="text-muted-foreground">
          {session.isAdmin
            ? 'Head to the Admin panel to create a new tournament.'
            : 'Check back later when the admin creates a new tournament.'}
        </p>
        {session.isAdmin && (
          <Link href="/admin" className={buttonVariants()}>Go to Admin panel</Link>
        )}
      </div>
    )
  }

  const myParticipation = await db.select().from(participants)
    .where(and(eq(participants.tournamentId, tournament.id), eq(participants.userId, session.userId)))
    .then(r => r[0] ?? null)

  const participantCount = await db.select().from(participants)
    .where(eq(participants.tournamentId, tournament.id))
    .then(r => r.length)

  if (tournament.status === 'registration') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">Registration is open</p>
          </div>
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">Registration open</Badge>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="text-5xl">📋</div>
            <div>
              <p className="text-lg font-medium">{participantCount} player{participantCount !== 1 ? 's' : ''} registered</p>
              <p className="text-muted-foreground text-sm mt-1">
                The tournament starts once the admin closes registration and generates the schedule.
              </p>
            </div>
            {myParticipation ? (
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-2 text-sm font-medium">
                ✓ You&apos;re in! Waiting for the tournament to start…
              </div>
            ) : (
              <JoinTournamentButton tournamentId={tournament.id} />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Active tournament
  const myPendingGames = await db.select({
    game: games,
    homePlayer: { id: users.id, name: users.name, email: users.email },
    matchday: { number: matchdays.number, weekStart: matchdays.weekStart },
  })
    .from(games)
    .leftJoin(users, eq(users.id, games.homePlayerId))
    .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
    .where(and(
      eq(games.tournamentId, tournament.id),
      or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
      inArray(games.status, ['pending', 'result_entered', 'postponed'])
    ))
    .limit(5)

  // Enrich with away player names
  const enrichedGames = await Promise.all(myPendingGames.map(async row => {
    const awayPlayer = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, row.game.awayPlayerId)).then(r => r[0])
    return { ...row.game, homePlayer: row.homePlayer, awayPlayer, matchday: row.matchday }
  }))

  const scores = await computeScoreboard(tournament.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-muted-foreground">League in progress</p>
        </div>
        <Badge className="bg-green-600">Active</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My upcoming games</h2>
            <Link href="/matchdays" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {enrichedGames.length > 0 ? (
            enrichedGames.map(game => (
              <GameCard key={game.id} game={game} currentUserId={session.userId} />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm py-8">
                No pending games — you&apos;re all caught up!
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Top standings</h2>
            <Link href="/scoreboard" className="text-sm text-primary hover:underline">Full table</Link>
          </div>
          <Card>
            <CardContent className="pt-4 p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">#</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Player</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Pts</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">W</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">L</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.slice(0, 5).map((entry, i) => (
                    <tr key={entry.userId} className={`border-b last:border-0 ${entry.userId === session.userId ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">
                        {entry.userId === session.userId
                          ? <span className="text-primary">{entry.name} (you)</span>
                          : entry.name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">{entry.points}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{entry.victories}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{entry.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
