'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  name: string
  email: string
  isAdmin: boolean
}

const navLinks = [
  { href: '/dashboard', label: 'Home' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/matchdays', label: 'Matchdays' },
]

export default function AppNav({ name, email, isAdmin }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
            <span>🏓</span>
            <span className="hidden sm:inline">PP League</span>
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
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
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
  )
}
