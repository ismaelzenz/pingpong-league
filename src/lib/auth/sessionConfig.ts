/**
 * The session cookie's shape and settings, shared by the server-side session helpers
 * (`auth/session.ts`) and the proxy (`src/proxy.ts`). Kept free of database and Next request
 * imports so the proxy can load it cheaply — and so both sides can never disagree on the cookie.
 */

export interface SessionData {
  userId: number
  email: string
  name: string
  isAdmin: boolean
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'pp-league-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}
