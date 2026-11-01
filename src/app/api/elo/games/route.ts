import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { eloGamePlayers, eloGames, users } from '@/lib/db/schema'
import { requireUser } from '@/lib/apiAuth'
import { sendPush } from '@/lib/push'
import { isValidResult } from '@/lib/gameResult'
import { winnersOf } from '@/lib/elo'
import { syncEloForGame } from '@/lib/eloLedger'
import { inArray, isNull, and } from 'drizzle-orm'

/** Nobody plays a 20-a-side lunchtime game; the cap is here to stop a malformed request. */
const MAX_PER_SIDE = 10

/** Clean a submitted side into unique, positive user ids. */
function parseSide(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(Number).filter(n => Number.isInteger(n) && n > 0))]
}

/**
 * Record a casual game — one played outside any league fixture that still counts for ELO.
 *
 * Sides can be any size and needn't match: the after-lunch game is 2v3 as often as it's 1v1, and
 * everyone on the table should get a rating out of it. Same as a league result, it's live the
 * moment it's entered; the submitter must have been playing (an admin may log one they weren't in).
 */
export async function POST(req: NextRequest) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const homePlayerIds = parseSide(body.homePlayerIds)
  const awayPlayerIds = parseSide(body.awayPlayerIds)
  const homeSets = Number(body.homeSets)
  const awaySets = Number(body.awaySets)

  if (homePlayerIds.length === 0 || awayPlayerIds.length === 0) {
    return NextResponse.json({ error: 'Both sides need at least one player' }, { status: 400 })
  }
  if (homePlayerIds.length > MAX_PER_SIDE || awayPlayerIds.length > MAX_PER_SIDE) {
    return NextResponse.json({ error: `At most ${MAX_PER_SIDE} players per side` }, { status: 400 })
  }
  const overlap = homePlayerIds.filter(id => awayPlayerIds.includes(id))
  if (overlap.length) {
    return NextResponse.json({ error: 'A player can’t be on both sides' }, { status: 400 })
  }
  if (!isValidResult(homeSets, awaySets)) {
    return NextResponse.json({ error: 'Invalid result — best of 3, so 2–0 or 2–1' }, { status: 400 })
  }

  const everyone = [...homePlayerIds, ...awayPlayerIds]
  if (!session.isAdmin && !everyone.includes(session.userId)) {
    return NextResponse.json({ error: 'You can only record a game you played in' }, { status: 403 })
  }

  // Every named player must be a real, active member — otherwise the insert would die on a
  // foreign key and the game would be half-written.
  const found = await db.select({ id: users.id, name: users.name })
    .from(users).where(and(inArray(users.id, everyone), isNull(users.archivedAt)))
  if (found.length !== everyone.length) {
    return NextResponse.json({ error: 'One of those players is no longer active' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let id: number
  try {
    const created = await db.insert(eloGames).values({
      homeSets,
      awaySets,
      submittedBy: session.userId,
      playedAt: now,
    }).returning({ id: eloGames.id })
    id = created[0].id

    await db.insert(eloGamePlayers).values([
      ...homePlayerIds.map(userId => ({ eloGameId: id, userId, side: 'home' as const })),
      ...awayPlayerIds.map(userId => ({ eloGameId: id, userId, side: 'away' as const })),
    ])

    await syncEloForGame('elo', id, winnersOf({ homePlayerIds, awayPlayerIds, homeSets, awaySets }))
  } catch (e) {
    // Surface the real reason (a missing table on a database that skipped `npm run db:init`, say)
    // instead of letting it fall through as an opaque 500 the client can only call "an error".
    console.error('Failed to record ELO game:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not record the game: ${detail}` }, { status: 500 })
  }

  // Tell everyone else who was on the table.
  const others = everyone.filter(uid => uid !== session.userId)
  after(() => Promise.all(others.map(uid => sendPush(uid, {
    title: 'ELO game recorded',
    body: `${session.name} logged your game ${homeSets}–${awaySets}. Tap to check it.`,
    url: '/elo',
  }, 'resultRecorded'))))

  return NextResponse.json({ ok: true, id })
}
