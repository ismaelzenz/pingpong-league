import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { SessionData } from '@/lib/auth/session'
import type { IronSession } from 'iron-session'

/**
 * API-route auth guards. Each returns either the session (caller is authorized) or a ready-to-
 * return `NextResponse` error, so routes stay a one-liner:
 *
 *   const auth = await requireAdmin()
 *   if (auth instanceof NextResponse) return auth
 *   // auth is the session here
 */

type Session = IronSession<SessionData>

/**
 * A signed cookie proves who someone *was*, not that they still exist. A session outlives the row
 * it names whenever the users table is rebuilt (a reseeded dev database) or a member is deleted —
 * and the cookie keeps working, because nothing had checked. Reads mostly shrug it off, but the
 * first write that references the signed-in user dies on a foreign key, surfacing as a raw SQL
 * error for what is really just "sign in again". One indexed lookup here turns that into a 401.
 */
async function userStillExists(userId: number): Promise<boolean> {
  const row = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).then(r => r[0])
  return !!row
}

const STALE = NextResponse.json(
  { error: 'Your session is no longer valid — please sign in again.' },
  { status: 401 },
)

/** Requires a logged-in user who still exists. 401 otherwise. */
export async function requireUser(): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await userStillExists(session.userId))) return STALE
  return session
}

/** Requires a logged-in admin who still exists. 403 otherwise. */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!(await userStillExists(session.userId))) return STALE
  return session
}
