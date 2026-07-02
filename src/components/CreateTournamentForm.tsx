'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function CreateTournamentForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/tournaments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startDate: startDate || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to create')
    } else {
      toast.success('Tournament created!')
      setName('')
      setStartDate('')
      // Jump straight to managing the new tournament.
      if (data.tournament?.id) router.push(`/admin?t=${data.tournament.id}`)
      router.refresh()
    }
    setLoading(false)
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
