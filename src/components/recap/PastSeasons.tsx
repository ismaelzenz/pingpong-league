import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, Trophy } from 'lucide-react'

interface Season {
  id: number
  name: string
  finishedAt: string | null
}

/** Links to every OTHER finished season's recap. Renders nothing if there's only the current one. */
export default function PastSeasons({ seasons, currentId }: { seasons: Season[]; currentId: number }) {
  const others = seasons.filter(s => s.id !== currentId)
  if (others.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">📚 Past seasons</h2>
      <Card>
        <CardContent className="p-0 divide-y">
          {others.map(s => (
            <Link
              key={s.id}
              href={`/recap/${s.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{s.name}</p>
                {s.finishedAt && (
                  <p className="text-xs text-muted-foreground">Finished {format(new Date(s.finishedAt), 'd MMM yyyy')}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
