import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession, establishSession } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { readJson } from '@/lib/http'

export async function POST(req: NextRequest) {
  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { email, password } = json

  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await getSession()
  await establishSession(session, user)

  return NextResponse.json({ ok: true })
}
