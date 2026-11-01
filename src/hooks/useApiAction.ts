'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface RunOptions<T> {
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** JSON request body. Omit for bodyless requests (e.g. a plain DELETE). */
  body?: unknown
  /** Success toast — a string, or a builder given the parsed response. Omit for no toast. */
  success?: string | ((data: T) => string)
  /** `window.confirm` message shown before the request; cancelling aborts (returns null). */
  confirm?: string
  /** Call `router.refresh()` after success. Default true. */
  refresh?: boolean
}

/**
 * The one client-side "call an API route, toast, refresh" flow, replacing the loading-state +
 * fetch + `res.json().catch` + `if (!res.ok) throw` + toast boilerplate copied across components.
 *
 *   const { run, loading } = useApiAction()
 *   await run(`/api/tournaments/${id}`, { method: 'DELETE', confirm: 'Delete?', success: 'Deleted' })
 *
 * Returns the parsed response on success, or `null` if the user cancelled or the request failed
 * (the error toast is shown automatically), so callers can branch on the result. Failures are
 * reported specifically — an unreachable server, a route's own error message, or the status code —
 * rather than collapsing everything into one unhelpful line.
 */
export function useApiAction() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function run<T = Record<string, unknown>>(url: string, opts: RunOptions<T> = {}): Promise<T | null> {
    const { method = 'POST', body, success, confirm: confirmMsg, refresh = true } = opts
    if (confirmMsg && !confirm(confirmMsg)) return null

    setLoading(true)
    try {
      let res: Response
      try {
        res = await fetch(url, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      } catch {
        // fetch only rejects when the request never got an answer — offline, or the server is down.
        // Worth saying so plainly: "something went wrong" sends people hunting for a bug in the app.
        throw new Error('Couldn’t reach the server — check your connection and try again.')
      }
      const data = await res.json().catch(() => ({}))
      // A 401 means the cookie no longer identifies anyone (signed out elsewhere, or the account
      // is gone). Toasting alone would leave them tapping a button that can never work, so send
      // them to the login page.
      if (res.status === 401) {
        toast.error(data?.error ?? 'Please sign in again.')
        router.push('/login')
        return null
      }
      // Fall back to the status code rather than a bare "something went wrong", so an unexpected
      // failure still tells you (and anyone you report it to) what actually happened.
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status} ${res.statusText || 'error'})`)
      if (success) toast.success(typeof success === 'function' ? success(data as T) : success)
      if (refresh) router.refresh()
      return data as T
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { run, loading, router }
}
