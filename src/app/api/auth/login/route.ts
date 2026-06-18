import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await getSession()
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.isAdmin = isAdmin(user.email)
  await session.save()

  return NextResponse.json({ ok: true })
}
