import type { GameStatus } from '@/lib/db/schema'

/**
 * What a game's status means, in one place.
 *
 * `result_entered` belongs to neither group: it's the old enter-then-confirm limbo. Results are
 * recorded as `confirmed` straight away now and the migration promoted every leftover row, so no
 * game is in that state any more — the value survives only in the schema's enum.
 */

/** Has a result on the books — played (`confirmed`) or awarded as a no-show (`forfeited`). */
export const FINISHED_STATUSES = ['confirmed', 'forfeited'] as const satisfies readonly GameStatus[]

/** Still to be played — scheduled (`pending`) or pushed back (`postponed`). */
export const UNPLAYED_STATUSES = ['pending', 'postponed'] as const satisfies readonly GameStatus[]

export function isFinished(status: GameStatus): boolean {
  return (FINISHED_STATUSES as readonly GameStatus[]).includes(status)
}

export function isUnplayed(status: GameStatus): boolean {
  return (UNPLAYED_STATUSES as readonly GameStatus[]).includes(status)
}
