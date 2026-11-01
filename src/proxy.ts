import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/sessionConfig'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

// Fully open to everyone (logged in or not) with no redirect either way — e.g. the office
// wall display, which runs on a TV that can't log in.
const OPEN_PATHS = ['/display']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  if (OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return response
  }

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
  // `manifest.webmanifest` is excluded alongside the static assets: the browser fetches it to
  // install the PWA, often before anyone has signed in, and redirecting it to /login makes that
  // fetch fail with a console error instead of serving the manifest.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
