import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/api'
import { eq } from 'drizzle-orm'
import { afterLeagueChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

export async function PATCH(req: NextRequest) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { name, avatarColor } = json

  const update: Record<string, string> = {}
  if (name?.trim()) {
    update.name = name.trim()
    session.name = name.trim()
  }
  if (avatarColor !== undefined) update.avatarColor = avatarColor

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  await db.update(users).set(update).where(eq(users.id, session.userId))
  await session.save()

  afterLeagueChange()
  return NextResponse.json({ ok: true })
}
