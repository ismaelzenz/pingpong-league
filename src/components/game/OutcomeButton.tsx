import { Button } from '@/components/ui/button'

/** One tappable result — "Ana won" over "2–1". Used wherever a score is entered or corrected. */
export default function OutcomeButton({ label, detail, disabled, onClick }: {
  label: string
  detail: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="w-full h-auto flex-col items-center gap-0.5 py-2.5"
    >
      <span className="font-semibold truncate max-w-full">{label}</span>
      <span className="text-xs text-muted-foreground font-mono">{detail}</span>
    </Button>
  )
}
