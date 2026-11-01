import { getSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpen, Trophy, CalendarDays, ClipboardCheck, Timer, Users, Shield, AlertTriangle, UserPlus, Swords, TrendingUp,
} from 'lucide-react'

export const metadata = { title: 'How it works' }

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
        {children}
      </CardContent>
    </Card>
  )
}

export default async function InfoPage() {
  const session = await getSession()

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6" /> How it works</h1>
        <p className="text-muted-foreground">Everything about the league — the rules, your weekly routine, and what admins can do.</p>
      </div>

      <Section icon={Trophy} title="The format & rules">
        <ul className="space-y-2">
          <li>🔄 <strong className="text-foreground">Double round-robin</strong> — you play everyone <strong className="text-foreground">exactly twice</strong>, once home and once away.</li>
          <li>🏓 <strong className="text-foreground">Best of 3 sets</strong> — first to win 2 sets wins the match.</li>
          <li>📅 <strong className="text-foreground">One game per week</strong> — each matchday covers one week.</li>
          <li>🏆 <strong className="text-foreground">Scoring</strong> — 1 point per set won, plus a 1-point bonus for winning the match. Win 2–0 → 3 pts. Win 2–1 → 3 pts, the opponent still gets 1 pt. A forfeit is 0 pts and a loss for both players (for a game that went unplayed and wasn&apos;t postponed).</li>
          <li>📊 <strong className="text-foreground">Tiebreakers</strong> — points, then victories, then sets won, then fewest sets lost.</li>
        </ul>
      </Section>

      <Section icon={CalendarDays} title="Your week, step by step">
        <p>🆕 <strong className="text-foreground">New here?</strong> While registration is open, sign in and tap <strong className="text-foreground">Join the tournament</strong> on your dashboard (or from an invite link). Once the season has started, an admin adds latecomers.</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Open your <strong className="text-foreground">dashboard</strong> — it shows your <strong className="text-foreground">catch-up games</strong> (overdue/backlog) and your <strong className="text-foreground">upcoming games</strong>. For the full list of your games, use <strong className="text-foreground">My games</strong> (in the account menu).</li>
          <li><strong className="text-foreground">Play your match</strong> Monday–Friday, its matchday week — or earlier if it suits you both. Catch-up games can be played anytime.</li>
          <li>Either player <strong className="text-foreground">enters the score</strong> — it counts straight away. If it’s wrong, the other one puts it right.</li>
          <li>Check the <strong className="text-foreground">Scoreboard</strong>, and tap any player&apos;s avatar to see their stats and your head-to-head.</li>
        </ol>
        <p>That&apos;s the whole loop: play → enter the score → repeat.</p>
        <p className="text-xs">📱 Tip: install it on your phone for an app-like experience. On <strong className="text-foreground">iPhone you must use Safari</strong> — open the link in Safari → Share → <strong className="text-foreground">Add to Home Screen</strong>. Adding it from Chrome or an in-app browser (like Teams) only makes a bookmark and won&apos;t work. On Android, use the browser menu → Add to Home Screen.</p>
        <p className="text-xs">🔔 Turn on notifications in <strong className="text-foreground">My profile → Notifications</strong>, where you can pick which ones to receive: when an opponent <strong className="text-foreground">records a result</strong> for one of your games, when a recorded result is <strong className="text-foreground">corrected</strong>, when a game is <strong className="text-foreground">postponed</strong>, and a <strong className="text-foreground">weekly reminder</strong> if you haven&apos;t played that week. (On iPhone, install via Safari first.)</p>
      </Section>

      <Section icon={ClipboardCheck} title="Entering results">
        <ul className="space-y-2">
          <li>Either player can <strong className="text-foreground">enter</strong> a result, including for a <strong className="text-foreground">future matchday</strong> if you played it early. There&apos;s <strong className="text-foreground">no confirmation step</strong> — it&apos;s recorded and counts immediately.</li>
          <li>The other player is notified. If the score is wrong, they tap <strong className="text-foreground">Report a wrong result</strong> and enter the right one, which replaces it on the spot.</li>
          <li>The moment a result is entered is saved as <strong className="text-foreground">when the game was played</strong>. A later correction doesn&apos;t move that timestamp.</li>
          <li>Either player or an admin can <strong className="text-foreground">postpone</strong> a pending game.</li>
        </ul>
      </Section>

      <Section icon={TrendingUp} title="ELO ratings">
        <ul className="space-y-2">
          <li>Everyone starts at <strong className="text-foreground">1000</strong>. Win and you take points off your opponent; lose and they take them off you.</li>
          <li>How many depends on the gap between you: beating someone far above you is worth a lot, beating someone far below you is worth almost nothing. Your first few games move faster, so a newcomer settles at their real level quickly.</li>
          <li>Only <strong className="text-foreground">who won</strong> matters — 2–0 and 2–1 shift the same. So correcting a score to 2–1 changes the league table but leaves ELO untouched; correcting it to a different <em>winner</em> recalculates it.</li>
          <li>ELO is <strong className="text-foreground">lifetime and across seasons</strong>, unlike the league table which resets each season. Forfeits don&apos;t count — there&apos;s no winner to rate.</li>
          <li><strong className="text-foreground">ELO games</strong>: played someone outside the league? Log it on the <strong className="text-foreground">ELO</strong> page and it counts toward ratings (and nothing else).</li>
        </ul>
      </Section>

      <Section icon={Timer} title="Catch-up games">
        <p>A <strong className="text-foreground">catch-up game</strong> is one owed outside the normal weekly grid. It shows in the <strong className="text-foreground">Catch-up</strong> section of your dashboard, under <strong className="text-foreground">My games</strong>, on the <strong className="text-foreground">Matchdays</strong> page, and on the players&apos; profiles — so everyone (and admins) can find an outstanding game. Play it anytime — it counts toward the scoreboard as soon as the result is entered.</p>
        <p>You&apos;ll see them when a game is <strong className="text-foreground">overdue</strong> (its week passed unplayed) or as a newcomer&apos;s <strong className="text-foreground">backlog</strong> (see below). They aren&apos;t part of any matchday&apos;s line-up, so they don&apos;t change a matchday&apos;s played count or who rests.</p>
      </Section>

      <Section icon={Users} title="Matchdays & rests">
        <p>Each matchday is one week, played <strong className="text-foreground">Monday to Friday</strong> — weekends are left free. When the number of players is <strong className="text-foreground">odd</strong>, one player <strong className="text-foreground">rests</strong> each matchday (sits out), and the rests are spread <strong className="text-foreground">as evenly as possible</strong>. A matchday page shows who rests that week.</p>
        <p className="text-xs">Matchdays total <strong className="text-foreground">2 × (players − 1)</strong> for an even roster, or <strong className="text-foreground">2 × players</strong> for an odd roster (with the rotating rests). Someone who joins mid-season may rest a bit more than everyone else — they can&apos;t play the weeks they missed — but every pair still meets exactly twice.</p>
      </Section>

      <Section icon={UserPlus} title="When someone joins mid-season">
        <p>An admin can add a player to a tournament that&apos;s already running. When that happens:</p>
        <ul className="space-y-2">
          <li><strong className="text-foreground">Already-played matchdays stay frozen</strong> — no result ever moves.</li>
          <li>The newcomer is woven into the <strong className="text-foreground">upcoming matchdays</strong>, one game per week.</li>
          <li>The games they can&apos;t fit into the remaining weeks — their backlog for the weeks they missed — become <strong className="text-foreground">catch-up games</strong>.</li>
        </ul>
        <p>So a newcomer plays their scheduled future games week-by-week <em>and</em> works through their catch-up list whenever they can arrange the matches. Every pair still ends up playing exactly twice.</p>
      </Section>

      <Section icon={Swords} title="Daily tournaments">
        <p><strong className="text-foreground">Anyone signed in</strong> can spin up a quick one-off tournament at <strong className="text-foreground">/dailytournament</strong> — great for a lunch or after-work session. It&apos;s completely separate from the official league (nothing counts toward the season).</p>
        <ul className="space-y-2">
          <li>Pick a <strong className="text-foreground">format</strong> — <strong className="text-foreground">Knockout</strong> (single-elimination bracket) or <strong className="text-foreground">League</strong> (everyone plays everyone) — and a <strong className="text-foreground">mode</strong>: <strong className="text-foreground">Singles</strong> or <strong className="text-foreground">Doubles</strong>.</li>
          <li>Add players from the <strong className="text-foreground">league members</strong> or type in <strong className="text-foreground">guests</strong>. For doubles, add everyone then tap <strong className="text-foreground">Generate pairs</strong> to form the teams (re-generate to reshuffle).</li>
          <li>For knockouts you can toggle a <strong className="text-foreground">3rd-place playoff</strong>. Everyone who can play is paired each round; only an odd count leaves someone <strong className="text-foreground">resting</strong> to the next round.</li>
          <li><strong className="text-foreground">Enter results by tapping the scores</strong> — winners auto-advance, the champion (and bronze) fill in, and league standings update live.</li>
          <li>It runs in <strong className="text-foreground">your browser</strong> (saved on that device) and is full-screen friendly for a TV. Use <strong className="text-foreground">New</strong> to start over.</li>
        </ul>
      </Section>

      {session.isAdmin && (
        <Section icon={Shield} title="For admins">
          <ul className="space-y-2">
            <li><strong className="text-foreground">Create a tournament</strong> to open registration, optionally set a <strong className="text-foreground">start date</strong>, then <strong className="text-foreground">Close registration &amp; start</strong> to generate the schedule.</li>
            <li><strong className="text-foreground">Players join themselves</strong> while registration is open — via a Join button on their dashboard or an invite link. You can also <strong className="text-foreground">add players manually</strong> from the Admin panel, and any <strong className="text-foreground">mid-season</strong> additions must be done by an admin.</li>
            <li><strong className="text-foreground">Run more than one tournament</strong> — only the one marked <strong className="text-foreground">Live</strong> is visible to players; use extra ones to test or fix things without touching the live season. <strong className="text-foreground">Set as live</strong> promotes one for everyone to see.</li>
            <li><strong className="text-foreground">Schedule breaks</strong> (during registration) — choose weeks to leave matchday-free (holidays); generation skips them and resumes the next week.</li>
            <li><strong className="text-foreground">Correct a confirmed result</strong> from a game&apos;s page if a score was wrong.</li>
            <li><strong className="text-foreground">Add a player mid-season</strong> — rebuilds the unplayed schedule and creates catch-up games for them (above).</li>
            <li><strong className="text-foreground">Edit a future matchday</strong> from its page: change who plays whom, add/remove a game, reorder, or rest a player (even rosters).</li>
            <li><strong className="text-foreground">Regenerate schedule</strong> — rebuilds only the not-yet-played matchdays for the current roster. Played matchdays are never touched, and every pair still plays exactly twice.</li>
            <li><strong className="text-foreground">Forfeit unplayed games</strong> (including catch-up games, from the game&apos;s page), <strong className="text-foreground">eliminate a player</strong>, <strong className="text-foreground">reset a password</strong>, and <strong className="text-foreground">end the tournament</strong>.</li>
            <li><strong className="text-foreground">Manage accounts</strong> (Admin → Accounts): <strong className="text-foreground">Mark as left</strong> archives a member who is no longer in the company — they&apos;re hidden from player pickers (daily tournament, add-player) but <strong className="text-foreground">kept in every past recap and standing</strong>, and can be reactivated anytime. <strong className="text-foreground">Delete</strong> permanently removes an account, and is only offered for accounts with <strong className="text-foreground">no games</strong> (e.g. guests/test accounts) — real players should be archived so history stays intact.</li>
            <li><strong className="text-foreground">Office display</strong> and <strong className="text-foreground">Daily tournament</strong> — open the TV wall board or a one-off tournament from the Admin panel (see the Daily tournaments section above).</li>
          </ul>
        </Section>
      )}

      {session.isAdmin && (
        <Section icon={AlertTriangle} title="Schedule health (admins)">
          <p>The schedule must keep every pair meeting exactly twice with no player double-booked in a week. After edits, the app flags problems:</p>
          <ul className="space-y-2">
            <li>The <strong className="text-foreground">matchday list</strong> shows a ⚠️ icon on any matchday with a conflict, plus a banner listing each issue — e.g. <em>&ldquo;Isma vs Sameer is scheduled 3× (should be 2)&rdquo;</em> and the matching <em>&ldquo;Ana vs Jelle is only scheduled 1×&rdquo;</em>.</li>
            <li>A matchday&apos;s page warns you about duplicate pairings there and where else those players meet.</li>
          </ul>
          <p>To fix it, use <strong className="text-foreground">Regenerate schedule</strong> — it rebuilds all unplayed matchdays cleanly so every pair meets exactly twice again, without touching games that already have a result. (Untangling it by hand tends to just move the problem around.)</p>
        </Section>
      )}
    </div>
  )
}
