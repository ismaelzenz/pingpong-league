import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, participants, games, pushSubscriptions, notificationPrefs, passwordResetTokens } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/apiAuth'
import { isAdmin } from '@/lib/admin'
import { eq, or } from 'drizzle-orm'
import { afterLeagueChange } from '@/lib/cache'

// Permanently delete a member's account (login + all their data). Admin only. Refuses accounts
// that still have games in a tournament — those must be eliminated from the tournament first, so
// standings recalculate correctly.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (auth.userId === userId) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 })

  const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0])
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (isAdmin(user.email)) return NextResponse.json({ error: 'Admin accounts cannot be deleted here.' }, { status: 400 })

  const gameRows = await db.select({ id: games.id }).from(games)
    .where(or(eq(games.homePlayerId, userId), eq(games.awayPlayerId, userId)))
  if (gameRows.length > 0) {
    return NextResponse.json(
      { error: `${user.name} has ${gameRows.length} game(s) in a tournament. Eliminate them from the tournament first, then delete the account.` },
      { status: 400 },
    )
  }

  // No game history — safe to delete. Clear references, then the user.
  await db.update(games).set({ submittedBy: null }).where(eq(games.submittedBy, userId))
  await db.update(games).set({ confirmedBy: null }).where(eq(games.confirmedBy, userId))
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId))
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId))
  await db.delete(participants).where(eq(participants.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  afterLeagueChange()
  return NextResponse.json({ ok: true })
}

// Archive / reactivate a member ("no longer in the company"). Keeps the row & all history so
// recaps stay intact, but hides them from active pickers. Admin only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { archived } = await req.json()
  const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0])
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (isAdmin(user.email)) return NextResponse.json({ error: 'Admin accounts cannot be archived.' }, { status: 400 })

  await db.update(users).set({ archivedAt: archived ? new Date().toISOString() : null }).where(eq(users.id, userId))
  afterLeagueChange()
  return NextResponse.json({ ok: true, archived: !!archived })
}
