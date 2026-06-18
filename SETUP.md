# Ping Pong League — Setup Guide

No external services needed. Just Node.js.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Edit `.env.local`:

```env
# Generate a random secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your-random-32-char-secret-here

# Comma-separated admin emails
ADMIN_EMAILS=your@email.com

# Optional: custom DB path (default: ./data/pingpong.db)
# DB_PATH=/path/to/pingpong.db
```

## 3. Initialize the database

```bash
npm run db:init
```

This creates `data/pingpong.db` (a single SQLite file — back it up anytime by copying it).

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

## 5. Deploy to a server

Build and run on any machine with Node.js:

```bash
npm run build
npm start
```

Good options:
- **Railway** — simple, free tier, persistent disk
- **Fly.io** — free tier with persistent volumes
- **A VPS** (DigitalOcean, Hetzner, etc.)
- **A machine in the office** — just run `npm start`

> Vercel is NOT suitable (no persistent filesystem for the SQLite file).

## How it works

### Tournament flow
1. **Admin** creates a tournament (`/admin`)
2. **Players** register accounts and click "Join the tournament"
3. **Admin** clicks "Close registration & start" — generates the full double round-robin schedule automatically
4. Players play their games, enter results, opponent confirms
5. Scoreboard updates automatically after each confirmed game
6. At end of tournament, admin clicks "End tournament"

### Scoring
- 1 point per set won
- +1 bonus point for winning the match
- Win 2–0 → 3 pts (you), 0 pts (opponent)
- Win 2–1 → 3 pts (you), 1 pt (opponent)

### Schedule format
- Double round-robin (everyone plays everyone twice — home and away)
- 1 game per player per matchday (week)
- First leg: everyone faces each other once
- Second leg: same pairs, home/away reversed
- Starting from the next Monday after tournament starts

### File structure
```
data/
  pingpong.db        ← SQLite database (auto-created by db:init)
src/
  app/
    api/             ← API routes (auth, games, tournaments)
    (app)/           ← Protected pages (dashboard, scoreboard, etc.)
    login/           ← Public auth pages
    register/
  lib/
    db/              ← Drizzle schema + DB connection
    session.ts       ← Iron-session config
    schedule.ts      ← Round-robin schedule generator
    scoreboard.ts    ← Scoreboard calculation
  components/        ← Shared UI components
```
