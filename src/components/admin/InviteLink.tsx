'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'

export default function InviteLink({ tournamentId }: { tournamentId: number }) {
  const [copied, setCopied] = useState(false)
  // Built client-side so the link uses whatever host the app is served from.
  const url = typeof window !== 'undefined' ? `${window.location.origin}/join/${tournamentId}` : `/join/${tournamentId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Invite link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} onFocus={e => e.currentTarget.select()} className="font-mono text-xs" />
      <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
      </Button>
    </div>
  )
}
