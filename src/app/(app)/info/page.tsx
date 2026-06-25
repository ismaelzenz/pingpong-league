import { getSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpen, Trophy, CalendarDays, ClipboardCheck, Timer, Users, Shield, AlertTriangle, UserPlus,
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
          <li>🏆 <strong className="text-foreground">Scoring</strong> — 1 point per set won, plus a 1-point bonus for winning the match. Win 2–0 → 3 pts. Win 2–1 → 3 pts, the opponent still gets 1 pt. A forfeit is 0 pts and a loss.</li>
          <li>📊 <strong className="text-foreground">Tiebreakers</strong> — points, then sets won, then victories.</li>
        </ul>
      </Section>

      <Section icon={CalendarDays} title="Your week, step by step">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Open your <strong className="text-foreground">dashboard</strong> — it shows your <strong className="text-foreground">catch-up games</strong> (overdue/backlog) and your <strong className="text-foreground">upcoming games</strong>.</li>
          <li><strong className="text-foreground">Play your match</strong> during its week. Catch-up games can be played anytime.</li>
          <li>One player <strong className="text-foreground">enters the score</strong>; the other <strong className="text-foreground">confirms</strong> it.</li>
          <li>Check the <strong className="text-foreground">Scoreboard</strong>, and tap any player&apos;s avatar to see their stats and your head-to-head.</li>
        </ol>
        <p>That&apos;s the whole loop: play → report → confirm → repeat.</p>
      </Section>

      <Section icon={ClipboardCheck} title="Entering & confirming results">
        <ul className="space-y-2">
          <li>Either player can <strong className="text-foreground">enter</strong> a result (not before the matchday&apos;s week has started).</li>
          <li>The game then shows <strong className="text-foreground">Awaiting confirmation</strong> — the <em>other</em> player confirms it (you can&apos;t confirm your own entry).</li>
          <li>If it&apos;s wrong, the other player can <strong className="text-foreground">dispute</strong> it, clearing it back to pending.</li>
          <li>Either player or an admin can <strong className="text-foreground">postpone</strong> a pending game.</li>
          <li>Once <strong className="text-foreground">confirmed</strong>, the result is final and the scoreboard updates automatically.</li>
        </ul>
      </Section>

      <Section icon={Timer} title="Catch-up games">
        <p>A <strong className="text-foreground">catch-up game</strong> is one owed outside the normal weekly grid. It shows in the <strong className="text-foreground">Catch-up</strong> section of your dashboard and is visible to <strong className="text-foreground">both</strong> players, so everyone knows a game is outstanding. Play it anytime — it counts toward the scoreboard once confirmed.</p>
        <p>You&apos;ll see them when a game is <strong className="text-foreground">overdue</strong> (its week passed unplayed) or as a newcomer&apos;s <strong className="text-foreground">backlog</strong> (see below). They aren&apos;t part of any matchday&apos;s line-up, so they don&apos;t change a matchday&apos;s played count or byes.</p>
      </Section>

      <Section icon={Users} title="Matchdays & byes">
        <p>Each matchday is one week. When the number of players is <strong className="text-foreground">odd</strong>, one player sits out each matchday — a <strong className="text-foreground">bye</strong> — and byes rotate so everyone sits out the same number of times. A matchday page shows who&apos;s on a bye that week.</p>
        <p className="text-xs">Matchdays total <strong className="text-foreground">2 × (players − 1)</strong> for an even roster, or <strong className="text-foreground">2 × players</strong> for an odd roster (with the rotating byes).</p>
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

      {session.isAdmin && (
        <Section icon={Shield} title="For admins">
          <ul className="space-y-2">
            <li><strong className="text-foreground">Create a tournament</strong> to open registration, then <strong className="text-foreground">Close registration &amp; start</strong> to generate the schedule.</li>
            <li><strong className="text-foreground">Invite players</strong> (during registration) — share a join link so colleagues can sign up themselves.</li>
            <li><strong className="text-foreground">Schedule breaks</strong> (during registration) — choose weeks to leave matchday-free (holidays); generation skips them and resumes the next week.</li>
            <li><strong className="text-foreground">Correct a confirmed result</strong> from a game&apos;s page if a score was wrong.</li>
            <li><strong className="text-foreground">Add a player mid-season</strong> — rebuilds the unplayed schedule and creates catch-up games for them (above).</li>
            <li><strong className="text-foreground">Edit a future matchday</strong> from its page: change who plays whom, add/remove a game, reorder, or give a bye (even rosters).</li>
            <li><strong className="text-foreground">Regenerate schedule</strong> — rebuilds only the not-yet-played matchdays for the current roster. Played matchdays are never touched, and every pair still plays exactly twice.</li>
            <li><strong className="text-foreground">Forfeit unplayed games</strong>, <strong className="text-foreground">eliminate a player</strong>, <strong className="text-foreground">reset a password</strong>, and <strong className="text-foreground">end the tournament</strong>.</li>
          </ul>
        </Section>
      )}

      {session.isAdmin && (
        <Section icon={AlertTriangle} title="Schedule health (admins)">
          <p>The schedule must keep every pair meeting exactly twice with no player double-booked in a week. After edits, the app flags problems:</p>
          <ul className="space-y-2">
            <li>The <strong className="text-foreground">matchday list</strong> shows a ⚠️ icon on any matchday with a conflict, plus a banner listing each issue — e.g. <em>&ldquo;Isma vs Sameer is scheduled 3× (should be 2)&rdquo;</em> and the matching <em>&ldquo;Joe vs Kim is only scheduled 1×&rdquo;</em>.</li>
            <li>A matchday&apos;s page warns you about duplicate pairings there and where else those players meet.</li>
          </ul>
          <p>To fix it, use <strong className="text-foreground">Regenerate schedule</strong> — it rebuilds all unplayed matchdays cleanly so every pair meets exactly twice again, without touching games that already have a result. (Untangling it by hand tends to just move the problem around.)</p>
        </Section>
      )}
    </div>
  )
}
