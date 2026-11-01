import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { requireUser } from '@/lib/apiAuth'
import { and, eq } from 'drizzle-orm'
// cache: private — writes only the member's push subscriptions, which no cached read includes (see lib/cache.ts).

export async function POST(req: NextRequest) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const { endpoint } = await req.json() as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, session.userId)))

  return NextResponse.json({ ok: true })
}
