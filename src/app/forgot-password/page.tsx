'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import AuthShell from '@/components/layout/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Something went wrong')
    } else if (data.resetUrl) {
      setResetUrl(data.resetUrl)
    } else {
      // Email not found — show generic message without leaking info
      toast.success('If that account exists, a reset link would be generated. Contact your admin.')
    }
    setLoading(false)
  }

  async function handleCopy() {
    if (!resetUrl) return
    await navigator.clipboard.writeText(resetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (resetUrl) {
    return (
      <AuthShell>
        <Card>
          <CardHeader>
            <CardTitle>Reset link ready</CardTitle>
            <CardDescription>
              Click the button below to set your new password. The link expires in 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href={resetUrl} className="block w-full">
              <Button className="w-full">Set new password</Button>
            </a>
            <p className="text-xs text-muted-foreground text-center">
              On a shared device? Use the copy button and open the link on your own device.
            </p>
            <Button variant="outline" className="w-full" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'Copy link instead'}
            </Button>
          </CardContent>
          <CardFooter>
            <Link href="/login" className="text-sm text-primary hover:underline mx-auto">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="Office tournament tracker">
      <Card>
        <CardHeader>
          <CardTitle>Forgot password?</CardTitle>
          <CardDescription>Enter your email and we&apos;ll generate a reset link for you.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Generating…' : 'Generate reset link'}
            </Button>
            <Link href="/login" className="text-sm text-muted-foreground hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  )
}
