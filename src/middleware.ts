import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'pp-league-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
}

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  const isLoggedIn = !!session.userId

  if (PUBLIC_PATHS.includes(pathname)) {
    if (isLoggedIn) return NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  if (!isLoggedIn) return NextResponse.redirect(new URL('/login', request.url))

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
