import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameStatusBadge from '@/components/game/GameStatusBadge'
import type { GameStatus } from '@/lib/db/schema'

type Player = { id: number; name: string; avatarColor: string | null }

/**
 * One game as a compact list row — both avatars, the pairing and its status. For long lists (the
 * league-wide catch-up backlog) where a full `GameCard` per game would be pages of scrolling.
 */
export default function GameRow({ game }: {
  game: { id: number; status: GameStatus; homePlayer: Player; awayPlayer: Player }
}) {
  return (
    <Link href={`/games/${game.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="flex -space-x-2 shrink-0">
        <PlayerAvatar name={game.homePlayer.name} avatarColor={game.homePlayer.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
        <PlayerAvatar name={game.awayPlayer.name} avatarColor={game.awayPlayer.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
      </div>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {game.homePlayer.name}<span className="font-normal text-muted-foreground"> vs </span>{game.awayPlayer.name}
      </p>
      <GameStatusBadge status={game.status} look="card" />
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  )
}
