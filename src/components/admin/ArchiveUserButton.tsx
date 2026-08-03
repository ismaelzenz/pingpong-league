'use client'

import { Button } from '@/components/ui/button'
import { Archive, ArchiveRestore } from 'lucide-react'
import { useApiAction } from '@/hooks/useApiAction'

export default function ArchiveUserButton({ userId, name, archived }: { userId: number; name: string; archived: boolean }) {
  const { run, loading } = useApiAction()

  if (archived) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        disabled={loading}
        onClick={() => run(`/api/admin/users/${userId}`, { method: 'PATCH', body: { archived: false }, success: `${name} reactivated` })}
      >
        <ArchiveRestore className="w-3.5 h-3.5 mr-1" />
        {loading ? '…' : 'Reactivate'}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
      disabled={loading}
      onClick={() => run(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: { archived: true },
        confirm:
          `Mark ${name} as no longer in the company?\n\n` +
          `They'll be hidden from player pickers (daily tournament, add-player), but kept in all ` +
          `past tournament recaps, standings and stats. You can reactivate them anytime.`,
        success: `${name} archived`,
      })}
    >
      <Archive className="w-3.5 h-3.5 mr-1" />
      {loading ? '…' : 'Mark as left'}
    </Button>
  )
}
