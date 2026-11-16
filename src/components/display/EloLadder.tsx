import { Medal } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import type { EloLadderRow } from '@/lib/data/displayElo'
import { cn, showElo } from '@/lib/utils'

// Smart-TV browsers lack emoji fonts, so the board draws its medals as icons.
const TV_MEDAL = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

const head = 'px-[1.2vh] py-[0.4vh] font-medium'
const cell = 'px-[1.2vh] py-[0.15vh] text-[1.9vh]'

function signed(n: number) {
  const r = Math.round(n)
  return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : '0'
}

/**
 * One page of the ELO ladder for the office TV — the same look as the board's standings table
 * (StandingsTable size="tv"), with the rating where the points would be. Fills its parent's height.
 */
export default function EloLadder({ rows }: { rows: EloLadderRow[] }) {
  return (
    <table className="w-full h-full">
      <thead>
        <tr className="border-b border-white/10 text-[1.4vh] text-slate-400">
          <th className={cn(head, 'pl-[1.6vh] pr-1 text-left')}>#</th>
          <th className={cn(head, 'w-full px-2 text-left')}>Player</th>
          <th className={cn(head, 'text-right')}>W</th>
          <th className={cn(head, 'text-right')}>L</th>
          <th className={cn(head, 'text-right')}>Peak</th>
          <th className={cn(head, 'whitespace-nowrap text-right')}>7 days</th>
          <th className={cn(head, 'pr-[1.6vh] text-right font-bold')}>Rating</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(e => (
          <tr key={e.userId} className="border-b border-white/5 last:border-0">
            <td className={cn(cell, 'pl-[1.6vh] pr-1')}>
              <span className="flex w-[2.8vh] justify-center tabular-nums text-[2vh] font-black text-slate-300">
                {e.rank <= 3 ? <Medal className={cn('h-[2.2vh] w-[2.2vh]', TV_MEDAL[e.rank - 1])} strokeWidth={2.2} /> : e.rank}
              </span>
            </td>
            <td className={cn(cell, 'max-w-0 px-2')}>
              <div className="flex min-w-0 items-center gap-[1vh]">
                <PlayerAvatar name={e.name} avatarColor={e.avatarColor} className="h-[2.8vh] w-[2.8vh] shrink-0" fallbackClassName="text-[1.3vh]" />
                <span className="block truncate text-[2.1vh] font-semibold">{e.name}</span>
              </div>
            </td>
            <td className={cn(cell, 'text-right tabular-nums text-green-400 font-semibold')}>{e.wins}</td>
            <td className={cn(cell, 'text-right tabular-nums text-red-400 font-semibold')}>{e.losses}</td>
            <td className={cn(cell, 'text-right tabular-nums text-slate-400')}>{showElo(e.peak)}</td>
            <td className={cn(cell, 'text-right tabular-nums font-semibold',
              Math.round(e.weekDelta) > 0 ? 'text-green-400' : Math.round(e.weekDelta) < 0 ? 'text-red-400' : 'text-slate-500')}>
              {signed(e.weekDelta)}
            </td>
            <td className={cn(cell, 'pr-[1.6vh] text-right tabular-nums text-[2.4vh] font-black')}>{showElo(e.rating)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
