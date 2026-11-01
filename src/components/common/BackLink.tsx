import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The "‹ Somewhere" link above a detail page's title. */
export default function BackLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-2 px-2 py-1 rounded-md hover:bg-accent transition-colors', className)}
    >
      <ChevronLeft className="w-4 h-4" />
      {children}
    </Link>
  )
}
