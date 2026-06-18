'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ProfileEditForm({ currentName }: { currentName: string }) {
  const router = useRouter()
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to save')
    } else {
      toast.success('Profile updated!')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading || name === currentName}>
        {loading ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
