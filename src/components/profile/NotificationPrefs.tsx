'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { NOTIFICATION_TYPES, type NotificationPrefs as Prefs, type NotificationType } from '@/lib/domain/notificationTypes'

// Per-type opt-out toggles. Each switch saves on its own (optimistic; reverts on failure).
// These are account-wide preferences, independent of which device is subscribed.
export default function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial)
  const [busy, setBusy] = useState<NotificationType | null>(null)

  async function toggle(key: NotificationType, value: boolean) {
    const previous = prefs
    setPrefs({ ...prefs, [key]: value })
    setBusy(key)
    try {
      const res = await fetch('/api/notifications/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch {
      setPrefs(previous)
      toast.error('Could not save preference')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {NOTIFICATION_TYPES.map(t => (
        <div key={t.key} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </div>
          <Switch
            checked={prefs[t.key]}
            onCheckedChange={(value) => toggle(t.key, value)}
            disabled={busy === t.key}
            aria-label={t.label}
            className="mt-0.5"
          />
        </div>
      ))}
    </div>
  )
}
