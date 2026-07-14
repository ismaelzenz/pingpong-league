'use client'

import { useState } from 'react'
import { useApiAction } from '@/hooks/useApiAction'

const COLORS = [
  '#7C3AED', '#2563EB', '#0891B2', '#059669',
  '#65A30D', '#CA8A04', '#EA580C', '#DC2626',
  '#DB2777', '#475569',
]

export default function ProfileColorForm({ currentColor }: { currentColor: string | null }) {
  const { run, loading } = useApiAction()
  const [selected, setSelected] = useState(currentColor)

  async function handleSave(color: string) {
    setSelected(color)
    await run('/api/profile', { method: 'PATCH', body: { avatarColor: color }, success: 'Avatar colour updated!' })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Avatar colour</p>
      <div className="flex flex-wrap gap-2">
        {COLORS.map(color => (
          <button
            key={color}
            disabled={loading}
            onClick={() => handleSave(color)}
            className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: color,
              boxShadow: selected === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}
