'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Bell, BellOff } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function NotificationToggle() {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC) {
        setSupported(false); setReady(true); return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      } catch { /* ignore */ }
      setReady(true)
    })()
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { toast.error('Notifications are blocked in your browser settings'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('Failed to save subscription')
      setSubscribed(true)
      toast.success('Notifications enabled')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not enable notifications')
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Notifications turned off')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setBusy(false)
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t available here. On iPhone, install the app first
        (browser menu → Add to Home Screen), then open it and enable them.
      </p>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Get a nudge when an opponent enters a result to confirm, and when yours is confirmed.
      </p>
      {subscribed ? (
        <Button variant="outline" size="sm" onClick={disable} disabled={busy || !ready} className="shrink-0">
          <BellOff className="w-4 h-4 mr-1" /> Turn off
        </Button>
      ) : (
        <Button size="sm" onClick={enable} disabled={busy || !ready} className="shrink-0">
          <Bell className="w-4 h-4 mr-1" /> Enable
        </Button>
      )}
    </div>
  )
}
