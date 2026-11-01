import { cn } from '@/lib/utils'
import type { FormResult } from '@/lib/domain/standings'

const LABEL: Record<FormResult, string> = { W: 'Won', L: 'Lost', F: 'Forfeit' }

/** A player's recent results as dots, oldest → newest: green win, red loss, hollow red forfeit. */
export default function FormDots({ form, className, dotClassName = 'h-2 w-2' }: { form: FormResult[]; className?: string; dotClassName?: string }) {
  if (form.length === 0) return null
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={`Last ${form.length}: ${form.map(r => LABEL[r]).join(', ')}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full', dotClassName,
            r === 'W' && 'bg-green-500',
            r === 'L' && 'bg-red-500',
            r === 'F' && 'border border-red-500',
          )}
        />
      ))}
    </span>
  )
}
