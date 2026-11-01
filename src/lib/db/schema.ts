import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarColor: text('avatar_color'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  // The release whose "what's new" note this member has dismissed. A version string rather than a
  // boolean so the same mechanism serves the next release: bump WHATS_NEW.version and everyone
  // sees the new note once. On the user row, not in localStorage — people open this on a phone and
  // a laptop, and the installed PWA is a separate origin again, so per-device storage would show
  // the same announcement three times.
  whatsNewSeen: text('whats_new_seen'),
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
  // Whether this season's results move players' lifetime ELO ratings. On for a real season; an
  // admin turns it off for a test or bug-repro copy, whose games would otherwise shift real
  // ratings with results nobody played.
  countsForElo: integer('counts_for_elo', { mode: 'boolean' }).notNull().default(true),
  // Only games recorded at or after this moment count for ELO. Null means the whole season counts.
  // Set when an admin switches ELO on midway and chooses to leave the already-played games out —
  // without it, "count from now on" would be impossible to express.
  eloCountsFrom: text('elo_counts_from'),
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
  // Set when a player corrects an already-recorded result ("report a wrong result"). Results are
  // auto-approved on entry, so this is the audit trail for the one who overrode it.
  correctedBy: integer('corrected_by').references(() => users.id),
  correctedAt: text('corrected_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
})

// A game played outside the league — a casual match that still counts for ELO (and only for ELO:
// it never touches a tournament scoreboard). No scheduling, no matchday, and no fixed team size:
// the lunchtime game is 2v3 as often as it's 1v1, so the sides live in `eloGamePlayers` rather
// than in a home/away column pair.
export const eloGames = sqliteTable('elo_games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  homeSets: integer('home_sets').notNull(),
  awaySets: integer('away_sets').notNull(),
  submittedBy: integer('submitted_by').notNull().references(() => users.id),
  correctedBy: integer('corrected_by').references(() => users.id),
  correctedAt: text('corrected_at'),
  /** When the result was entered — the ELO ledger's ordering key. Kept across corrections. */
  playedAt: text('played_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
})

// Who lined up on which side of a casual game. One row per player per game; a 1v1 has two rows,
// a 4v4 has eight. `side` matches the home/away sets on the game.
export const eloGamePlayers = sqliteTable('elo_game_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eloGameId: integer('elo_game_id').notNull().references(() => eloGames.id),
  userId: integer('user_id').notNull().references(() => users.id),
  side: text('side', { enum: ['home', 'away'] }).notNull(),
})

// The ELO ledger: one row per player per rated game, holding what that game did to their rating.
// It's a derived table — `rebuildEloLedger()` can recreate it from `games` + `elo_games` at any
// time — but materialising it is what makes "how many points did I win or lose, and when" a single
// cheap query, and what the rating timeline chart is drawn from.
export const eloHistory = sqliteTable('elo_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  /** The one opponent in a 1v1. Null for a team game — read the sides off the game instead. */
  opponentId: integer('opponent_id').references(() => users.id),
  /** Which table `refId` points at: 'league' → games, 'elo' → elo_games. */
  source: text('source', { enum: ['league', 'elo'] }).notNull(),
  refId: integer('ref_id').notNull(),
  won: integer('won', { mode: 'boolean' }).notNull(),
  mySets: integer('my_sets').notNull(),
  oppSets: integer('opp_sets').notNull(),
  // Ratings are stored to full precision and rounded only for display. A team game splits one pot
  // between a side's players, which rarely divides into whole points — rounding here would put back
  // the imbalance the split removes, and compound it over a season.
  ratingBefore: real('rating_before').notNull(),
  delta: real('delta').notNull(),
  ratingAfter: real('rating_after').notNull(),
  playedAt: text('played_at').notNull(),
  /** Position of this game in the global replay order — a stable tiebreak for same-second results. */
  seq: integer('seq').notNull(),
})

// Small key/value store for league-wide switches an admin flips at runtime — things that aren't
// worth a column on any existing table and shouldn't need a deploy to change.
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
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
  // The old enter-then-confirm flow's columns (result_to_confirm / result_confirmed /
  // result_disputed) still exist in the database but are gone from here: nothing reads them, and
  // they're NOT NULL DEFAULT 1 so leaving them unmapped doesn't affect inserts.
  /** An opponent recorded a result for one of your games. */
  resultRecorded: integer('result_recorded', { mode: 'boolean' }).notNull().default(true),
  /** An opponent corrected a result you'd recorded. */
  resultCorrected: integer('result_corrected', { mode: 'boolean' }).notNull().default(true),
  gamePostponed: integer('game_postponed', { mode: 'boolean' }).notNull().default(true),
  weeklyReminder: integer('weekly_reminder', { mode: 'boolean' }).notNull().default(true),
})

// ─── TypeScript types ────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type Tournament = typeof tournaments.$inferSelect
export type Participant = typeof participants.$inferSelect
export type Matchday = typeof matchdays.$inferSelect
export type Game = typeof games.$inferSelect
export type EloGame = typeof eloGames.$inferSelect
export type EloGamePlayer = typeof eloGamePlayers.$inferSelect
export type EloHistoryRow = typeof eloHistory.$inferSelect
export type NotificationPrefRow = typeof notificationPrefs.$inferSelect
export type GameStatus = Game['status']
export type TournamentStatus = Tournament['status']
