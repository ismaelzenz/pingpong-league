import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, session.userId)))

  return NextResponse.json({ ok: true })
}
