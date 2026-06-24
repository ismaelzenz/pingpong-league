'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AdminResetPasswordButton({ email, name }: { email: string; name: string }) {
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.resetUrl) throw new Error(data.error ?? 'Failed to generate link')
      setResetUrl(data.resetUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handleCopy() {
    if (!resetUrl) return
    await navigator.clipboard.writeText(resetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (resetUrl) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-xs text-muted-foreground">Share this link privately with {name}. Expires in 24h.</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={resetUrl}
            className="flex-1 text-xs bg-muted rounded px-2 py-1 font-mono truncate border"
          />
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? '✓' : 'Copy'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="link"
      className="h-auto p-0 mt-0.5 text-xs font-normal text-muted-foreground hover:text-foreground"
      disabled={loading}
      onClick={handleGenerate}
    >
      {loading ? 'Generating…' : 'Reset password'}
    </Button>
  )
}
