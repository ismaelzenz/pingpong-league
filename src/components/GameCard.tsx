import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GameStatus } from '@/lib/db/schema'

const statusConfig: Record<GameStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-gray-300 text-gray-600' },
  result_entered: { label: 'Awaiting confirmation', className: 'border-yellow-400 text-yellow-700' },
  confirmed: { label: 'Confirmed', className: 'border-green-400 text-green-700' },
  postponed: { label: 'Postponed', className: 'border-blue-400 text-blue-700' },
  forfeited: { label: 'Forfeited', className: 'border-red-400 text-red-600' },
}

interface GameWithPlayers {
  id: number
  status: GameStatus
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  submittedBy: number | null
  homePlayer?: { id: number; name: string } | null
  awayPlayer?: { id: number; name: string } | null
  matchday?: { number: number } | null
}

interface Props {
  game: GameWithPlayers
  currentUserId: number
}

export default function GameCard({ game, currentUserId }: Props) {
  const config = statusConfig[game.status] ?? statusConfig.pending
  const hasResult = game.homeSets !== null && game.awaySets !== null

  return (
    <Link href={`/games/${game.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                <span className={game.homePlayerId === currentUserId ? 'text-primary' : ''}>{game.homePlayer?.name ?? '—'}</span>
                <span className="text-muted-foreground font-normal"> vs </span>
                <span className={game.awayPlayerId === currentUserId ? 'text-primary' : ''}>{game.awayPlayer?.name ?? '—'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Matchday {game.matchday?.number ?? '?'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasResult && (
                <span className="text-sm font-mono font-bold">
                  {game.homeSets} – {game.awaySets}
                </span>
              )}
              <Badge variant="outline" className={`text-xs ${config.className}`}>
                {config.label}
              </Badge>
            </div>
          </div>
          {game.status === 'result_entered' && game.submittedBy !== currentUserId && (
            <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 rounded px-2 py-1">
              Your opponent entered a result — tap to confirm
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
