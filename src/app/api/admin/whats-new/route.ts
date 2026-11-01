import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/api'
import { SETTINGS, setBoolSetting } from '@/lib/services/settings'
import { isNotNull } from 'drizzle-orm'
import { afterSettingsChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

/**
 * Admin control over the "what's new" note: switch it on or off for the league, and optionally
 * put it back in front of people who have already dismissed it.
 *
 * Those are two separate actions on purpose. Toggling the switch shouldn't quietly re-announce to
 * everyone who already read it — an admin flipping it off and on to check something would spam the
 * whole league. Re-showing is its own explicit request.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { enabled, resetDismissals } = json as
    { enabled?: boolean; resetDismissals?: boolean }

  if (typeof enabled === 'boolean') {
    await setBoolSetting(SETTINGS.whatsNewEnabled, enabled)
  }

  let reset = 0
  if (resetDismissals === true) {
    // Clearing the flag is what makes it unseen again — `shouldShowWhatsNew` compares it to the
    // current release version, so null means "hasn't read this one".
    const rows = await db.update(users)
      .set({ whatsNewSeen: null })
      .where(isNotNull(users.whatsNewSeen))
      .returning({ id: users.id })
    reset = rows.length
  }

  afterSettingsChange()
  return NextResponse.json({ ok: true, enabled, reset })
}
