import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * A titled card section — the building block of most pages. `compact` tightens the gap under the
 * title (for sections that are mostly a list); `description` adds the muted explainer line the
 * admin sections use.
 */
export default function SectionCard({ title, description, compact = false, className, contentClassName, children }: {
  title: React.ReactNode
  description?: React.ReactNode
  compact?: boolean
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
