'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>This reset link is missing a token. Please request a new one.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline mx-auto">
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
    } else {
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password updated!</CardTitle>
          <CardDescription>You can now sign in with your new password. Redirecting…</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="text-sm text-primary hover:underline mx-auto">
            Go to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" placeholder="At least 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" placeholder="Repeat your new password"
              value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
          <Link href="/login" className="text-sm text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏓</div>
          <h1 className="text-2xl font-bold">Ping Pong League</h1>
        </div>
        <Suspense fallback={<Card><CardContent className="pt-6 text-center text-muted-foreground">Loading…</CardContent></Card>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
