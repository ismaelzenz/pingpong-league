import { Fragment } from 'react'
import { Card } from '@/components/ui/card'
import MatchdayRow, { type MatchdayRowData } from '@/components/matchday/MatchdayRow'
import { breakBetween } from '@/lib/dates'

/**
 * Matchday rows in one card, divided by thin lines. Skipped weeks between two neighbouring rows
 * show as a "Break" divider; with `months`, a heading starts each new month (for long stretches).
 * `before` is the matchday just ahead of the first row, so a break right at the top still shows.
 */
export default function MatchdayList({ rows, before, months = false }: {
  rows: MatchdayRowData[]
  before?: MatchdayRowData | null
  months?: boolean
}) {
  if (rows.length === 0) return null
  const monthOf = (r: MatchdayRowData) =>
    r.weekStart ? new Date(r.weekStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''

  return (
    <Card className="py-0 gap-0 divide-y overflow-hidden">
      {rows.map((row, i) => {
        const prev = i === 0 ? before : rows[i - 1]
        // Rows may run either way (upcoming ascends, played descends): compare in date order.
        const [earlier, later] = prev && prev.weekStart && row.weekStart && prev.weekStart > row.weekStart ? [row, prev] : [prev, row]
        const pause = earlier ? breakBetween(earlier.weekEnd, later?.weekStart ?? null) : null
        const newMonth = months && (i === 0 || monthOf(row) !== monthOf(rows[i - 1]))
        return (
          <Fragment key={row.id}>
            {newMonth && (
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">{monthOf(row)}</p>
            )}
            {pause && (
              <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/30">🏖️ Break · {pause}</p>
            )}
            <MatchdayRow row={row} />
          </Fragment>
        )
      })}
    </Card>
  )
}
