import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown } from 'lucide-react'

const rules = [
  { icon: '🔄', title: 'Double round-robin', body: 'you play everyone twice, once as home and once as away.' },
  { icon: '🏓', title: 'Best of 3 sets', body: 'first to win 2 sets wins the match.' },
  { icon: '📅', title: '1 game per week', body: 'each matchday covers one week.' },
  { icon: '🏆', title: 'Scoring', body: '1 point per set won, +1 bonus point for winning the match. Win 2–0: 3 pts. Win 2–1: 3 pts, opponent gets 1 pt.' },
  { icon: '✅', title: 'Results', body: 'one player enters the score, the opponent confirms it.' },
]

function RulesList() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      {rules.map(rule => (
        <div key={rule.title} className="flex gap-2">
          <span>{rule.icon}</span>
          <span><strong className="text-foreground">{rule.title}</strong> — {rule.body}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The tournament's "how it works" rules. Available to anyone, regardless of
 * tournament status. Pass `collapsible` to render it as an expandable card
 * (handy on pages where it's reference material rather than the main content).
 */
export default function HowItWorks({ collapsible = false }: { collapsible?: boolean }) {
  if (collapsible) {
    return (
      <Card className="py-0 gap-0">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
            How it works
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <RulesList />
          </div>
        </details>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How it works</CardTitle>
      </CardHeader>
      <CardContent>
        <RulesList />
      </CardContent>
    </Card>
  )
}
