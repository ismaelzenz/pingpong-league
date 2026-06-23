'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { toast.error('New passwords do not match'); return }
    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed')
    } else {
      toast.success('Password changed!')
      setCurrent(''); setNext(''); setConfirm('')
    }
    setLoading(false)
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
