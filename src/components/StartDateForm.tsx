'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format, startOfWeek } from 'date-fns'

export default function StartDateForm({ tournamentId, initialDate }: { tournamentId: number; initialDate: string | null }) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate ?? '')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: date || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success(data.startDate ? 'Start date saved' : 'Start date cleared')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  const mondayOf = date
    ? format(startOfWeek(new Date(date), { weekStartsOn: 1 }), 'MMM d, yyyy')
    : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" disabled={loading} />
        <Button variant="outline" size="sm" onClick={save} disabled={loading}>Save start date</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {mondayOf
          ? `Matchday 1 will be the week of ${mondayOf}.`
          : 'No start date set — matchday 1 lands the week after you generate the schedule.'}
      </p>
    </div>
  )
}
