'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiAction } from '@/hooks/useApiAction'

export default function CreateTournamentForm() {
  const { run, loading, router } = useApiAction()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const data = await run<{ tournament?: { id: number } }>('/api/tournaments/create', {
      body: { name, startDate: startDate || null },
      success: 'Tournament created!',
      refresh: false,
    })
    if (data) {
      setName('')
      setStartDate('')
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
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create tournament'}
      </Button>
    </form>
  )
}
