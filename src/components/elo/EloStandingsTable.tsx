import PlayerAvatar from '@/components/player/PlayerAvatar'
import PlayerLink from '@/components/player/PlayerLink'
import DeltaText from '@/components/common/DeltaText'
import type { EloStanding } from '@/lib/data/elo'
import { cn, medal, showElo } from '@/lib/utils'

const head = 'px-3 py-3 font-medium text-muted-foreground bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))] shadow-[inset_0_-1px_0_var(--border)] sticky top-[57px] z-10'
const wide = 'hidden sm:table-cell'

/**
 * The ELO ranking, laid out like the league table (`StandingsTable`): same row highlight, sticky
 * headings, and the same phone trim — a phone gets W–L and the rating with its last change under
 * it; from `sm` up, games played, W, L, peak and last change get their own columns.
 * The parent must not clip its overflow, or the sticky heading can't stick.
 */
export default function EloStandingsTable({ standings, currentUserId }: { standings: EloStanding[]; currentUserId: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={cn(head, 'pl-3 pr-1 text-left sm:pl-4')}>#</th>
          <th className={cn(head, 'w-full px-2 text-left')}>Player</th>
          <th className={cn(head, wide, 'text-right')}><abbr title="Rated games played" className="no-underline">GP</abbr></th>
          <th className={cn(head, wide, 'text-right')}><abbr title="Wins" className="no-underline">W</abbr></th>
          <th className={cn(head, wide, 'text-right')}><abbr title="Losses" className="no-underline">L</abbr></th>
          <th className={cn(head, 'text-right sm:hidden')}>W–L</th>
          <th className={cn(head, wide, 'text-right')}><abbr title="Highest rating reached" className="no-underline">Peak</abbr></th>
          <th className={cn(head, wide, 'text-right')}><abbr title="Points from the most recent game" className="no-underline">Last</abbr></th>
          <th className={cn(head, 'pr-4 text-right text-foreground')}>ELO</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((e, i) => {
          const isMe = e.userId === currentUserId
          return (
            <tr key={e.userId} className={cn('border-b last:border-0 transition-colors', isMe ? 'me-tint' : 'hover:bg-muted/30')}>
              <td className={cn('border-l-[3px] py-2.5 pl-2 pr-1 text-center text-muted-foreground tabular-nums sm:pl-3', isMe ? 'me-edge' : 'border-l-transparent')}>
                <span className="inline-block w-7">{medal(i + 1) ?? i + 1}</span>
              </td>
              <td className="max-w-0 px-2 py-2.5">
                <PlayerLink userId={e.userId} currentUserId={currentUserId} className="flex min-w-0 items-center gap-2">
                  <PlayerAvatar name={e.name} avatarColor={e.avatarColor} className="h-7 w-7 shrink-0" fallbackClassName="text-xs" />
                  <span className={cn('truncate font-medium', isMe ? 'me-text' : 'hover:underline')}>
                    {e.name}{isMe && ' (you)'}
                  </span>
                </PlayerLink>
              </td>
              <td className={cn(wide, 'px-3 py-2.5 text-right text-muted-foreground tabular-nums')}>{e.gamesPlayed}</td>
              <td className={cn(wide, 'px-3 py-2.5 text-right text-green-600 dark:text-green-500 tabular-nums')}>{e.wins}</td>
              <td className={cn(wide, 'px-3 py-2.5 text-right text-red-500 tabular-nums')}>{e.losses}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:hidden">
                <span className="text-green-600 dark:text-green-500">{e.wins}</span>
                <span className="text-muted-foreground">–</span>
                <span className="text-red-500">{e.losses}</span>
              </td>
              <td className={cn(wide, 'px-3 py-2.5 text-right text-muted-foreground tabular-nums')}>{showElo(e.peak)}</td>
              <td className={cn(wide, 'px-3 py-2.5 text-right')}>{e.lastDelta != null ? <DeltaText value={e.lastDelta} /> : '—'}</td>
              <td className="py-2.5 pl-3 pr-4 text-right tabular-nums">
                <span className="block text-lg font-bold leading-tight">{showElo(e.rating)}</span>
                {e.lastDelta != null && <DeltaText value={e.lastDelta} className="block text-[11px] sm:hidden" />}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
