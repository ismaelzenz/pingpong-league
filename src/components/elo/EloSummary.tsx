import Link from 'next/link'
import { computeEloStandings, listEloGames } from '@/lib/eloLedger'
import { START_ELO } from '@/lib/elo'
import { joinNames, showDelta, showElo } from '@/lib/utils'

/** How many games the profile summaries show — enough to read a run of form, short enough to scan. */
const RECENT_LIMIT = 10
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ChevronRight } from 'lucide-react'

/**
 * One player's ELO at a glance, for their profile page: where they stand, their best ever, and the
 * last handful of games with what each one cost or earned them. The full table and the comparison
 * chart live on /elo — this is the hook that gets people there.
 */
export default async function EloSummary({ userId, possessive }: { userId: number; possessive: string }) {
  const [standings, recent] = await Promise.all([
    computeEloStandings(),
    listEloGames({ userId, limit: RECENT_LIMIT }),
  ])

  const rank = standings.findIndex(s => s.userId === userId)
  const entry = rank >= 0 ? standings[rank] : null

  if (!entry) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ELO rating</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No rated games yet — {possessive} rating starts at {START_ELO}.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">ELO rating</CardTitle>
          <Link href="/elo" className="text-sm text-primary hover:underline inline-flex items-center">
            Full table <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-black text-primary tabular-nums">{showElo(entry.rating)}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums">#{rank + 1}</p>
            <p className="text-xs text-muted-foreground">of {standings.length}</p>
          </div>
          <div>
            <p className="text-3xl font-black text-muted-foreground tabular-nums">{showElo(entry.peak)}</p>
            <p className="text-xs text-muted-foreground">Peak</p>
          </div>
        </div>

        {recent.length > 0 && (
          <>
            <Separator className="my-4" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent swings</p>
            <div className="space-y-1.5">
              {recent.map(g => {
                // The player is on exactly one side; the other side is who they were up against —
                // one name in a 1v1, several in a team game.
                const won = g.winners.some(p => p.userId === userId)
                const mine = (won ? g.winners : g.losers).find(p => p.userId === userId)!
                const others = won ? g.losers : g.winners
                return (
                  <div key={g.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${won ? 'bg-green-500' : 'bg-red-500'}`}>
                        {won ? 'W' : 'L'}
                      </span>
                      <span className="truncate text-muted-foreground">
                        vs {joinNames(others.map(p => p.name))}
                        {g.source === 'elo' && <span className="text-xs"> · ELO game</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className={`font-medium tabular-nums ${mine.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {showDelta(mine.delta)}
                      </span>
                      <span className="w-12 text-right tabular-nums text-muted-foreground">{showElo(mine.ratingAfter)}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
