import Link from 'next/link'
import { AlertTriangle, Check, ChevronRight, Coffee } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { shortRange } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** The viewer's part in one matchday: their game (opponent, and result once played) or a rest. */
export interface MyMatchday {
  resting: boolean
  opponent?: { name: string; avatarColor: string | null }
  /** Set once the game has a result. */
  result?: { won: boolean; mySets: number; oppSets: number; forfeited: boolean }
  /** The game is still unplayed although its week is over. */
  owed?: boolean
}

export interface MatchdayRowData {
  id: number
  number: number
  weekStart: string | null
  weekEnd: string | null
  total: number
  played: number
  past: boolean
  hasIssue: boolean
  mine?: MyMatchday
}

/**
 * One matchday as a compact list row: its number, dates, the viewer's opponent, and — once the week
 * is over — how it went. Rows sit inside a shared card (see `MatchdayList`), one line each, so a
 * season of 40+ matchdays stays scannable on a phone.
 */
export default function MatchdayRow({ row }: { row: MatchdayRowData }) {
  const { mine } = row
  const unplayed = row.total - row.played
  return (
    <Link href={`/matchdays/${row.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      {/* Finished weeks fade back; anything still in play keeps full contrast. */}
      <span className={cn(
        'w-9 h-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold tabular-nums',
        row.past && unplayed === 0 ? 'text-muted-foreground' : 'text-foreground',
      )}>
        {row.number}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium min-w-0">
          {mine?.opponent ? (
            <>
              <PlayerAvatar name={mine.opponent.name} avatarColor={mine.opponent.avatarColor} className="h-5 w-5 shrink-0" fallbackClassName="text-[9px]" />
              <span className="truncate"><span className="text-muted-foreground font-normal">vs </span>{mine.opponent.name}</span>
            </>
          ) : mine?.resting ? (
            <span className="flex items-center gap-1.5 text-muted-foreground font-normal"><Coffee className="w-4 h-4" /> You rest</span>
          ) : (
            <span>Matchday {row.number}</span>
          )}
          {row.hasIssue && (
            <span title="Scheduling conflict — a pairing here happens more than twice, or a player is double-booked">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            </span>
          )}
        </div>
        {row.weekStart && row.weekEnd && (
          <p className="text-xs text-muted-foreground">{shortRange(row.weekStart, row.weekEnd)}</p>
        )}
      </div>

      <div className="shrink-0 text-right text-xs tabular-nums">
        {mine?.result ? (
          <span className={cn('font-semibold text-sm', mine.result.won ? 'text-green-600 dark:text-green-500' : 'text-red-500')}>
            {mine.result.forfeited ? 'Forfeit' : `${mine.result.won ? 'W' : 'L'} ${mine.result.mySets}–${mine.result.oppSets}`}
          </span>
        ) : mine?.owed ? (
          <span className="font-medium text-orange-600 dark:text-orange-400">To catch up</span>
        ) : null}
        {row.past && (
          unplayed > 0
            // The league's count stays muted — orange is kept for the viewer's own game.
            ? <p className="text-muted-foreground">{unplayed} unplayed</p>
            : !mine?.result && <p className="flex items-center justify-end gap-1 text-muted-foreground"><Check className="w-3.5 h-3.5" /> All played</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  )
}
