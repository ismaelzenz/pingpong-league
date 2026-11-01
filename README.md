# 🏓 Zenz Ping Pong League

A web app for running an office ping-pong league: a double round-robin tournament with
weekly matchdays, self-reported results, a live scoreboard, player profiles, and admin
tooling for managing the season (including adding players mid-tournament).

> The same content lives in-app on the **How it works** page (`/info`), readable by anyone
> logged in. Keep this file and that page in sync when behaviour changes.

---

## Table of contents

- [The format & rules](#the-format--rules)
- [A participant's day-to-day](#a-participants-day-to-day)
- [Results: entering & confirming](#results-entering--confirming)
- [The scoreboard](#the-scoreboard)
- [Player profiles & head-to-head](#player-profiles--head-to-head)
- [Matchdays & byes (odd rosters)](#matchdays--byes-odd-rosters)
- [Catch-up games](#catch-up-games)
- [What admins can do](#what-admins-can-do)
- [Adding a newcomer mid-season](#adding-a-newcomer-mid-season)
- [Editing a matchday & schedule health](#editing-a-matchday--schedule-health)
- [Notifications (web push)](#notifications-web-push)
- [Install on phones (PWA)](#install-on-phones-pwa)
- [Office wall display (`/display`)](#office-wall-display-display)
- [Tech notes](#tech-notes)

---

## The format & rules

- **Double round-robin** — every player plays every other player **exactly twice**: once at
  home and once away. No more, no less.
- **Best of 3 sets** — first to win 2 sets wins the match.
- **One game per week** — each *matchday* covers one calendar week.
- **Scoring** — **1 point per set won, plus a 1-point bonus for winning the match.**
  - Win 2–0 → **3 pts** (winner), 0 pts (loser)
  - Win 2–1 → **3 pts** (winner), **1 pt** (loser)
  - Forfeit → 0 pts and a loss for **both** players (used when a game went unplayed and wasn't postponed).
- **Standings tiebreakers** — points, then victories, then sets won, then fewest sets lost.

### Number of matchdays

| Roster size | Matchdays | Games per matchday | Byes |
| --- | --- | --- | --- |
| Even *N* | `2 × (N − 1)` | `N / 2` | none |
| Odd *N* | `2 × N` | `(N − 1) / 2` | exactly **one player** per matchday, shared evenly (each player byes twice) |

---

## A participant's day-to-day

> **Joining:** while registration is open, sign in and hit **Join the tournament** on your
> dashboard (or open an invite link and join from there). Once the season has started, an admin
> adds any latecomers.

1. **Log in** and land on your **dashboard**.
2. You'll see two lists of your games:
   - **⏳ Catch-up games** — overdue or backlog games you should play as soon as possible.
   - **My upcoming games** — what's coming next.
3. **Play your match** during its week (catch-up games can be played anytime).
4. **Report the result**: one of the two players enters the score, the other confirms it.
5. Check the **Scoreboard** to see where you stand, and click anyone's **avatar** to see their
   stats and your **head-to-head** record.

That's the whole loop: play → report → confirm → repeat.

---

## Results: entering & confirming

- Either player can **enter** the result of a pending game (you can't enter a result for a
  matchday whose week hasn't started yet).
- The result then shows as **Awaiting confirmation**. The **other** player must **confirm**
  it (you can't confirm a result you entered yourself).
- If the score is wrong, the other player can **dispute** it, which clears it back to pending
  so it can be re-entered.
- Either player (or an admin) can **postpone** a pending game.
- Once **confirmed**, the result is final and the scoreboard updates automatically.

**Game statuses:** `pending` → `result_entered` (awaiting confirmation) → `confirmed`.
Also `postponed` and `forfeited`.

---

## The scoreboard

A live table of every participant, sorted by points (then victories, then sets won, then fewest sets lost). Columns:
GP (games played), W (victories), L (losses), SW (sets won), SL (sets lost), Pts. It's
recomputed from confirmed/forfeited games every time it's viewed — there's no stored total to
get out of sync.

---

## Player profiles & head-to-head

Click **any player's avatar or name** (scoreboard, dashboard, game pages, matchdays) to open
their profile, which shows:

- Their tournament **stats** and current rank.
- Your **head-to-head** record against them (wins each, plus every game you've played and any
  upcoming/scheduled games between you).
- Their **past results**.

Clicking your own avatar takes you to **My profile**, where you can edit your name, pick an
avatar colour, and change your password.

---

## Matchdays & byes (odd rosters)

Each matchday is one week and lists its games. When the roster is **odd**, one player sits out
each matchday — a **bye** — and byes rotate so everyone sits out the same number of times.
A matchday page shows who's on a bye that week.

---

## Catch-up games

A **catch-up game** is a game owed outside the normal weekly grid. You'll see them in the
**Catch-up** section of your dashboard, labelled "Catch-up game", and they're visible to
**both** players involved so everyone knows a game is outstanding. They can be played anytime
and count toward the scoreboard once confirmed, exactly like a regular game.

Catch-up games appear in two situations:

- **Overdue** — a regular game whose matchday week has already started but hasn't been played.
- **Backlog** — games created for a newcomer who joined mid-season (see below).

They are **not** part of any matchday's line-up, so they don't affect a matchday's "X/Y
played" count or its bye list.

---

## What admins can do

From the **Admin panel**:

- **Create a tournament** — opens registration. While it's open, players can **join themselves**
  (a "Join the tournament" button on their dashboard), and admins can also add players manually.
- **Invite players** (during registration) — share a link (`/join/<id>`); colleagues create an
  account (or sign in) and then join the open tournament themselves from that page.
- **Schedule breaks** (during registration) — pick weeks to leave matchday-free (holidays,
  summer break). Schedule generation skips those weeks and simply resumes the following week.
- **Close registration & start** — generates the full canonical double round-robin schedule
  and makes the tournament active. (Needs at least 2 participants.)
- **Add a player mid-season** — see [below](#adding-a-newcomer-mid-season).
- **Eliminate a player** — removes a player and *all* their games (past and future); points
  others earned against them are removed and the scoreboard recalculates.
- **Regenerate schedule** — rebuilds the **unplayed** part of the schedule for the current
  roster (see rules below).
- **Forfeit unplayed games** — marks still-**pending** games from past matchdays as forfeited
  (0 pts, a loss for both players). Postponed games are left alone — they're meant to be caught up.
- **End tournament** — marks the season finished (read-only afterwards).
- **Cancel tournament** — during registration only, discards it.
- **Correct a confirmed result** — admins can fix the score of an already-confirmed/forfeited
  game from its page; the scoreboard recalculates.
- **Reset a player's password** and **edit future matchday line-ups** (next sections).

### What "Regenerate schedule" does

- A matchday is **locked** the moment any of its games has a result (confirmed, forfeited, or
  awaiting confirmation). **Locked matchdays and their games are never touched — a played
  game never moves to a different matchday.**
- Everything not yet played is rebuilt for the current roster:
  - If **nothing** has been played, the whole schedule is rebuilt as a clean canonical
    double round-robin.
  - If some matchdays are locked, they stay put and the remaining games are laid into a
    canonical number of fresh future matchdays; anything that can't fit becomes a
    **catch-up game**.
- Either way, **every pair still ends up playing exactly twice.**

---

## Adding a newcomer mid-season

When an admin adds a player to an active tournament:

1. The newcomer is enrolled and the schedule is rebuilt with the "Regenerate" rules above.
2. **Already-played matchdays stay frozen** — nobody's results move.
3. The newcomer is woven into the **future** matchdays (one game per matchday, keeping each
   future matchday full and balanced).
4. The games the newcomer can't fit into the remaining matchdays — their backlog for the weeks
   they missed — become **catch-up games**.

**The newcomer's workflow:** they play their scheduled future games week-by-week like everyone
else, and work through their **catch-up** list (shown on their dashboard) whenever they can
arrange the matches. Their opponents also see those catch-up games in their own lists.

The result: the season stays close to its canonical length, no played game is disturbed, every
pair still meets exactly twice, and the newcomer catches up via flexible games instead of
stretching the season with half-empty matchdays.

---

## Editing a matchday & schedule health

Admins can restructure any **not-yet-started** matchday from its detail page:

- **Change who plays whom** in a game (home/away).
- **Add** or **remove** a game.
- **Reorder** games.
- **Give a bye** to a player (even rosters only — odd rosters already have an automatic bye).

Because manual edits can break the "each pair exactly twice" rule, the app continuously checks
**schedule health**:

- The **matchday list** shows a ⚠️ icon on any matchday with a problem (a pairing happening
  more than twice, or a player double-booked), plus an admin banner listing every issue —
  e.g. *"Isma vs Sameer is scheduled 3× (should be 2) — MD1, MD3, MD14"* and the matching
  *"Ana vs Sam is only scheduled 1×"*.
- A matchday's detail page warns the editing admin about duplicate pairings in that matchday
  and where else those players meet.

**To fix it, use Regenerate schedule** (Admin panel). It rebuilds all *unplayed* matchdays
cleanly so every pair meets exactly twice again, without touching any game that already has a
result. Trying to untangle an imbalance by hand tends to shift it elsewhere ("fix one, break
another"), so Regenerate is the reliable one-click repair.

---

## Notifications (web push)

Players enable push notifications from **My profile → Notifications**, where they can **toggle
each type on/off individually**. Notifications fire when:

- an opponent **enters a result** for you to confirm,
- your result is **confirmed**,
- your result is **disputed** (and needs re-entering),
- one of your games is **postponed**,
- the **weekly reminder** (Thursday) if you still haven't played that week's game, and
- a **tournament you're in officially starts** — this one is always on (not a per-type toggle).

It's web push (no email) — works on desktop/Android browsers, and on iPhone **once the app is
installed to the Home Screen via Safari** (iOS 16.4+). Per-type preferences are stored in the
`notification_prefs` table (opt-out; a missing row means all types on); the always-on types are
defined in `src/lib/domain/notificationTypes.ts`. Requires `VAPID_PUBLIC_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` env vars (generate keys
with web-push; subscriptions live in the `push_subscriptions` table). Sending logic:
`src/lib/services/push.ts`; service-worker handlers in `public/sw.js`.

## Install on phones (PWA)

The app is an installable PWA. On **Android**, open the browser menu → **Add to Home Screen**.
On **iPhone you must use Safari**: Chrome, Edge, and in-app browsers (Teams/WhatsApp/Gmail links)
only create a bookmark that reopens the browser — not a standalone app. Open the URL in Safari →
Share → **Add to Home Screen** → open the new icon. A real standalone install is also **required
for iOS notifications** to work. Wiring lives in `src/app/manifest.ts`, `public/sw.js` (service
worker, registered by `src/components/layout/ServiceWorker.tsx`), and the icon/theme metadata in
`src/app/layout.tsx`. App icons are generated by `npm run gen:icons` (pure Node, no deps) into `public/`.

## Office wall display (`/display`)

A full-screen, auto-refreshing board for an office TV: the full standings with weekly **▲/▼
movement**, **this week's fixtures** (played + still to play), and a **"fun wall"** of record
tiles (🔥 on fire, 🧨 the destroyer, 👑 best win rate, 🎯 clutch). It's **fully public** (no login,
so a TV can show it) and refreshes itself **every 60s** — just open `/display` on the screen.
Compute lives in `src/lib/data/display.ts`; the page is `src/app/display/page.tsx` and is allow-listed
in `src/proxy.ts` (Next 16's name for middleware).

## Tech notes

- **Next.js** (App Router) + **React**, **Tailwind** + Base UI components, **Drizzle ORM** on
  **libsql/Turso**, **iron-session** auth.
- Schedule generation: `src/lib/domain/schedule.ts`. Mid-season rebuild: `src/lib/services/regenerateSchedule.ts`.
  Standings: `src/lib/domain/scoreboard.ts` (the ranking rules) and `src/lib/data/standings.ts`
  (weekly ▲/▼ rank movement). Schedule validation: `src/lib/domain/scheduleHealth.ts`.
  Wall-board data: `src/lib/data/display.ts`.
- **Caching**: standings, ELO, recaps and the wall board are cached across requests and expired
  by every write — see `src/lib/cache.ts`. Any new API route that writes must call one of its
  `after…Change()` helpers; `npm run check:cache` fails if one doesn't.
- **Dates use the league timezone (`Europe/Amsterdam`), not UTC**, so matchday-week boundaries
  line up with real local days — `todayISO()` in `src/lib/dates.ts`.
- **Database** is libSQL — a **local file in dev, Turso (cloud) in production**:
  - **Local dev**: `.env.local` sets `TURSO_DATABASE_URL=file:./data/local.db` — a private, isolated
    file DB. `npm run db:init` creates/updates it. Nothing you do locally can touch production.
  - **Production**: reads its Turso URL/token from **Vercel env vars** (never committed). Apply schema
    changes with `npm run db:init:prod`, which reads a gitignored `.env.production.local`.
  - **Mock data**: `npm run db:seed:mock` fills the **local** DB with a realistic mid-season 20-player
    tournament for testing. It hard-refuses to run against anything but a `file:` DB.
  - Migrations (`src/lib/db/migrate.ts`) are additive and safe to re-run. See `SETUP.md`.

### Code layout & shared building blocks

- **`src/lib/`** is split by what the code does, so it's clear where new code goes:
  - `domain/` — pure rules, no database: scoring (`gameResult`, `scoreboard`), game statuses
    (`gameStatus` — `isFinished()` / `isUnplayed()`), ELO maths (`elo`), schedules, notification
    types, the "what's new" note.
  - `data/` — reads for pages, cached: `tournaments`, `standings`, `scoreboard`, `recap`,
    `display`, `elo` (the ELO tables and charts).
  - `services/` — writes and side effects: `eloLedger` (keeping ELO in step with results),
    `regenerateSchedule`, `push`, `settings`.
  - `auth/` — `session` (`requireSession()` / `requireAdminSession()` for pages,
    `establishSession()` for login), `api` (`requireUser()` / `requireAdmin()` for API routes),
    `admins`, and `sessionConfig` (the cookie settings, shared with `src/proxy.ts`).
  - Top level: `db/` (schema, client, migrations), `cache.ts`, `http.ts` (`readJson()` — parse a
    request body or return a 400), `dates.ts` (`todayISO()` in Amsterdam time, `shortDate()`, …),
    `utils.ts` (`cn()`, `getInitials()`, `medal()`, `showElo()` / `showDelta()`).
- **`src/components/`** is grouped by feature: `admin/`, `game/`, `elo/`, `player/`, `profile/`,
  `recap/`, `display/` (the wall board), `dailytournament/`, `layout/` (nav, `AuthShell`, theme,
  service worker), `common/` and `ui/` (Base UI primitives). Import via the `@/` alias.
- **Reuse these instead of re-implementing:**
  - `common/SectionCard` (a titled card section), `common/BackLink`, `common/EmptyState`,
    `common/ResultChip` (W/L), `common/DeltaText` (+12 / −8), `common/RankMovement` (▲ / ▼).
  - `game/GameStatusBadge`, `game/OutcomeButton` + `game/ConfirmResultPanel` (entering a score),
    `player/PlayerStatsCard`, `player/PlayerAvatar`, `layout/AuthShell` (signed-out pages).
  - `src/hooks/useApiAction.ts` — the client-side "POST → toast → refresh" flow for buttons/forms.

---

*When you change how the app behaves, update both this README and the in-app **How it works**
page (`src/app/(app)/info/page.tsx`).*
