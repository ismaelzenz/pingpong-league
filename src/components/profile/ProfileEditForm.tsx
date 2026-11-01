'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApiAction } from '@/hooks/useApiAction'

export default function ProfileEditForm({ currentName }: { currentName: string }) {
  const { run, loading } = useApiAction()
  const [name, setName] = useState(currentName)
  const changed = name.trim() !== '' && name !== currentName

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!changed) return
    await run('/api/profile', { method: 'PATCH', body: { name }, success: 'Profile updated!' })
  }

  return (
    <form onSubmit={handleSave} className="space-y-2">
      <Label htmlFor="name">Display name</Label>
      {/* Save sits beside the field and only lights up once there's a change to save. */}
      <div className="flex gap-2">
        <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
        <Button type="submit" disabled={loading || !changed} variant={changed ? 'default' : 'outline'} className="shrink-0">
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
