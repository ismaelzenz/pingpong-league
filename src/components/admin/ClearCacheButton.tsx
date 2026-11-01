'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useApiAction } from '@/hooks/useApiAction'

export default function ClearCacheButton() {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => run('/api/admin/cache', { success: 'Cache cleared — every page now reads fresh data' })}
    >
      <RefreshCw className="w-4 h-4 mr-1" />
      {loading ? 'Clearing…' : 'Clear cache'}
    </Button>
  )
}
