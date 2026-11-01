/**
 * Seed the LOCAL database with a realistic mid-season tournament for testing.
 *
 *   npm run db:seed:mock
 *
 * Produces a 10-player double round-robin (18 matchdays, 5 games each) where **matchday 14 is
 * the current week**: matchdays 1–13 are fully played with confirmed results, matchday 14 is
 * partly played (some recorded, one recorded-then-corrected, some still to play), and 15–18 are
 * upcoming. All players share the password below; the first two use admin emails.
 *
 * Also rebuilds the ELO ledger at the end, so the /elo page has a full history to draw.
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
import { buildLedger, type RatableGame } from '../src/lib/elo'

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
  await db.delete(schema.eloHistory)
  await db.delete(schema.eloGamePlayers)
  await db.delete(schema.eloGames)
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

  // Build one tournament: its matchdays + games, with each game's state decided per matchday.
  async function seedTournament(opts: {
    name: string
    status: 'active' | 'finished'
    isLive: boolean
    firstMonday: Date
    finishedAt?: Date
    stateFor: (matchdayNumber: number, gameIndex: number) => 'confirmed' | 'corrected' | 'pending'
  }) {
    const [t] = await db.insert(tournaments).values({
      name: opts.name,
      status: opts.status,
      isLive: opts.isLive,
      startDate: format(opts.firstMonday, 'yyyy-MM-dd'),
      startedAt: opts.firstMonday.toISOString(),
      finishedAt: opts.finishedAt ? opts.finishedAt.toISOString() : null,
    }).returning()
    await db.insert(participants).values(ids.map(userId => ({ tournamentId: t.id, userId })))

    const schedule = generateSchedule(ids)
    const rows: (typeof games.$inferInsert)[] = []
    const counts = { confirmed: 0, corrected: 0, pending: 0 }
    for (const md of schedule) {
      const weekStart = addWeeks(opts.firstMonday, md.number - 1)
      const [mdRow] = await db.insert(matchdays).values({
        tournamentId: t.id,
        number: md.number,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(addDays(weekStart, 4), 'yyyy-MM-dd'),
      }).returning()

      md.games.forEach((g, i) => {
        const base = { matchdayId: mdRow.id, tournamentId: t.id, homePlayerId: g.home, awayPlayerId: g.away, isCatchUp: false }
        const playedAt = addDays(weekStart, 1 + Math.floor(Math.random() * 4)).toISOString()
        const state = opts.stateFor(md.number, i)
        if (state === 'confirmed') {
          const s = score(Math.random() < 0.5)
          // Auto-approved on entry: no confirmedBy, and submittedAt doubles as when it was played.
          rows.push({ ...base, status: 'confirmed', ...s, submittedBy: g.home, submittedAt: playedAt, confirmedAt: playedAt })
          counts.confirmed++
        } else if (state === 'corrected') {
          // A result the away player put right afterwards — the score changed, the played-at didn't.
          const s = score(Math.random() < 0.5)
          rows.push({
            ...base, status: 'confirmed', ...s,
            submittedBy: g.home, submittedAt: playedAt, confirmedAt: playedAt,
            correctedBy: g.away, correctedAt: addDays(weekStart, 2).toISOString(),
          })
          counts.corrected++
        } else {
          rows.push({ ...base, status: 'pending' })
          counts.pending++
        }
      })
    }
    await db.insert(games).values(rows)
    return { tournament: t, matchdays: schedule.length, counts }
  }

  const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const seasonLength = 2 * (PLAYERS.length - 1) // canonical matchdays for an even roster
  const GAP = 2 // weeks of downtime between seasons

  // ── Past seasons: two fully-played, finished leagues so the /recap "Past seasons" list is
  //    populated. 2025 ends just before the active 2026 season; 2024 ends before 2025. ──────
  const finishedAtOf = (firstMonday: Date) => addDays(addWeeks(firstMonday, seasonLength - 1), 4)
  const prev2025FirstMonday = subWeeks(currentMonday, ACTIVE_MATCHDAY - 1 + seasonLength + GAP)
  const prev2024FirstMonday = subWeeks(prev2025FirstMonday, seasonLength + GAP)

  const older = await seedTournament({
    name: 'Mock League 2024',
    status: 'finished',
    isLive: false,
    firstMonday: prev2024FirstMonday,
    finishedAt: finishedAtOf(prev2024FirstMonday),
    stateFor: () => 'confirmed',
  })

  const prev = await seedTournament({
    name: 'Mock League 2025',
    status: 'finished',
    isLive: false,
    firstMonday: prev2025FirstMonday,
    finishedAt: finishedAtOf(prev2025FirstMonday),
    stateFor: () => 'confirmed',
  })

  // ── This season: active & live, matchday 14 in progress ─────────────────────────────────
  const active = await seedTournament({
    name: 'Mock League 2026',
    status: 'active',
    isLive: true,
    firstMonday: subWeeks(currentMonday, ACTIVE_MATCHDAY - 1),
    stateFor: (n, i) => (n < ACTIVE_MATCHDAY ? 'confirmed' : n > ACTIVE_MATCHDAY ? 'pending' : i < 2 ? 'confirmed' : i === 2 ? 'corrected' : 'pending'),
  })

  // ── ELO ledger ─────────────────────────────────────────────────────────────────────────
  // Replay every seeded result so the /elo page opens on real curves rather than a flat 1000.
  // Mirrors rebuildEloLedger(), inlined because the seed talks to its own client.
  const rated: RatableGame[] = (await db.select().from(games))
    .filter(g => g.status === 'confirmed' && g.homeSets != null && g.awaySets != null && g.homeSets !== g.awaySets)
    .map(g => ({
      source: 'league' as const,
      refId: g.id,
      homePlayerIds: [g.homePlayerId],
      awayPlayerIds: [g.awayPlayerId],
      homeSets: g.homeSets!,
      awaySets: g.awaySets!,
      playedAt: g.submittedAt ?? g.confirmedAt ?? g.createdAt,
    }))
  const ledger = buildLedger(rated)
  for (let i = 0; i < ledger.length; i += 200) {
    await db.insert(schema.eloHistory).values(ledger.slice(i, i + 200))
  }

  console.log('\n✅ Mock data seeded.')
  console.log(`   ${PLAYERS.length} players.`)
  console.log(`   Finished: ${older.tournament.name} + ${prev.tournament.name} — ${prev.matchdays} matchdays each, all played (view /recap + Past seasons).`)
  console.log(`   Active:   ${active.tournament.name} — matchday ${ACTIVE_MATCHDAY} in progress (recorded ${active.counts.confirmed}, corrected ${active.counts.corrected}, pending ${active.counts.pending}).`)
  console.log(`   ELO:      ${rated.length} rated games replayed into the ledger (view /elo).`)
  console.log(`\n   Log in as ADMIN:  ${PLAYERS[0].email}  /  ${PASSWORD}`)
  console.log(`   (all players share the password "${PASSWORD}")\n`)

  client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
