import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { cached } from '@/lib/cache'

/**
 * League-wide switches an admin flips at runtime, stored as key/value rows.
 *
 * These are the settings that shouldn't need a deploy to change and don't belong on any existing
 * table. Each has a default in code, so a missing row behaves sensibly rather than erroring — a
 * fresh database and one that simply hasn't had the setting touched are the same thing.
 */
export const SETTINGS = {
  /** Whether the "what's new" note is being shown to members who haven't dismissed it. */
  whatsNewEnabled: { key: 'whats_new_enabled', default: true },
} as const

export async function getBoolSetting(
  setting: { key: string; default: boolean },
): Promise<boolean> {
  const value = await storedValue(setting.key)
  if (value === null) return setting.default
  return value === '1'
}

// Cached across requests: read on every dashboard load, changed a handful of times a season.
const storedValue = cached('setting', ['settings'], async (key: string): Promise<string | null> =>
  db.select({ value: appSettings.value })
    .from(appSettings).where(eq(appSettings.key, key)).then(r => r[0]?.value ?? null))

export async function setBoolSetting(
  setting: { key: string; default: boolean },
  value: boolean,
): Promise<void> {
  const stored = value ? '1' : '0'
  await db.insert(appSettings)
    .values({ key: setting.key, value: stored, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: stored, updatedAt: new Date().toISOString() },
    })
}
