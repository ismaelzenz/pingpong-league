'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format, startOfWeek } from 'date-fns'
import { useApiAction } from '@/hooks/useApiAction'

export default function StartDateForm({ tournamentId, initialDate }: { tournamentId: number; initialDate: string | null }) {
  const { run, loading } = useApiAction()
  const [date, setDate] = useState(initialDate ?? '')

  async function save() {
    await run<{ startDate?: string | null }>(`/api/tournaments/${tournamentId}`, {
      method: 'PATCH',
      body: { startDate: date || null },
      success: d => (d.startDate ? 'Start date saved' : 'Start date cleared'),
    })
  }

  const mondayLabel = date
    ? format(startOfWeek(new Date(date), { weekStartsOn: 1 }), 'MMM d, yyyy')
    : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" disabled={loading} />
        <Button variant="outline" size="sm" onClick={save} disabled={loading}>Save start date</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {mondayLabel
          ? `Matchday 1 will be the week of ${mondayLabel}.`
          : 'No start date set — matchday 1 lands the week after you generate the schedule.'}
      </p>
    </div>
  )
}
