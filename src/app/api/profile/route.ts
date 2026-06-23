import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, avatarColor } = await req.json()

  const update: Record<string, string> = {}
  if (name?.trim()) {
    update.name = name.trim()
    session.name = name.trim()
  }
  if (avatarColor !== undefined) update.avatarColor = avatarColor

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  await db.update(users).set(update).where(eq(users.id, session.userId))
  await session.save()

  return NextResponse.json({ ok: true })
}
