import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import PlayerLink from '@/components/player/PlayerLink'
import { cn } from '@/lib/utils'
import { deadlineLabel } from '@/lib/dates'
import { isUnplayed } from '@/lib/gameStatus'
import GameStatusBadge from '@/components/game/GameStatusBadge'
import type { GameStatus } from '@/lib/db/schema'

interface GameWithPlayers {
  id: number
  status: GameStatus
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  submittedBy: number | null
  isCatchUp?: boolean
  weekStart?: string | null
  weekEnd?: string | null
  homePlayer?: { id: number; name: string } | null
  awayPlayer?: { id: number; name: string } | null
  matchday?: { number: number } | null
}

interface Props {
  game: GameWithPlayers
  currentUserId: number
  className?: string
}

export default function GameCard({ game, currentUserId, className }: Props) {
  const hasResult = game.homeSets !== null && game.awaySets !== null

  const isParticipant = currentUserId === game.homePlayerId || currentUserId === game.awayPlayerId
  const unplayed = isUnplayed(game.status)

  // Playing ahead is allowed, so a not-yet-started matchday doesn't hide the prompt.
  const canEnter = unplayed && isParticipant
  // Deadline nudge only for the players who still owe the game.
  const deadline = unplayed && isParticipant ? deadlineLabel(game.weekStart ?? null, game.weekEnd ?? null) : null

  return (
    <Card className={cn('relative hover:shadow-md transition-shadow flex flex-col', className)}>
      {/* Stretched overlay link makes the whole card open the game, while the player name links
          and action buttons below sit above it (z-10) and handle their own clicks. */}
      <Link href={`/games/${game.id}`} className="absolute inset-0 z-0" aria-label="View game" />
      <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-center">
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
              {deadline && (
                <span className={cn('ml-1', deadline.overdue ? 'text-red-600 font-medium' : deadline.urgent ? 'text-yellow-600 font-medium' : '')}>
                  · {deadline.text}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasResult && (
              <span className="text-sm font-mono font-bold">
                {game.homeSets} – {game.awaySets}
              </span>
            )}
            <GameStatusBadge status={game.status} look="card" />
          </div>
        </div>
        {canEnter && (
          // Plain hint (no z-10) so a tap falls through to the card's overlay link → the game page.
          <p className="mt-2 text-xs font-medium text-primary">Enter your result →</p>
        )}
      </CardContent>
    </Card>
  )
}
