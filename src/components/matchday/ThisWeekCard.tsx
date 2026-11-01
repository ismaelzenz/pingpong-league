import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { deadlineLabel, shortRange } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ChevronRight, Coffee } from 'lucide-react'
import type { MatchdayRowData } from '@/components/matchday/MatchdayRow'

/**
 * The matchday that matters right now, at the top of the Matchdays page: the viewer's game (with
 * the button to enter it), the week's deadline, and how far the league has got through it.
 * `label` is "This week", or "Next up" between matchdays.
 */
export default function ThisWeekCard({ row, label, me, gameId }: {
  row: MatchdayRowData
  label: string
  me: { name: string; avatarColor: string | null } | null
  /** The viewer's game this matchday, when they have one. */
  gameId: number | null
}) {
  const { mine } = row
  const deadline = deadlineLabel(row.weekStart, row.weekEnd)
  const pct = row.total ? Math.round((row.played / row.total) * 100) : 0

  return (
    <Card className="ring-primary/40">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
            <h2 className="text-xl font-bold">Matchday {row.number}</h2>
            {row.weekStart && row.weekEnd && <p className="text-sm text-muted-foreground">{shortRange(row.weekStart, row.weekEnd)}</p>}
          </div>
          {deadline && (
            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
              deadline.urgent ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
              {deadline.text}
            </span>
          )}
        </div>

        {mine?.opponent && me ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-10 w-10 ring-2 ring-card" fallbackClassName="text-sm" />
                <PlayerAvatar name={mine.opponent.name} avatarColor={mine.opponent.avatarColor} className="h-10 w-10 ring-2 ring-card" fallbackClassName="text-sm" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">You vs {mine.opponent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {mine.result
                    ? (mine.result.forfeited ? 'Forfeited' : `${mine.result.won ? 'Won' : 'Lost'} ${mine.result.mySets}–${mine.result.oppSets}`)
                    : 'Not played yet'}
                </p>
              </div>
            </div>
            {gameId && !mine.result && (
              <Link href={`/games/${gameId}`} className={cn(buttonVariants({ size: 'sm' }), 'w-full sm:w-auto')}>Enter result →</Link>
            )}
          </div>
        ) : mine?.resting ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <Coffee className="w-4 h-4" /> You&apos;re resting this matchday.
          </p>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">League progress</span>
            <span className="tabular-nums">{row.played}/{row.total} played</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Link href={`/matchdays/${row.id}`} className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          See all fixtures <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
