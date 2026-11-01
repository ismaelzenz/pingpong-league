import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSession, establishSession } from '@/lib/session'
import { WHATS_NEW } from '@/lib/whatsNew'
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
  // A brand-new member starts already caught up: "no more confirming results" means nothing to
  // someone who never confirmed one, and opening the app to a changelog is a poor first impression.
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    name,
    passwordHash,
    whatsNewSeen: WHATS_NEW.version,
  }).returning()

  const session = await getSession()
  await establishSession(session, user)

  return NextResponse.json({ ok: true })
}
