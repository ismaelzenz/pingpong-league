import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A player's up-to-two-letter uppercase initials for avatar fallbacks, e.g. "Jane Roe" → "JR". */
export function getInitials(name: string | null | undefined): string {
  return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
