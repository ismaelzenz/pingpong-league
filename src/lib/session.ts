import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'

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
