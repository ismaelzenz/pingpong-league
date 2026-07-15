'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-pulls the server component's data on an interval so the wall board stays live without a
// full page reload. router.refresh() re-runs the (force-dynamic) server render and React swaps
// the new numbers in place — no flicker, no lost scroll.
export default function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}
