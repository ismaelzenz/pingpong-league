import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

interface Props {
  name: string | null | undefined
  avatarColor?: string | null
  /** Sizing classes for the avatar circle, e.g. "h-7 w-7" or "h-14 w-14". */
  className?: string
  /** Extra classes for the initials text, e.g. "text-xs" or "text-base". */
  fallbackClassName?: string
}

/** A player's avatar: their initials on their chosen colour. Used everywhere a player appears. */
export default function PlayerAvatar({ name, avatarColor, className, fallbackClassName }: Props) {
  return (
    <Avatar className={className}>
      <AvatarFallback
        className={cn(avatarColor && 'text-white', fallbackClassName)}
        style={{ backgroundColor: avatarColor ?? undefined }}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
