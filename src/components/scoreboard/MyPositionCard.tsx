import { ArrowDown, ArrowUp, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import RankMovement from '@/components/common/RankMovement'
import FormDots from '@/components/player/FormDots'
import type { StandingRow } from '@/lib/domain/standings'

const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`

/**
 * The viewer's own spot in the table, pinned above it: rank, points, record, form, and the gap to
 * the players either side — so nobody has to scroll a 20-row table to find themselves.
 */
export default function MyPositionCard({ standings, userId }: { standings: StandingRow[]; userId: number }) {
  const i = standings.findIndex(s => s.userId === userId)
  if (i === -1) return null
  const me = standings[i]
  const above = standings[i - 1]
  const below = standings[i + 1]

  return (
    <Card className="me-card">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-11 w-11" fallbackClassName="text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide me-text">Your position</p>
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">#{me.rank}</span>
              <span className="text-sm text-muted-foreground">of {standings.length}</span>
              <span className="text-xs tabular-nums"><RankMovement movement={me.movement} quiet /></span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums leading-none">{me.points}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="tabular-nums">
            <span className="font-medium text-green-600 dark:text-green-500">{me.victories}W</span>
            <span className="text-muted-foreground"> – </span>
            <span className="font-medium text-red-500">{me.losses}L</span>
            <span className="text-muted-foreground"> · {me.gamesPlayed} played</span>
          </span>
          <FormDots form={me.form} />
        </div>

        <ul className="space-y-1 border-t me-divider pt-3 text-sm">
          {above ? (
            <li className="flex items-start gap-2">
              <ArrowUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                {above.points === me.points
                  ? <>Level on points with <b className="font-medium">{above.name}</b> (#{above.rank}), behind on tiebreak</>
                  : <>{pts(above.points - me.points)} behind <b className="font-medium">{above.name}</b> (#{above.rank})</>}
              </span>
            </li>
          ) : (
            <li className="flex items-center gap-2 font-medium">
              <Crown className="h-4 w-4 shrink-0 text-yellow-500" /> Top of the table
            </li>
          )}
          {below && (
            <li className="flex items-start gap-2">
              <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                {below.points === me.points
                  ? <>Level on points with <b className="font-medium">{below.name}</b> (#{below.rank}), ahead on tiebreak</>
                  : <>{pts(me.points - below.points)} ahead of <b className="font-medium">{below.name}</b> (#{below.rank})</>}
              </span>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
