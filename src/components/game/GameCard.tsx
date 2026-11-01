import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deadlineLabel, todayISO } from '@/lib/dates'
import { isUnplayed } from '@/lib/domain/gameStatus'
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
  homePlayer?: { id: number; name: string; avatarColor?: string | null } | null
  awayPlayer?: { id: number; name: string; avatarColor?: string | null } | null
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

  // Playing ahead is allowed, so a not-yet-started matchday doesn't hide the prompt — it only
  // changes how loudly the card asks.
  const canEnter = unplayed && isParticipant
  const due = !!game.isCatchUp || (game.weekStart != null && game.weekStart <= todayISO())
  // Deadline nudge only for the players who still owe the game.
  const deadline = unplayed && isParticipant ? deadlineLabel(game.weekStart ?? null, game.weekEnd ?? null) : null

  return (
    <Card className={cn('relative hover:shadow-md transition-shadow flex flex-col', className)}>
      {/* Stretched overlay link makes the whole card open the game, while the player name links
          and action buttons below sit above it (z-10) and handle their own clicks. */}
      <Link href={`/games/${game.id}`} className="absolute inset-0 z-0" aria-label="View game" />
      <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-2">
          {/* Both players' avatars, overlapping — the same colours as the standings, so a card is
              recognisable at a glance before reading the names. */}
          <div className="flex -space-x-2 shrink-0">
            <PlayerAvatar name={game.homePlayer?.name} avatarColor={game.homePlayer?.avatarColor} className="h-8 w-8 ring-2 ring-card" fallbackClassName="text-[11px]" />
            <PlayerAvatar name={game.awayPlayer?.name} avatarColor={game.awayPlayer?.avatarColor} className="h-8 w-8 ring-2 ring-card" fallbackClassName="text-[11px]" />
          </div>
          <div className="min-w-0 flex-1">
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
              {/* Orange = behind, the same warning colour as the catch-up section; amber = due soon. */}
              {deadline && (
                <span className={cn('ml-1', deadline.overdue ? 'text-orange-600 dark:text-orange-400 font-medium' : deadline.urgent ? 'text-amber-600 dark:text-amber-400 font-medium' : '')}>
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
        {canEnter && (due ? (
          // A game that's due: entering its result is the card's main action, so it looks like one.
          <Link
            href={`/games/${game.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'relative z-10 mt-3 w-fit')}
          >
            Enter result →
          </Link>
        ) : (
          // A future game can be played early, but a button on every upcoming card would drown out
          // the ones that are actually due. Plain hint: a tap falls through to the card's link.
          <p className="mt-2 text-xs text-muted-foreground">Played it early? Enter result →</p>
        ))}
      </CardContent>
    </Card>
  )
}
