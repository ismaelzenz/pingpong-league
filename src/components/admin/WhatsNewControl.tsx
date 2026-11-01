'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useApiAction } from '@/hooks/useApiAction'
import { RotateCcw } from 'lucide-react'

interface Props {
  enabled: boolean
  /** How many members have dismissed the current note — what "show it again" would undo. */
  dismissedCount: number
  totalMembers: number
}

/**
 * Admin control for the "what's new" note.
 *
 * The switch and the re-show button are separate actions deliberately: flipping the switch off and
 * on to check something shouldn't re-announce to the whole league, so putting it back in front of
 * people who already read it has to be asked for outright.
 */
export default function WhatsNewControl({ enabled, dismissedCount, totalMembers }: Props) {
  const { run, loading } = useApiAction()

  const toggle = (next: boolean) =>
    run('/api/admin/whats-new', {
      method: 'PATCH',
      body: { enabled: next },
      success: next ? 'Banner is showing' : 'Banner hidden',
    })

  const reshow = () =>
    run<{ reset?: number }>('/api/admin/whats-new', {
      method: 'PATCH',
      body: { resetDismissals: true },
      confirm: `Show the banner again to all ${dismissedCount} ${dismissedCount === 1 ? 'member who has' : 'members who have'} already dismissed it?`,
      success: d => `Showing again to ${d.reset ?? 0} member${d.reset === 1 ? '' : 's'}`,
    })

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Show the banner</p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? `Showing to members who haven’t dismissed it — ${totalMembers - dismissedCount} of ${totalMembers} still to see it.`
              : 'Hidden from everyone, whether they’ve dismissed it or not.'}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={loading}
          aria-label="Show the what's new banner"
          className="mt-0.5"
        />
      </div>

      {dismissedCount > 0 && (
        <div className="flex items-center gap-3 border-t pt-3">
          <Button size="sm" variant="outline" onClick={reshow} disabled={loading}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Show again to everyone
          </Button>
          <span className="text-xs text-muted-foreground">
            {dismissedCount} {dismissedCount === 1 ? 'member has' : 'members have'} dismissed it.
          </span>
        </div>
      )}
    </div>
  )
}
