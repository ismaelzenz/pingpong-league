import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users, passwordResetTokens } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'

export async function POST(request: Request) {
  const { token, password } = await request.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const row = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .then(r => r[0])

  if (!row) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }
  if (row.usedAt) {
    return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 })
  }
  if (new Date(row.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date().toISOString() }).where(eq(passwordResetTokens.id, row.id))

  return NextResponse.json({ message: 'Password updated successfully' })
}
