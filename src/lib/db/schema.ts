import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarColor: text('avatar_color'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  // Set when the member is archived ("no longer in the company"). The row and all their history
  // stay — so recaps/standings still resolve their name & colour — but they're hidden from active
  // pickers (daily tournament, add-player, etc). Reversible.
  archivedAt: text('archived_at'),
})

export const tournaments = sqliteTable('tournaments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  status: text('status', { enum: ['registration', 'active', 'finished'] }).notNull().default('registration'),
  // Exactly one non-finished tournament is "live" — the one players see on their pages.
  // Others (e.g. an admin's test/bug-repro copy) stay invisible to players until promoted.
  isLive: integer('is_live', { mode: 'boolean' }).notNull().default(false),
  // Chosen first week of play ('yyyy-MM-dd'). Anchors matchday 1 when the schedule is built.
  startDate: text('start_date'),
  // JSON array of Monday dates ('yyyy-MM-dd') to skip when scheduling (holiday breaks).
  breakWeeks: text('break_weeks'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
})

export const participants = sqliteTable('participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  userId: integer('user_id').notNull().references(() => users.id),
  joinedAt: text('joined_at').default(sql`(datetime('now'))`).notNull(),
})

export const matchdays = sqliteTable('matchdays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  number: integer('number').notNull(),
  weekStart: text('week_start'),
  weekEnd: text('week_end'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
})

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchdayId: integer('matchday_id').notNull().references(() => matchdays.id),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  homePlayerId: integer('home_player_id').notNull().references(() => users.id),
  awayPlayerId: integer('away_player_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'result_entered', 'confirmed', 'postponed', 'forfeited'] }).notNull().default('pending'),
  homeSets: integer('home_sets'),
  awaySets: integer('away_sets'),
  // A catch-up game is a backlog game (e.g. owed by a mid-season newcomer) that lives
  // outside the regular matchday grid — playable anytime, shown in each player's catch-up list.
  isCatchUp: integer('is_catch_up', { mode: 'boolean' }).notNull().default(false),
  submittedBy: integer('submitted_by').references(() => users.id),
  confirmedBy: integer('confirmed_by').references(() => users.id),
  submittedAt: text('submitted_at'),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
})

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
})

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
})

// Per-user push-notification preferences (opt-out; all types default on). One row per user;
// a missing row means "everything enabled". Column names mirror the keys in notificationTypes.ts.
export const notificationPrefs = sqliteTable('notification_prefs', {
  userId: integer('user_id').primaryKey().references(() => users.id),
  resultToConfirm: integer('result_to_confirm', { mode: 'boolean' }).notNull().default(true),
  resultConfirmed: integer('result_confirmed', { mode: 'boolean' }).notNull().default(true),
  resultDisputed: integer('result_disputed', { mode: 'boolean' }).notNull().default(true),
  gamePostponed: integer('game_postponed', { mode: 'boolean' }).notNull().default(true),
  weeklyReminder: integer('weekly_reminder', { mode: 'boolean' }).notNull().default(true),
})

// ─── TypeScript types ────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type Tournament = typeof tournaments.$inferSelect
export type Participant = typeof participants.$inferSelect
export type Matchday = typeof matchdays.$inferSelect
export type Game = typeof games.$inferSelect
export type NotificationPrefRow = typeof notificationPrefs.$inferSelect
export type GameStatus = Game['status']
export type TournamentStatus = Tournament['status']
