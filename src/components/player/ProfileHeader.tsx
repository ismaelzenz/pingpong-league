import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { START_ELO } from '@/lib/domain/elo'
import { cn, medal, showElo } from '@/lib/utils'

interface Props {
  player: { name: string; email: string; avatarColor: string | null }
  /** Your own profile: the card takes your own colour, like every "you" highlight. */
  isMe?: boolean
  /** Their place in the season on show; null when they aren't in it. */
  league: { rank: number; of: number; points: number } | null
  /** Their ELO; null before their first rated game. */
  elo: { rating: number; rank: number; of: number; peak: number } | null
}

/**
 * Top of a player page: who they are, plus where they stand in the league and in ELO — each a tile
 * linking to the full table, since "where am I?" is what people open a profile to find out.
 */
export default function ProfileHeader({ player, isMe = false, league, elo }: Props) {
  return (
    <Card className={cn(isMe && 'me-card')}>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar name={player.name} avatarColor={player.avatarColor} className="h-16 w-16 shrink-0" fallbackClassName="text-xl" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{player.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{player.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile
            href="/scoreboard"
            label="League"
            value={league ? `#${league.rank}${medal(league.rank) ? ` ${medal(league.rank)}` : ''}` : '—'}
            detail={league ? `${league.points} pts · of ${league.of}` : 'Not in this season'}
          />
          <Tile
            href="/elo"
            label="ELO"
            value={showElo(elo?.rating ?? START_ELO)}
            detail={elo ? `#${elo.rank} · peak ${showElo(elo.peak)}` : 'No rated games yet'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Tile({ href, label, value, detail }: { href: string; label: string; value: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-accent">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-black leading-tight tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
