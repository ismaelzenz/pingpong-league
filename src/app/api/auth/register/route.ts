import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    name,
    passwordHash,
  }).returning()

  const session = await getSession()
  session.userId = user.id
  session.email = user.email
  session.name = user.name
  session.isAdmin = isAdmin(user.email)
  await session.save()

  return NextResponse.json({ ok: true })
}
