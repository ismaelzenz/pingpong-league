import type { ReactNode } from 'react'

// A friendly placeholder for empty lists/screens — an emoji, a short line, and an optional hint
// or action — instead of a bare "nothing here" sentence.
export default function EmptyState({
  emoji = '🏓', title, hint, children,
}: { emoji?: string; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
      <div className="text-4xl">{emoji}</div>
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-muted-foreground max-w-xs">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
