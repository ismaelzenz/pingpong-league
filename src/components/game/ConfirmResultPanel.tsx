import { Button } from '@/components/ui/button'

/**
 * The "Record this?" step between picking an outcome and saving it. Results count the moment they're
 * saved — on the scoreboard and in everyone's ELO — so one glance at what's about to be recorded is
 * worth the extra tap. `score` is the line being confirmed; `note` says what happens next.
 */
export default function ConfirmResultPanel({ score, note, confirmLabel, loading, onConfirm, onBack }: {
  score: React.ReactNode
  note: React.ReactNode
  confirmLabel: string
  loading: boolean
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Record this?</p>
        <p className="mt-1 font-semibold">{score}</p>
        <p className="text-xs text-muted-foreground mt-1">{note}</p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={loading} onClick={onConfirm}>
          {loading ? 'Recording…' : confirmLabel}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={loading}>Back</Button>
      </div>
    </div>
  )
}
