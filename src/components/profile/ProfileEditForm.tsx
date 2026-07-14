'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiAction } from '@/hooks/useApiAction'

export default function ProfileEditForm({ currentName }: { currentName: string }) {
  const { run, loading } = useApiAction()
  const [name, setName] = useState(currentName)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await run('/api/profile', { method: 'PATCH', body: { name }, success: 'Profile updated!' })
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
