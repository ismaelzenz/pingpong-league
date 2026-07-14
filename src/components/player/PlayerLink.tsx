import Link from 'next/link'

interface Props {
  userId: number
  currentUserId?: number
  className?: string
  children: React.ReactNode
}

/** Wraps content in a link to a player's profile page (or your own profile if it's you). */
export default function PlayerLink({ userId, currentUserId, className, children }: Props) {
  const href = userId === currentUserId ? '/profile' : `/players/${userId}`
  return (
    <Link
      href={href}
      className={`hover:opacity-80 transition-opacity ${className ?? ''}`}
    >
      {children}
    </Link>
  )
}
