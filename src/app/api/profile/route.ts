import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  await db.update(users).set({ name: name.trim() }).where(eq(users.id, session.userId))

  // Update session name too
  session.name = name.trim()
  await session.save()

  return NextResponse.json({ ok: true })
}
