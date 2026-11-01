import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A player's up-to-two-letter uppercase initials for avatar fallbacks, e.g. "Jane Roe" → "JR". */
export function getInitials(name: string | null | undefined): string {
  return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Join names the way a person would say them: "Bruno", "Bruno & Carla", "Bruno, Carla & Diana".
 * A plain `join(' & ')` reads fine for a pair and badly for a team.
 */
export function joinNames(names: string[]): string {
  if (names.length === 0) return '—'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/**
 * Ratings are stored fractionally (a team game splits one pot between a side's players, which
 * rarely lands on a whole number) but nobody wants to read "1003.37". These round for display only.
 *
 * A consequence worth knowing: the rounded numbers in a team game won't visually sum to zero —
 * three winners shown "+6" against two losers shown "-9" is 18 against 18 on screen but exactly
 * balanced underneath. The stored values are the truth; these are just how they're spelled.
 */
export function showElo(rating: number): string {
  return String(Math.round(rating))
}

/** A rating change with its sign: "+6", "-9", "0". */
export function showDelta(delta: number): string {
  const n = Math.round(delta)
  return n > 0 ? `+${n}` : String(n)
}
