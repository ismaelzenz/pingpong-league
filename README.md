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
  - Forfeit → 0 pts and counts as a loss for the no-show.
- **Standings tiebreakers** — points, then sets won, then number of victories.

### Number of matchdays

| Roster size | Matchdays | Games per matchday | Byes |
| --- | --- | --- | --- |
| Even *N* | `2 × (N − 1)` | `N / 2` | none |
| Odd *N* | `2 × N` | `(N − 1) / 2` | exactly **one player** per matchday, shared evenly (each player byes twice) |

---

## A participant's day-to-day

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

A live table of every participant, sorted by points (then sets won, then victories). Columns:
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

- **Create a tournament** — opens registration so players can join.
- **Invite players** (during registration) — share a link (`/join/<id>`) so colleagues can sign
  up and join the tournament themselves.
- **Schedule breaks** (during registration) — pick weeks to leave matchday-free (holidays,
  summer break). Schedule generation skips those weeks and simply resumes the following week.
- **Close registration & start** — generates the full canonical double round-robin schedule
  and makes the tournament active. (Needs at least 2 participants.)
- **Add a player mid-season** — see [below](#adding-a-newcomer-mid-season).
- **Eliminate a player** — removes a player and *all* their games (past and future); points
  others earned against them are removed and the scoreboard recalculates.
- **Regenerate schedule** — rebuilds the **unplayed** part of the schedule for the current
  roster (see rules below).
- **Forfeit unplayed games** — marks still-pending games from past matchdays as forfeited.
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

## Tech notes

- **Next.js** (App Router) + **React**, **Tailwind** + Base UI components, **Drizzle ORM** on
  **libsql/Turso**, **iron-session** auth.
- Schedule generation: `src/lib/schedule.ts`. Mid-season rebuild: `src/lib/regenerateSchedule.ts`.
  Standings: `src/lib/scoreboard.ts`. Schedule validation: `src/lib/scheduleHealth.ts`.
- Database setup / migrations: `npm run db:init` (see `SETUP.md` and `src/lib/db/migrate.ts`).
  Run it after pulling schema changes; column additions are additive and safe to re-run.

---

*When you change how the app behaves, update both this README and the in-app **How it works**
page (`src/app/(app)/info/page.tsx`).*
