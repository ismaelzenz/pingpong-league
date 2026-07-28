/**
 * Seed the LOCAL database with a realistic mid-season tournament for testing.
 *
 *   npm run db:seed:mock
 *
 * Produces a 10-player double round-robin (18 matchdays, 5 games each) where **matchday 14 is
 * the current week**: matchdays 1–13 are fully played with confirmed results, matchday 14 is
 * partly played (some confirmed, one awaiting confirmation, some still to play), and 15–18 are
 * upcoming. All players share the password below; the first two use admin emails.
 *
 * SAFETY: refuses to run unless TURSO_DATABASE_URL is a local `file:` URL, so it can never wipe
 * or reseed production. It reads .env.local (same as the app in dev).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import bcrypt from 'bcryptjs'
import { startOfWeek, subWeeks, addWeeks, addDays, format } from 'date-fns'
import * as schema from '../src/lib/db/schema'
import { generateSchedule } from '../src/lib/schedule'

const { users, tournaments, participants, matchdays, games } = schema

const PASSWORD = 'test1234'
const ACTIVE_MATCHDAY = 14

// Players 1–2 use admin emails (see ADMIN_EMAILS) so you can log in as admin + player.
// ~20 players, matching the expected size of the real tournament.
const PLAYERS = [
  { name: 'Isma', email: 'isegoviano@zenztech.com', color: '#0ea5e9' },
  { name: 'Sameer', email: 'skhan@zenztech.com', color: '#f43f5e' },
  { name: 'Alex', email: 'alex@mock.local', color: '#8b5cf6' },
  { name: 'Bruno', email: 'bruno@mock.local', color: '#22c55e' },
  { name: 'Carla', email: 'carla@mock.local', color: '#eab308' },
  { name: 'Diana', email: 'diana@mock.local', color: '#ec4899' },
  { name: 'Erik', email: 'erik@mock.local', color: '#f97316' },
  { name: 'Fatima', email: 'fatima@mock.local', color: '#14b8a6' },
  { name: 'Gijs', email: 'gijs@mock.local', color: '#6366f1' },
  { name: 'Hugo', email: 'hugo@mock.local', color: '#84cc16' },
  { name: 'Ines', email: 'ines@mock.local', color: '#ef4444' },
  { name: 'Jasper', email: 'jasper@mock.local', color: '#3b82f6' },
  { name: 'Klara', email: 'klara@mock.local', color: '#a855f7' },
  { name: 'Lars', email: 'lars@mock.local', color: '#10b981' },
  { name: 'Maud', email: 'maud@mock.local', color: '#f59e0b' },
  { name: 'Noah', email: 'noah@mock.local', color: '#06b6d4' },
  { name: 'Olivia', email: 'olivia@mock.local', color: '#d946ef' },
  { name: 'Pieter', email: 'pieter@mock.local', color: '#65a30d' },
  { name: 'Quinn', email: 'quinn@mock.local', color: '#e11d48' },
  { name: 'Rosa', email: 'rosa@mock.local', color: '#7c3aed' },
]

// A best-of-3 score for a played game: winner takes 2 sets, loser 0 or 1.
function score(homeWins: boolean): { homeSets: number; awaySets: number } {
  const loserSets = Math.random() < 0.6 ? 0 : 1
  return { homeSets: homeWins ? 2 : loserSets, awaySets: homeWins ? loserSets : 2 }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? ''
  if (!url.startsWith('file:')) {
    console.error(`\n✋ Refusing to seed: TURSO_DATABASE_URL is "${url}".`)
    console.error('   This script only runs against a LOCAL file database (file:...), never prod.')
    console.error('   Point .env.local at file:./data/local.db and try again.\n')
    process.exit(1)
  }

  const client = createClient({ url })
  const db = drizzle(client, { schema })

  console.log(`Seeding mock data into ${url} …`)

  // ── Wipe existing data (children first for FK safety) ──────────────────────────────────
  await db.delete(games)
  await db.delete(matchdays)
  await db.delete(participants)
  await db.delete(schema.passwordResetTokens)
  await db.delete(schema.pushSubscriptions)
  await db.delete(schema.notificationPrefs)
  await db.delete(tournaments)
  await db.delete(users)

  // ── Players ────────────────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const ids: number[] = []
  for (const p of PLAYERS) {
    const [row] = await db.insert(users).values({
      email: p.email.toLowerCase(), name: p.name, passwordHash, avatarColor: p.color,
    }).returning()
    ids.push(row.id)
  }

  // ── Dates: matchday 14 = this week; matchday 1 = 13 weeks ago ───────────────────────────
  const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const firstMonday = subWeeks(currentMonday, ACTIVE_MATCHDAY - 1)
  const mondayOfMatchday = (n: number) => addWeeks(firstMonday, n - 1)

  // ── Tournament (active, live) ───────────────────────────────────────────────────────────
  const [tournament] = await db.insert(tournaments).values({
    name: 'Mock League 2026',
    status: 'active',
    isLive: true,
    startDate: format(firstMonday, 'yyyy-MM-dd'),
    startedAt: firstMonday.toISOString(),
  }).returning()

  await db.insert(participants).values(ids.map(userId => ({ tournamentId: tournament.id, userId })))

  // ── Schedule + results ──────────────────────────────────────────────────────────────────
  const schedule = generateSchedule(ids)
  const gameRows: (typeof games.$inferInsert)[] = []
  let confirmed = 0, entered = 0, pending = 0

  for (const md of schedule) {
    const weekStart = mondayOfMatchday(md.number)
    const [mdRow] = await db.insert(matchdays).values({
      tournamentId: tournament.id,
      number: md.number,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(addDays(weekStart, 4), 'yyyy-MM-dd'),
    }).returning()

    md.games.forEach((g, i) => {
      const base = {
        matchdayId: mdRow.id,
        tournamentId: tournament.id,
        homePlayerId: g.home,
        awayPlayerId: g.away,
        isCatchUp: false,
      }
      const playedAt = addDays(weekStart, 1 + Math.floor(Math.random() * 4)).toISOString()

      // Past matchdays are fully played. In matchday 14: first 2 confirmed, 3rd awaiting
      // confirmation, the rest still to play. Future matchdays are all pending.
      let state: 'confirmed' | 'entered' | 'pending'
      if (md.number < ACTIVE_MATCHDAY) state = 'confirmed'
      else if (md.number > ACTIVE_MATCHDAY) state = 'pending'
      else state = i < 2 ? 'confirmed' : i === 2 ? 'entered' : 'pending'

      if (state === 'confirmed') {
        const s = score(Math.random() < 0.5)
        gameRows.push({ ...base, status: 'confirmed', ...s, submittedBy: g.home, confirmedBy: g.away, submittedAt: playedAt, confirmedAt: playedAt })
        confirmed++
      } else if (state === 'entered') {
        const s = score(Math.random() < 0.5)
        gameRows.push({ ...base, status: 'result_entered', ...s, submittedBy: g.home, submittedAt: addDays(weekStart, 1).toISOString() })
        entered++
      } else {
        gameRows.push({ ...base, status: 'pending' })
        pending++
      }
    })
  }

  await db.insert(games).values(gameRows)

  console.log('\n✅ Mock tournament seeded.')
  console.log(`   Players: ${PLAYERS.length}  ·  Matchdays: ${schedule.length}  ·  Active matchday: ${ACTIVE_MATCHDAY}`)
  console.log(`   Games — confirmed: ${confirmed}, awaiting confirmation: ${entered}, pending: ${pending}`)
  console.log(`\n   Log in as ADMIN:  ${PLAYERS[0].email}  /  ${PASSWORD}`)
  console.log(`   (all players share the password "${PASSWORD}")\n`)

  client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
