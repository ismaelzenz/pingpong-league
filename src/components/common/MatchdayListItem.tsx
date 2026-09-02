import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatWeekRange } from '@/lib/dates'
import { AlertTriangle, Coffee } from 'lucide-react'

/** The viewing player's involvement in this matchday: playing (with their opponent) or resting. */
export interface MyMatchdayStatus {
  resting: boolean
  opponent?: string | null
}

interface Props {
  id: number
  number: number
  weekStart: string | null
  weekEnd: string | null
  total: number
  confirmed: number
  pending: number
  hasIssue: boolean
  isCurrent?: boolean
  /** The current player's status for this matchday. Omitted for non-participants (e.g. an admin
   *  who isn't in the tournament), who see no personal play/rest chip. */
  mine?: MyMatchdayStatus
}

// A single matchday row in the Matchdays list. The current matchday is highlighted so it stands
// out at the top of the list instead of being buried mid-season.
export default function MatchdayListItem({ id, number, weekStart, weekEnd, total, confirmed, pending, hasIssue, isCurrent, mine }: Props) {
  return (
    <Link href={`/matchdays/${id}`} className="block">
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">Matchday {number}</h3>
                {isCurrent && <Badge className="bg-primary text-primary-foreground text-xs">This week</Badge>}
                {mine && (mine.resting
                  ? <Badge variant="outline" className="text-xs gap-1 text-muted-foreground"><Coffee className="w-3 h-3" /> You rest</Badge>
                  : <Badge variant="secondary" className="text-xs">You vs {mine.opponent ?? '—'}</Badge>
                )}
                {hasIssue && (
                  <span title="Scheduling conflict — a pairing here happens more than twice, or a player is double-booked">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  </span>
                )}
              </div>
              {weekStart && weekEnd && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatWeekRange(weekStart, weekEnd)}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm text-muted-foreground">{confirmed}/{total} played</p>
              {pending > 0 && <p className="text-xs text-yellow-600">{pending} pending</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
