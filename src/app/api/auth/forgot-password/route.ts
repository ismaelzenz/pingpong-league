import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { users, passwordResetTokens } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).then(r => r[0])

    if (!user) {
      return NextResponse.json({ message: 'If that account exists, a reset link has been generated.' })
    }

    // Expire any existing unused tokens for this user
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordResetTokens.userId, user.id))

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.headers.get('origin') ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    return NextResponse.json({ resetUrl })
  } catch (err) {
    console.error('[forgot-password]', err)
    return NextResponse.json({ error: 'Server error. Make sure the database is initialized (npm run db:init).' }, { status: 500 })
  }
}
