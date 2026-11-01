import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Sign out a session whose user no longer exists, then send them to the login page.
 *
 * The page guards can spot a stale cookie but can't clear one — a Server Component may read
 * cookies, never write them. Redirecting them straight to /login without clearing it causes an
 * infinite bounce: the cookie is still validly signed, so the proxy counts them as logged in
 * and sends them back to /dashboard, which rejects them again. Clearing the cookie here breaks
 * that cycle, and this route sits under /api/ so the proxy (src/proxy.ts) doesn't intercept it.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  session.destroy()
  return NextResponse.redirect(new URL('/login', req.url))
}
