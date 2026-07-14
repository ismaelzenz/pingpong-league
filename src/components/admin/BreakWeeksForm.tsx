'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { X, CalendarOff } from 'lucide-react'
import { mondayOf } from '@/lib/dates'
import { useApiAction } from '@/hooks/useApiAction'

export default function BreakWeeksForm({ tournamentId, initialWeeks }: { tournamentId: number; initialWeeks: string[] }) {
  const { run, loading } = useApiAction()
  const [weeks, setWeeks] = useState<string[]>(initialWeeks)
  const [pick, setPick] = useState('')

  async function save(next: string[]) {
    const data = await run<{ weeks: string[] }>('/api/tournaments/breaks', { body: { tournamentId, weeks: next } })
    if (data) setWeeks(data.weeks)
  }

  function add() {
    if (!pick) return
    const monday = mondayOf(pick)
    if (weeks.includes(monday)) { toast.info('That week is already a break'); setPick(''); return }
    setPick('')
    save([...weeks, monday].sort())
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick any day in a week to skip it (e.g. a holiday break). Matchdays won&apos;t be scheduled
        on these weeks — the schedule simply continues the following week.
      </p>

      {weeks.length > 0 ? (
        <ul className="space-y-1.5">
          {weeks.map(w => (
            <li key={w} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1.5">
              <span className="flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-muted-foreground" />
                Week of {format(new Date(w), 'MMM d, yyyy')}
              </span>
              <button
                type="button"
                onClick={() => save(weeks.filter(x => x !== w))}
                disabled={loading}
                className="text-muted-foreground hover:text-red-600 disabled:opacity-50"
                aria-label="Remove break week"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No breaks — the schedule runs every week.</p>
      )}

      <div className="flex items-center gap-2">
        <Input type="date" value={pick} onChange={e => setPick(e.target.value)} className="w-44" disabled={loading} />
        <Button variant="outline" size="sm" onClick={add} disabled={loading || !pick}>Add break week</Button>
      </div>
    </div>
  )
}
