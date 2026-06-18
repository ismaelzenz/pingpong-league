import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
})

export const tournaments = sqliteTable('tournaments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  status: text('status', { enum: ['registration', 'active', 'finished'] }).notNull().default('registration'),
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

// ─── TypeScript types ────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type Tournament = typeof tournaments.$inferSelect
export type Participant = typeof participants.$inferSelect
export type Matchday = typeof matchdays.$inferSelect
export type Game = typeof games.$inferSelect
export type GameStatus = Game['status']
export type TournamentStatus = Tournament['status']
