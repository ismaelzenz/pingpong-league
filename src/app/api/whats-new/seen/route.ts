import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/api'
import { WHATS_NEW } from '@/lib/domain/whatsNew'
import { eq } from 'drizzle-orm'
// cache: private — writes only the member's own "what's new" dismissal, which no cached read includes (see lib/cache.ts).

/**
 * Mark the current release note as read for the signed-in member.
 *
 * Stores the version rather than a boolean, so the next release's note shows up on its own without
 * a second column or a reset.
 */
export async function POST() {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  await db.update(users)
    .set({ whatsNewSeen: WHATS_NEW.version })
    .where(eq(users.id, session.userId))

  return NextResponse.json({ ok: true, version: WHATS_NEW.version })
}
