'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Shield, Home, Trophy, CalendarDays, BookOpen, Sun, Moon, Swords, Menu, Award, Dices, TrendingUp } from 'lucide-react'

interface Props {
  name: string
  email: string
  isAdmin: boolean
  avatarColor: string | null
  tournamentName: string | null
}

const navLinks = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/scoreboard', label: 'Scoreboard', icon: Trophy },
  { href: '/elo', label: 'ELO', icon: TrendingUp },
  { href: '/matchdays', label: 'Matchdays', icon: CalendarDays },
]

export default function AppNav({ name, email, isAdmin, avatarColor, tournamentName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  // Bottom tab bar (mobile): the four main sections, plus Profile which is rendered separately
  // below because it shows the user's avatar instead of a plain icon. Admin deliberately isn't
  // here — a sixth tab squeezes every label past the point of being readable on a phone, and
  // admins already reach it from the account menu.
  const bottomLinks = navLinks

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl relative flex items-center justify-between h-14">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2 min-w-0">
            <span className="shrink-0">🏓</span>
            <span className="hidden sm:inline">Zenz Ping Pong League</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  (pathname.startsWith(link.href) && link.href !== '/dashboard') ||
                  (pathname === link.href && link.href === '/dashboard')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Mobile: centered active-tournament name (the brand text is hidden at this width). */}
        <span className="sm:hidden absolute left-1/2 -translate-x-1/2 max-w-[55%] truncate text-center font-bold pointer-events-none">
          {tournamentName ?? 'Ping Pong League'}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer rounded-full">
            {/* Mobile: hamburger. Desktop: the user's avatar. */}
            <span className="sm:hidden flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </span>
            <PlayerAvatar name={name} avatarColor={avatarColor} className="hidden sm:block h-8 w-8" fallbackClassName="text-xs" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
            <DropdownMenuSeparator />
            {/* Profile lives in the bottom tab bar on mobile, so only show it here on desktop. */}
            <DropdownMenuItem render={<Link href="/profile" />} className="hidden sm:flex">
              <User className="mr-2 h-4 w-4" />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/my-games" />}>
              <Swords className="mr-2 h-4 w-4" />
              My games
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/recap" />}>
              <Award className="mr-2 h-4 w-4" />
              Season recap
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dailytournament" />}>
              <Dices className="mr-2 h-4 w-4" />
              Daily tournament
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/info" />}>
              <BookOpen className="mr-2 h-4 w-4" />
              How it works
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.preventDefault(); setTheme(isDark ? 'light' : 'dark') }}
              className="cursor-pointer"
            >
              {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem render={<Link href="/admin" />} className="sm:hidden">
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer"
              variant="destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* Mobile bottom nav. Each tab uses a fixed-size icon slot so icons and the
        avatar share one baseline and the labels below them line up exactly. */}
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-stretch h-16">
      {bottomLinks.map(link => {
        const active = isActive(link.href)
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1 text-xs font-medium leading-none transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <span className="truncate max-w-full">{link.label}</span>
          </Link>
        )
      })}
      <Link
        href="/profile"
        className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1 text-xs font-medium leading-none transition-colors ${
          isActive('/profile') ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center shrink-0">
          <PlayerAvatar
            name={name}
            avatarColor={avatarColor}
            className={`h-6 w-6 ${isActive('/profile') ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
            fallbackClassName="text-[10px]"
          />
        </span>
        <span className="truncate max-w-full">Profile</span>
      </Link>
    </nav>
    </>
  )
}
