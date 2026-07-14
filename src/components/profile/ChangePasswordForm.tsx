'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useApiAction } from '@/hooks/useApiAction'

export default function ChangePasswordForm() {
  const { run, loading } = useApiAction()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { toast.error('New passwords do not match'); return }
    const ok = await run('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: current, newPassword: next },
      success: 'Password changed!',
      refresh: false,
    })
    if (ok) { setCurrent(''); setNext(''); setConfirm('') }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current">Current password</Label>
        <Input id="current" type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">New password</Label>
        <Input id="next" type="password" placeholder="At least 8 characters" value={next} onChange={e => setNext(e.target.value)} minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}
