'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { startOfWeek, format } from 'date-fns'
import { X, CalendarOff } from 'lucide-react'

export default function BreakWeeksForm({ tournamentId, initialWeeks }: { tournamentId: number; initialWeeks: string[] }) {
  const router = useRouter()
  const [weeks, setWeeks] = useState<string[]>(initialWeeks)
  const [pick, setPick] = useState('')
  const [loading, setLoading] = useState(false)

  async function save(next: string[]) {
    setLoading(true)
    try {
      const res = await fetch('/api/tournaments/breaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, weeks: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setWeeks(data.weeks)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  function add() {
    if (!pick) return
    const monday = format(startOfWeek(new Date(pick), { weekStartsOn: 1 }), 'yyyy-MM-dd')
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
