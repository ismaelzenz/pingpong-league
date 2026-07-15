'use client'

import { useEffect, useState } from 'react'

// A simple wall clock for the display header. Client-only so it ticks without server round-trips.
export default function DisplayClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setNow(new Date())
    const raf = requestAnimationFrame(update) // first tick on next frame (avoids sync setState-in-effect)
    const id = setInterval(update, 1000)
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
  }, [])

  if (!now) return null
  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}
