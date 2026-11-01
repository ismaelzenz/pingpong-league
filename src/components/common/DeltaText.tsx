import { cn, showDelta } from '@/lib/utils'

/** A rating change, signed and coloured: green "+12", red "-8". */
export default function DeltaText({ value, className, title }: { value: number; className?: string; title?: string }) {
  return (
    <span
      className={cn(value === 0 ? 'text-muted-foreground' : value > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium', 'tabular-nums', className)}
      title={title}
    >
      {showDelta(value)}
    </span>
  )
}
