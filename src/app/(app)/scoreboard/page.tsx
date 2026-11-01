import { requireSession } from '@/lib/session'
import Link from 'next/link'
import { computeStandingsWithMovement } from '@/lib/standings'
import { getLiveTournament } from '@/lib/tournament'
import { getLatestFinishedTournament } from '@/lib/recap'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import EmptyState from '@/components/common/EmptyState'
import RankMovement from '@/components/common/RankMovement'
import { medal } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ScoreboardPage() {
  const session = await requireSession()

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    const lastFinished = await getLatestFinishedTournament()
    return (
      <EmptyState emoji="🏓" title="No active tournament" hint="Check back once a season is underway — the standings will show up here.">
        {lastFinished && (
          <Link href="/recap" className={buttonVariants()}>🏆 View {lastFinished.name} recap</Link>
        )}
      </EmptyState>
    )
  }

  const scores = await computeStandingsWithMovement(tournament.id)

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
                  <th className="text-left pl-4 pr-1 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left pl-1 pr-4 py-3 font-medium text-muted-foreground w-full">Player</th>
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
                  const isMe = entry.userId === session.userId
                  return (
                    <tr key={entry.userId} className={`border-b last:border-0 ${isMe ? 'bg-primary/5' : 'hover:bg-muted/30'} transition-colors`}>
                      <td className="pl-4 pr-1 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-7 text-center shrink-0 text-muted-foreground">{medal(i + 1) ?? i + 1}</span>
                          <span className="w-7 shrink-0 text-xs tabular-nums text-center">
                            <RankMovement movement={entry.movement} />
                          </span>
                        </div>
                      </td>
                      <td className="pl-1 pr-4 py-3">
                        <PlayerLink userId={entry.userId} currentUserId={session.userId} className="flex items-center gap-2 w-fit">
                          <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-7 w-7" fallbackClassName="text-xs" />
                          <span className={`font-medium ${isMe ? 'text-primary' : 'hover:underline'}`}>
                            {entry.name}{isMe && ' (you)'}
                          </span>
                        </PlayerLink>
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
        Scoring: 1 pt per set won + 1 bonus pt for winning the game · ▲▼ = rank change this matchday
      </p>
    </div>
  )
}
