import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'

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

/** Server-component guard: returns the session, or redirects to /login if not signed in. */
export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getSession()
  if (!session.userId) redirect('/login')
  return session
}

/** Server-component guard for admin pages: non-admins are bounced to /dashboard. */
export async function requireAdminSession(): Promise<IronSession<SessionData>> {
  const session = await getSession()
  if (!session.userId) redirect('/login')
  if (!session.isAdmin) redirect('/dashboard')
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
