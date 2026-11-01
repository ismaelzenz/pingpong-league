import type { ScoreboardEntry } from '@/lib/domain/scoreboard'
import type { computePlayerForm } from '@/lib/domain/playerStats'
import SectionCard from '@/components/common/SectionCard'
import FormDots from '@/components/player/FormDots'

/**
 * A player's season at a glance: four headline numbers, one muted line of the rest, and their
 * recent form in the same dots as the scoreboard. Shared by your own profile and other players' pages.
 */
export default function PlayerStatsCard({ stats, form, title = 'This season' }: {
  stats: ScoreboardEntry
  form: ReturnType<typeof computePlayerForm>
  title?: string
}) {
  const tile = (value: React.ReactNode, label: string) => (
    <div className="rounded-lg bg-muted/40 px-2 py-2.5 text-center">
      <p className="text-2xl font-black leading-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
  const ppg = stats.gamesPlayed ? (stats.points / stats.gamesPlayed).toFixed(1) : '0'

  return (
    <SectionCard
      title={
        <span className="flex items-center justify-between gap-3">
          {title}
          <FormDots form={form.form} />
        </span>
      }
      compact
      contentClassName="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile(stats.points, 'Points')}
        {tile(
          <><span className="text-green-600 dark:text-green-500">{stats.victories}</span><span className="text-muted-foreground">–</span><span className="text-red-500">{stats.losses}</span></>,
          'Won–lost',
        )}
        {tile(`${Math.round(form.winPct * 100)}%`, 'Win rate')}
        {tile(ppg, 'Pts / game')}
      </div>
      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {stats.gamesPlayed} played · sets {stats.setsWon}–{stats.setsLost} ({Math.round(form.setWinPct * 100)}%) · best win streak {form.longestWinStreak}
      </p>
    </SectionCard>
  )
}
