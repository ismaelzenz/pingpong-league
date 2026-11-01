import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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
  const row = await db.select({ value: appSettings.value })
    .from(appSettings).where(eq(appSettings.key, setting.key)).then(r => r[0])
  if (!row) return setting.default
  return row.value === '1'
}

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
