'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useApiAction } from '@/hooks/useApiAction'

export default function AdminResetPasswordButton({ email, name }: { email: string; name: string }) {
  const { run, loading } = useApiAction()
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const data = await run<{ resetUrl?: string }>('/api/auth/forgot-password', { body: { email }, refresh: false })
    if (!data) return
    if (data.resetUrl) setResetUrl(data.resetUrl)
    else toast.error('Failed to generate link')
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
