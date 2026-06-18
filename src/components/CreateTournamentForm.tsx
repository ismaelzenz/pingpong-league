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
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/tournaments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to create')
    } else {
      toast.success('Tournament created!')
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
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create tournament'}
      </Button>
    </form>
  )
}
