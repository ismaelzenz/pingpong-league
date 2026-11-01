import Link from 'next/link'
import { computeEloStandings, listEloGames } from '@/lib/eloLedger'
import { START_ELO } from '@/lib/elo'
import { joinNames, showElo } from '@/lib/utils'

/** How many games the profile summaries show — enough to read a run of form, short enough to scan. */
const RECENT_LIMIT = 10
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ChevronRight } from 'lucide-react'
import ResultChip from '@/components/common/ResultChip'
import DeltaText from '@/components/common/DeltaText'

/**
 * The data behind `EloSummary`. Separate from the component so a page can start it in the same
 * parallel batch as its own queries — an async child component only starts fetching once the page
 * above it has finished, which put these reads at the end of the page's chain.
 */
export async function loadEloSummary(userId: number) {
  const [standings, recent] = await Promise.all([
    computeEloStandings(),
    listEloGames({ userId, limit: RECENT_LIMIT }),
  ])
  return { standings, recent }
}

/**
 * One player's ELO at a glance, for their profile page: where they stand, their best ever, and the
 * last handful of games with what each one cost or earned them. The full table and the comparison
 * chart live on /elo — this is the hook that gets people there.
 */
export default function EloSummary({ userId, possessive, data }: {
  userId: number
  possessive: string
  data: Awaited<ReturnType<typeof loadEloSummary>>
}) {
  const { standings, recent } = data

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
                      <ResultChip won={won} className="shrink-0 text-[10px]" />
                      <span className="truncate text-muted-foreground">
                        vs {joinNames(others.map(p => p.name))}
                        {g.source === 'elo' && <span className="text-xs"> · ELO game</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <DeltaText value={mine.delta} />
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
