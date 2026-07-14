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
 * (the error toast is shown automatically), so callers can branch on the result.
 */
export function useApiAction() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function run<T = Record<string, unknown>>(url: string, opts: RunOptions<T> = {}): Promise<T | null> {
    const { method = 'POST', body, success, confirm: confirmMsg, refresh = true } = opts
    if (confirmMsg && !confirm(confirmMsg)) return null

    setLoading(true)
    try {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Something went wrong')
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
