'use client'

import { useEffect, useState } from 'react'
import { X, Share } from 'lucide-react'

const DISMISS_KEY = 'ios-install-hint-dismissed'

// Shown only on iPhone/iPad when the app is running in a browser tab (not the installed,
// standalone home-screen app). On iOS a real install is required for notifications and for the
// full-screen experience — and it must be done from Safari, which trips people up. This nudges
// them with the right steps. Renders nothing on non-iOS, in standalone mode, or once dismissed.
export default function IosInstallHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true

    if (isIOS && !isStandalone) {
      const raf = requestAnimationFrame(() => setShow(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="border-b bg-primary/10 text-sm">
      <div className="container mx-auto max-w-5xl px-4 py-2.5 flex items-start gap-3">
        <div className="flex-1 leading-relaxed">
          <span className="font-medium">📱 Install the app for notifications.</span>{' '}
          Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open it from the new icon.
          {' '}Opened this from Teams or another app? First tap <strong>⋯ → Open in Safari</strong>.
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
