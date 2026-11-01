import { Badge } from '@/components/ui/badge'
import type { GameStatus } from '@/lib/db/schema'

/**
 * A game's status as a badge. Two looks: `card` — small and colour-coded, for game lists — and
 * `detail`, the larger one heading a game's own page, which also spells out "Not played yet".
 */
const LOOKS = {
  card: {
    pending: { label: 'Pending', className: 'text-xs border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300' },
    // Legacy: results are auto-approved now, so nothing new lands here — only rows from before.
    result_entered: { label: 'Recorded', className: 'text-xs border-green-400 text-green-700 dark:border-green-600 dark:text-green-400' },
    confirmed: { label: 'Recorded', className: 'text-xs border-green-400 text-green-700 dark:border-green-600 dark:text-green-400' },
    postponed: { label: 'Postponed', className: 'text-xs border-blue-400 text-blue-700 dark:border-blue-600 dark:text-blue-400' },
    forfeited: { label: 'Forfeited', className: 'text-xs border-red-400 text-red-600 dark:border-red-600 dark:text-red-400' },
  },
  detail: {
    pending: { label: 'Not played yet', variant: 'outline' },
    result_entered: { label: 'Recorded', variant: 'default' },
    confirmed: { label: 'Recorded', variant: 'default' },
    postponed: { label: 'Postponed', variant: 'secondary' },
    forfeited: { label: 'Forfeited', variant: 'destructive' },
  },
} as const

export default function GameStatusBadge({ status, look }: { status: GameStatus; look: 'card' | 'detail' }) {
  if (look === 'card') {
    const s = LOOKS.card[status] ?? LOOKS.card.pending
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>
  }
  const s = LOOKS.detail[status] ?? LOOKS.detail.pending
  return <Badge variant={s.variant}>{s.label}</Badge>
}
