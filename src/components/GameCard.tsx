import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PlayerLink from '@/components/PlayerLink'
import type { GameStatus } from '@/lib/db/schema'

const statusConfig: Record<GameStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300' },
  result_entered: { label: 'Awaiting confirmation', className: 'border-yellow-400 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400' },
  confirmed: { label: 'Confirmed', className: 'border-green-400 text-green-700 dark:border-green-600 dark:text-green-400' },
  postponed: { label: 'Postponed', className: 'border-blue-400 text-blue-700 dark:border-blue-600 dark:text-blue-400' },
  forfeited: { label: 'Forfeited', className: 'border-red-400 text-red-600 dark:border-red-600 dark:text-red-400' },
}

interface GameWithPlayers {
  id: number
  status: GameStatus
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  submittedBy: number | null
  isCatchUp?: boolean
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
    <Card className="relative hover:shadow-md transition-shadow">
      {/* Stretched overlay link makes the whole card open the game, while the
          player name links below sit above it (z-10) and navigate to profiles. */}
      <Link href={`/games/${game.id}`} className="absolute inset-0 z-0" aria-label="View game" />
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              <PlayerLink userId={game.homePlayerId} currentUserId={currentUserId} className={`relative z-10 hover:underline ${game.homePlayerId === currentUserId ? 'text-primary' : ''}`}>
                {game.homePlayer?.name ?? '—'}
              </PlayerLink>
              <span className="text-muted-foreground font-normal"> vs </span>
              <PlayerLink userId={game.awayPlayerId} currentUserId={currentUserId} className={`relative z-10 hover:underline ${game.awayPlayerId === currentUserId ? 'text-primary' : ''}`}>
                {game.awayPlayer?.name ?? '—'}
              </PlayerLink>
            </p>
            <p className="text-xs text-muted-foreground">
              {game.isCatchUp ? 'Catch-up game' : `Matchday ${game.matchday?.number ?? '?'}`}
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
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 bg-yellow-50 dark:bg-yellow-950/40 rounded px-2 py-1">
            Your opponent entered a result — tap to confirm
          </p>
        )}
      </CardContent>
    </Card>
  )
}
