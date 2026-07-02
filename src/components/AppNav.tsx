'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Shield, Home, Trophy, CalendarDays, BookOpen, Sun, Moon, Swords } from 'lucide-react'

interface Props {
  name: string
  email: string
  isAdmin: boolean
  avatarColor: string | null
}

const navLinks = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/scoreboard', label: 'Scoreboard', icon: Trophy },
  { href: '/matchdays', label: 'Matchdays', icon: CalendarDays },
]

export default function AppNav({ name, email, isAdmin, avatarColor }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
            <span>🏓</span>
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

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs text-white" style={{ backgroundColor: avatarColor ?? undefined }}>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <User className="mr-2 h-4 w-4" />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/my-games" />}>
              <Swords className="mr-2 h-4 w-4" />
              My games
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

    {/* Mobile bottom nav */}
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-center justify-around h-16 px-2">
      {navLinks.map(link => {
        const active = (pathname.startsWith(link.href) && link.href !== '/dashboard') ||
          (pathname === link.href && link.href === '/dashboard')
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-md text-xs font-medium transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            {link.label}
          </Link>
        )
      })}
      {isAdmin && (
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-md text-xs font-medium transition-colors ${
            pathname.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Shield className="w-5 h-5" />
          Admin
        </Link>
      )}
    </nav>
    </>
  )
}
