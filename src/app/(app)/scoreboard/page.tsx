import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { computeScoreboard } from '@/lib/scoreboard'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export const dynamic = 'force-dynamic'

export default async function ScoreboardPage() {
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

  const scores = await computeScoreboard(tournament.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scoreboard</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Player</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">GP</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">W</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">L</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">SW</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">SL</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, i) => {
                  const initials = entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  const isMe = entry.userId === session.userId
                  return (
                    <tr key={entry.userId} className={`border-b last:border-0 ${isMe ? 'bg-primary/5' : 'hover:bg-muted/30'} transition-colors`}>
                      <td className="px-4 py-3 text-muted-foreground w-8">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className={`font-medium ${isMe ? 'text-primary' : ''}`}>
                            {entry.name}{isMe && ' (you)'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{entry.gamesPlayed}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{entry.victories}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{entry.losses}</td>
                      <td className="px-4 py-3 text-right">{entry.setsWon}</td>
                      <td className="px-4 py-3 text-right">{entry.setsLost}</td>
                      <td className="px-4 py-3 text-right font-bold text-lg">{entry.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        GP = Games Played · W = Victories · L = Losses · SW = Sets Won · SL = Sets Lost · Pts = Points
        <br />
        Scoring: 1 pt per set won + 1 bonus pt for winning the game
      </p>
    </div>
  )
}
