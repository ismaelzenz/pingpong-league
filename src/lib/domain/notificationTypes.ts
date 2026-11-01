// The catalogue of push-notification kinds a player can toggle on their profile.
//
// Each `key` doubles as the column name on the `notification_prefs` table (see schema.ts),
// so the UI, the API route, and `sendPush` all speak the same vocabulary. Preferences are
// opt-OUT: a player with no saved row (or a missing field) is treated as opted-in, which
// keeps behaviour identical to before this feature existed.

// `resultToConfirm` / `resultConfirmed` / `resultDisputed` used to live here, back when a result
// needed the opponent's approval. Results are auto-approved now, so they're gone from the list —
// their columns survive in the DB only so existing preference rows keep loading.
export const NOTIFICATION_TYPES = [
  {
    key: 'resultRecorded',
    label: 'Result recorded',
    description: 'When an opponent enters the score for one of your games.',
  },
  {
    key: 'resultCorrected',
    label: 'Result corrected',
    description: 'When an opponent changes a score that was already recorded.',
  },
  {
    key: 'gamePostponed',
    label: 'Game postponed',
    description: 'When one of your games is postponed to a later date.',
  },
  {
    key: 'weeklyReminder',
    label: 'Weekly reminder',
    description: "A midweek nudge when you still haven't played this matchday's game.",
  },
] as const

/** A notification kind the player can toggle on their profile (has a column in notification_prefs). */
export type ConfigurableNotificationType = (typeof NOTIFICATION_TYPES)[number]['key']

/**
 * Always-on notification kinds that are NOT user-configurable — one-off, league-level events
 * (e.g. a tournament officially starting). These are never shown in the profile settings and
 * are always delivered regardless of preferences.
 */
export type AlwaysOnNotificationType = 'tournamentStarted'

export type NotificationType = ConfigurableNotificationType | AlwaysOnNotificationType

export type NotificationPrefs = Record<ConfigurableNotificationType, boolean>

const CONFIGURABLE_KEYS = new Set<string>(NOTIFICATION_TYPES.map(t => t.key))

/** True when a type is user-configurable (subject to opt-out); false for always-on types. */
export function isConfigurable(type: NotificationType): type is ConfigurableNotificationType {
  return CONFIGURABLE_KEYS.has(type)
}

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
