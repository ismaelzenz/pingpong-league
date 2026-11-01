import { Card, CardContent } from '@/components/ui/card'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import PlayerLink from '@/components/player/PlayerLink'
import DeltaText from '@/components/common/DeltaText'
import type { GameStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

type Player = { id: number; name: string; avatarColor: string | null }

interface Props {
  game: { status: GameStatus; homeSets: number | null; awaySets: number | null }
  home: Player
  away: Player
  viewerId: number
  /** Each player's rating change from this game, once it's been rated. */
  eloDelta: Map<number, number>
  /** The muted line under the score: who recorded it and when, or why there's no score. */
  footer?: React.ReactNode
}

/**
 * The game itself: both players face to face with the score between them. The winner's side is
 * bold with a "W", the loser's recedes — red/green numbers read as right/wrong rather than won/lost.
 * The viewer is "You" with a ring in their own colour, so a long name never has to wrap around "(you)".
 */
export default function GameScoreCard({ game, home, away, viewerId, eloDelta, footer }: Props) {
  const scored = game.status === 'confirmed' && game.homeSets != null && game.awaySets != null
  const winnerId = scored ? (game.homeSets! > game.awaySets! ? home.id : away.id) : null

  const side = (p: Player) => {
    const isMe = p.id === viewerId
    const won = winnerId === p.id
    const lost = winnerId != null && !won
    const delta = eloDelta.get(p.id)
    return (
      <PlayerLink userId={p.id} currentUserId={viewerId} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
        <PlayerAvatar
          name={p.name}
          avatarColor={p.avatarColor}
          className={cn('h-14 w-14', isMe && 'ring-2 me-ring ring-offset-2 ring-offset-card', lost && 'opacity-60')}
          fallbackClassName="text-base"
        />
        <div className="w-full min-w-0">
          <p className={cn('flex items-center justify-center gap-1.5 text-base', lost ? 'font-medium text-muted-foreground' : 'font-bold', isMe && !lost && 'me-text')}>
            <span className="line-clamp-2 break-words" title={p.name}>{isMe ? 'You' : p.name}</span>
            {won && <span className="shrink-0 rounded bg-green-500/15 px-1 text-[10px] font-bold text-green-600 dark:text-green-500">W</span>}
          </p>
          {delta != null && <p className="text-xs"><DeltaText value={delta} /> <span className="text-muted-foreground">ELO</span></p>}
        </div>
      </PlayerLink>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2">
          {side(home)}
          <div className="flex h-14 shrink-0 items-center px-1">
            {scored ? (
              <p className="flex items-center gap-2 text-4xl font-black tabular-nums">
                <span className={cn(winnerId !== home.id && 'text-muted-foreground')}>{game.homeSets}</span>
                <span className="text-2xl text-muted-foreground">–</span>
                <span className={cn(winnerId !== away.id && 'text-muted-foreground')}>{game.awaySets}</span>
              </p>
            ) : (
              <span className="text-2xl font-black text-muted-foreground">vs</span>
            )}
          </div>
          {side(away)}
        </div>
        {footer && <div className="border-t pt-3 text-center text-xs text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  )
}
