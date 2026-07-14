import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { SessionData } from '@/lib/session'
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

/** Requires a logged-in user. 401 otherwise. */
export async function requireUser(): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

/** Requires a logged-in admin. 403 otherwise. */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}
