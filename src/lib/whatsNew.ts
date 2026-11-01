/**
 * The "what's new" note shown to each member after a release.
 *
 * Two independent conditions have to hold for someone to see it:
 *
 *  1. They haven't dismissed *this* release. `version` is the whole mechanism — a member's
 *     `whatsNewSeen` is compared against it, so bumping this string announces the next release.
 *     The flag lives on their user row, not in localStorage, so dismissing it on a phone also
 *     dismisses it on a laptop and in the installed app.
 *  2. An admin has the announcement switched on. It stays up until they turn it off, rather than
 *     expiring on a timer — the person who knows when the news has landed is the one running the
 *     league, not a date written into the code weeks earlier.
 *
 * Keep it to changes people will actually notice. A release note nobody reads teaches everyone to
 * dismiss the next one unread.
 */
export const WHATS_NEW = {
  version: '2026-09-elo',
  title: 'A few things changed',
  items: [
    {
      emoji: '✅',
      title: 'No more confirming results',
      body: 'Whoever gets to their phone first enters the score and it counts immediately. If it’s wrong, the other player taps “Report a wrong result” and puts it right — no approval needed either way.',
    },
    {
      emoji: '📈',
      title: 'ELO ratings',
      body: 'A lifetime rating alongside the league table, backfilled from every game already played. Everyone starts at 1000; beat someone rated above you and you gain more. Find it under ELO.',
    },
    {
      emoji: '🏓',
      title: 'ELO games',
      body: 'Played someone outside the league — after lunch, 2 v 3, whatever happened? Log it on the ELO page and it counts toward everyone’s rating. Any number of players per side.',
    },
    {
      emoji: '📅',
      title: 'Play ahead of schedule',
      body: 'You can now enter a result for a future matchday. If you and your opponent are both free today, just play it and record it.',
    },
  ],
} as const

/**
 * True when this member should see the note: an admin has it switched on, and they haven't
 * dismissed this release themselves.
 */
export function shouldShowWhatsNew(seen: string | null | undefined, enabled: boolean): boolean {
  return enabled && seen !== WHATS_NEW.version
}
