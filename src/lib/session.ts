import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface SessionData {
  userId: number
  email: string
  name: string
  isAdmin: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'pp-league-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

/**
 * A cookie names a user; it doesn't prove that user still exists. The row can go away underneath a
 * valid session — a rebuilt dev database, a deleted member — and the cookie keeps working. Pages
 * then render against an id that matches nobody, which fails quietly and confusingly: "exclude
 * me" filters exclude no one, "is this me?" highlights never fire. So the guards check, and a
 * session pointing at a missing user is treated as signed out.
 */
async function sessionUserExists(userId: number): Promise<boolean> {
  return !!(await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).then(r => r[0]))
}

/**
 * Where to send someone whose cookie names a user that's gone.
 *
 * NOT straight to /login: the cookie is still validly signed, so the middleware would count them
 * as logged in, bounce them back to /dashboard, and the guard would reject them again — an
 * infinite redirect. This route clears the cookie first, which is something only a route handler
 * can do (a Server Component reads cookies but can't write them).
 */
const STALE_SESSION_EXIT = '/api/auth/expired'

/** Server-component guard: returns the session, or redirects to /login if not signed in. */
export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getSession()
  if (!session.userId) redirect('/login')
  if (!(await sessionUserExists(session.userId))) redirect(STALE_SESSION_EXIT)
  return session
}

/** Server-component guard for admin pages: non-admins are bounced to /dashboard. */
export async function requireAdminSession(): Promise<IronSession<SessionData>> {
  const session = await getSession()
  if (!session.userId) redirect('/login')
  if (!session.isAdmin) redirect('/dashboard')
  if (!(await sessionUserExists(session.userId))) redirect(STALE_SESSION_EXIT)
  return session
}

/** Populate and save the session for a freshly authenticated user (login/register). */
export async function establishSession(
  session: IronSession<SessionData>,
  user: { id: number; email: string; name: string },
): Promise<void> {
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.isAdmin = isAdmin(user.email)
  await session.save()
}
