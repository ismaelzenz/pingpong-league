import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameStatusBadge from '@/components/game/GameStatusBadge'
import { cn } from '@/lib/utils'
import type { GameStatus } from '@/lib/db/schema'

type Player = { id: number; name: string; avatarColor: string | null }

/**
 * One game as a compact list row — both avatars, the pairing, and either its score (played: the
 * winner in bold) or its status (still to play). For long lists — a matchday's fixtures, the
 * league-wide catch-up backlog — where a full `GameCard` per game would be pages of scrolling.
 */
export default function GameRow({ game, label, current = false }: {
  game: { id: number; status: GameStatus; homeSets: number | null; awaySets: number | null; homePlayer: Player; awayPlayer: Player }
  /** A muted line under the pairing, e.g. "Matchday 4". */
  label?: string
  /** The game the page is about, in a list of its siblings: tinted, and marked "This game". */
  current?: boolean
}) {
  const played = game.status === 'confirmed' && game.homeSets != null && game.awaySets != null
  const homeWon = played && game.homeSets! > game.awaySets!
  const name = (p: Player, won: boolean) => (
    <span className={cn(played && (won ? 'font-semibold' : 'font-normal text-muted-foreground'))}>{p.name}</span>
  )

  return (
    <Link href={`/games/${game.id}`} aria-current={current ? 'page' : undefined} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', current ? 'me-tint' : 'hover:bg-muted/40')}>
      <div className="flex -space-x-2 shrink-0">
        <PlayerAvatar name={game.homePlayer.name} avatarColor={game.homePlayer.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
        <PlayerAvatar name={game.awayPlayer.name} avatarColor={game.awayPlayer.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {name(game.homePlayer, homeWon)}<span className="font-normal text-muted-foreground"> vs </span>{name(game.awayPlayer, played && !homeWon)}
        </p>
        {(label || current) && (
          <p className="truncate text-xs text-muted-foreground">
            {label}{current && <span className="font-medium me-text">{label ? ' · ' : ''}This game</span>}
          </p>
        )}
      </div>
      {played
        ? <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{game.homeSets} – {game.awaySets}</span>
        : <GameStatusBadge status={game.status} look="card" />}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  )
}
