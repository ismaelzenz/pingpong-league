import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

// Store (or refresh) a browser push subscription for the current user.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await req.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Endpoint is unique — replace any prior row (e.g. it moved to another account/device).
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  await db.insert(pushSubscriptions).values({ userId: session.userId, endpoint, p256dh, auth })

  return NextResponse.json({ ok: true })
}
