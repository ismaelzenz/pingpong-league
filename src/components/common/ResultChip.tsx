import { cn } from '@/lib/utils'

/** The round green "W" / red "L" marker for one game's outcome. `className` sets the letter size. */
export default function ResultChip({ won, className }: { won: boolean; className?: string }) {
  return (
    <span className={cn('w-5 h-5 rounded-full flex items-center justify-center font-bold text-white', won ? 'bg-green-500' : 'bg-red-500', className)}>
      {won ? 'W' : 'L'}
    </span>
  )
}
