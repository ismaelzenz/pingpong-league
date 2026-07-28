# Ping Pong League — Setup Guide

The app runs on **Next.js** with a **libSQL** database: a **local file** for development and
**Turso** (hosted libSQL) in production on **Vercel**. Local dev needs nothing but Node.js.

---

## Local development

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env.local`
```env
# Session encryption — any random 32+ char string
# generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your-random-secret

# Comma-separated admin emails (these accounts get admin powers)
ADMIN_EMAILS=you@example.com

# LOCAL DEV: a private SQLite file — nothing here ever touches production.
TURSO_DATABASE_URL=file:./data/local.db
# (no TURSO_AUTH_TOKEN needed for a local file)

# Optional — web-push notifications (see "Notifications" below). Safe to leave unset in dev.
# VAPID_PUBLIC_KEY=...
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # same value as VAPID_PUBLIC_KEY
# VAPID_PRIVATE_KEY=...
# VAPID_SUBJECT=mailto:you@example.com
```

> `.env.local`, `data/`, and `.env.production.local` are gitignored — no secrets are committed.

### 3. Create the local database
```bash
npm run db:init
```
Creates/updates `data/local.db`. Idempotent — re-run it anytime you pull schema changes.

### 4. (Optional) Seed realistic mock data
```bash
npm run db:seed:mock
```
Wipes the **local** DB and fills it with a mid-season **20-player** tournament (matchday 14 in
progress, earlier ones played) so you can test everything at real scale. Log in with any seeded
player at `test1234`; the admin account is the first email in `ADMIN_EMAILS`. This script **hard-
refuses to run against anything but a `file:` database**, so it can never touch production.

### 5. Run
```bash
npm run dev      # http://localhost:3000
```

---

## Production (Vercel + Turso)

### 1. Create a Turso database
Get its URL and an auth token (Turso CLI: `turso db show <name>` and `turso db tokens create <name>`).

### 2. Set environment variables in Vercel → Settings → Environment Variables
| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Session cookie encryption (32+ chars) |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `TURSO_DATABASE_URL` | `libsql://…turso.io` (the cloud DB) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web-push notifications |
| `CRON_SECRET` | Secures the weekly-reminder cron (must have **no** leading/trailing whitespace) |

> Production reads these from Vercel at runtime — **not** from any file in the repo.

### 3. Migrate the production database
Migrations do **not** run during the build. Apply schema changes to prod explicitly:

1. Create a gitignored `.env.production.local` with the prod Turso creds:
   ```env
   TURSO_DATABASE_URL=libsql://…turso.io
   TURSO_AUTH_TOKEN=…
   ```
2. Run:
   ```bash
   npm run db:init:prod
   ```
   Idempotent and additive (creates missing tables / columns), so it's safe to re-run. Only needed
   when you've added new tables or columns.

### 4. Deploy
Push to the git remote — Vercel builds (`next build`) and deploys automatically. The build never
touches the database.

### 5. Cron (weekly reminder)
`vercel.json` schedules `GET /api/cron/reminder` (Thursdays). Vercel sends
`Authorization: Bearer <CRON_SECRET>`; the route rejects anything else. If `CRON_SECRET` is unset
the endpoint is open — always set it in production.

---

## Notifications (optional)
Web push, no email. Generate VAPID keys once (e.g. `npx web-push generate-vapid-keys`), set the
four `VAPID_*` vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` = `VAPID_PUBLIC_KEY`). Players opt in per-type
from **My profile → Notifications**. On iPhone the app must be installed via **Safari** first
(iOS 16.4+). See the README for the full notification behaviour.

---

## npm scripts
| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (live reload) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:init` | Create/migrate the **local** DB (`.env.local`) |
| `npm run db:init:prod` | Create/migrate the **production** DB (`.env.production.local`) |
| `npm run db:seed:mock` | Seed the local DB with a mock 20-player tournament |
| `npm run gen:icons` | Regenerate PWA app icons into `public/` |

---

## How it works (quick reference)
- **Format**: double round-robin — everyone plays everyone twice (home & away), one game per week
  (a *matchday*). Best of 3 sets.
- **Scoring**: 1 pt per set won, +1 bonus for winning the match. Win 2–0 → 3 pts; win 2–1 → 3 pts,
  opponent gets 1. Tiebreakers: points → victories → sets won → fewest sets lost.
- **Flow**: admin creates a tournament → players self-join while registration is open → admin
  starts it (generates the schedule) → players play, one enters the score, the other confirms →
  scoreboard recomputes automatically.

For the full rules, admin tools, notifications, PWA install and the `/display` wall board, see the
[README](./README.md) and the in-app **How it works** page (`/info`).

---

## File structure
```
data/local.db            ← local SQLite DB (gitignored; created by db:init)
scripts/seed-mock.ts     ← mock-data seeder (local only)
src/
  app/
    (app)/               ← authenticated pages (dashboard, scoreboard, matchdays, profile, …)
    display/             ← public office-TV wall board (/display)
    api/                 ← API routes (auth, games, tournaments, notifications, cron)
    login/ register/ …   ← public auth pages
  lib/
    db/                  ← Drizzle schema, connection, migrate script
    schedule.ts          ← round-robin generator     scoreboard.ts / standings.ts ← standings
    display.ts           ← wall-board data           scheduleHealth.ts ← schedule validation
    session.ts apiAuth.ts dates.ts gameResult.ts notificationTypes.ts push.ts tournament.ts
  components/            ← admin/ game/ profile/ player/ layout/ display/ common/ ui/
  hooks/useApiAction.ts  ← client "POST → toast → refresh" helper
```
