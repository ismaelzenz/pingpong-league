// The catalogue of push-notification kinds a player can toggle on their profile.
//
// Each `key` doubles as the column name on the `notification_prefs` table (see schema.ts),
// so the UI, the API route, and `sendPush` all speak the same vocabulary. Preferences are
// opt-OUT: a player with no saved row (or a missing field) is treated as opted-in, which
// keeps behaviour identical to before this feature existed.

export const NOTIFICATION_TYPES = [
  {
    key: 'resultToConfirm',
    label: 'Result to confirm',
    description: 'When an opponent enters a score and needs you to confirm it.',
  },
  {
    key: 'resultConfirmed',
    label: 'Result confirmed',
    description: 'When an opponent confirms a result you entered.',
  },
  {
    key: 'resultDisputed',
    label: 'Result disputed',
    description: 'When an opponent disputes your result and it needs re-entering.',
  },
  {
    key: 'weeklyReminder',
    label: 'Weekly reminder',
    description: "A midweek nudge when you still haven't played this matchday's game.",
  },
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key']

export type NotificationPrefs = Record<NotificationType, boolean>

/** Every type enabled — the default for a player who has never changed their settings. */
export function defaultPrefs(): NotificationPrefs {
  return Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, true])) as NotificationPrefs
}

/** Merge a (possibly missing/partial) saved row over the all-on defaults. */
export function withDefaults(row: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const prefs = defaultPrefs()
  if (row) {
    for (const t of NOTIFICATION_TYPES) {
      if (typeof row[t.key] === 'boolean') prefs[t.key] = row[t.key] as boolean
    }
  }
  return prefs
}
