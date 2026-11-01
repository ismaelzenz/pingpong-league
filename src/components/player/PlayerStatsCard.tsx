import { Separator } from '@/components/ui/separator'
import ResultChip from '@/components/common/ResultChip'
import type { ScoreboardEntry } from '@/lib/domain/scoreboard'
import type { computePlayerForm } from '@/lib/domain/playerStats'
import SectionCard from '@/components/common/SectionCard'

/**
 * A player's season at a glance — points and record, sets, rates and recent form. Shared by your own
 * profile and other players' pages; `showGamesPlayed` adds the games count beside the sets.
 */
export default function PlayerStatsCard({ stats, form, showGamesPlayed = false }: {
  stats: ScoreboardEntry
  form: ReturnType<typeof computePlayerForm>
  showGamesPlayed?: boolean
}) {
  const stat = (value: React.ReactNode, label: string, valueClass: string) => (
    <div>
      <p className={valueClass}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )

  return (
    <SectionCard title="Tournament stats" compact>
      <div className="grid grid-cols-3 gap-4 text-center">
        {stat(stats.points, 'Points', 'text-3xl font-black text-primary')}
        {stat(stats.victories, 'Victories', 'text-3xl font-black text-green-600')}
        {stat(stats.losses, 'Losses', 'text-3xl font-black text-red-500')}
      </div>
      <Separator className="my-4" />
      <div className={`grid ${showGamesPlayed ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center`}>
        {showGamesPlayed && stat(stats.gamesPlayed, 'Games', 'text-2xl font-bold')}
        {stat(stats.setsWon, 'Sets Won', 'text-2xl font-bold')}
        {stat(stats.setsLost, 'Sets Lost', 'text-2xl font-bold')}
      </div>
      <Separator className="my-4" />
      <div className="grid grid-cols-4 gap-3 text-center">
        {stat(<>{Math.round(form.winPct * 100)}%</>, 'Win rate', 'text-xl font-bold')}
        {stat(<>{Math.round(form.setWinPct * 100)}%</>, 'Set rate', 'text-xl font-bold')}
        {stat(stats.gamesPlayed ? (stats.points / stats.gamesPlayed).toFixed(1) : '0', 'Pts/game', 'text-xl font-bold')}
        {stat(form.longestWinStreak, 'Best streak', 'text-xl font-bold')}
      </div>
      {form.form.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Recent form</span>
          <div className="flex gap-1">
            {form.form.map((r, i) => <ResultChip key={i} won={r === 'W'} className="text-[10px]" />)}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
