'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useApiAction } from '@/hooks/useApiAction'

export default function CreateTournamentForm() {
  const { run, loading, router } = useApiAction()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  // On by default: a real season is the common case, and the damage runs the wrong way — a test
  // copy that quietly moved everyone's rating is far worse than a real season that needs a toggle.
  const [countsForElo, setCountsForElo] = useState(true)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const data = await run<{ tournament?: { id: number } }>('/api/tournaments/create', {
      body: { name, startDate: startDate || null, countsForElo },
      success: 'Tournament created!',
      refresh: false,
    })
    if (data) {
      setName('')
      setStartDate('')
      setCountsForElo(true)
      // Jump straight to managing the new tournament.
      if (data.tournament?.id) router.push(`/admin?t=${data.tournament.id}`)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tournament name</Label>
        <Input id="name" placeholder="e.g. Office Ping Pong League 2025"
          value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">Start date <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Matchday 1 lands on the week of this date. Leave blank to start the week after you generate the schedule.
        </p>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Count for ELO</p>
          <p className="text-xs text-muted-foreground">
            Results move players&apos; lifetime ELO ratings. Turn this <strong>off</strong> for a test or
            bug-repro copy — otherwise its games shift real ratings with results nobody played. This
            can&apos;t be changed once games have been rated without rebuilding the ratings.
          </p>
        </div>
        <Switch
          checked={countsForElo}
          onCheckedChange={v => setCountsForElo(v)}
          aria-label="Count for ELO"
          className="mt-0.5"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create tournament'}
      </Button>
    </form>
  )
}
