import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notificationPrefs } from '@/lib/db/schema'
import { requireUser } from '@/lib/apiAuth'
import { NOTIFICATION_TYPES, withDefaults, type ConfigurableNotificationType } from '@/lib/notificationTypes'
import { eq } from 'drizzle-orm'
// cache: private — writes only the member's notification preferences, which no cached read includes (see lib/cache.ts).

export const dynamic = 'force-dynamic'

// Return the current user's notification preferences, filling any missing type with its
// default (on). A user who has never saved gets an all-on object.
export async function GET() {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const row = await db.select().from(notificationPrefs)
    .where(eq(notificationPrefs.userId, session.userId)).then(r => r[0])

  return NextResponse.json(withDefaults(row))
}

// Update one or more preference toggles. Body is a partial map of { [type]: boolean }.
// Unknown keys and non-boolean values are ignored. Upserts the single per-user row.
export async function PUT(req: NextRequest) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const updates: Partial<Record<ConfigurableNotificationType, boolean>> = {}
  for (const t of NOTIFICATION_TYPES) {
    if (typeof body[t.key] === 'boolean') updates[t.key] = body[t.key] as boolean
  }

  if (Object.keys(updates).length > 0) {
    await db.insert(notificationPrefs)
      .values({ userId: session.userId, ...updates })
      .onConflictDoUpdate({ target: notificationPrefs.userId, set: updates })
  }

  const row = await db.select().from(notificationPrefs)
    .where(eq(notificationPrefs.userId, session.userId)).then(r => r[0])

  return NextResponse.json(withDefaults(row))
}
