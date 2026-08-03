'use client'

import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useApiAction } from '@/hooks/useApiAction'

export default function DeleteUserButton({ userId, name, email }: { userId: number; name: string; email: string }) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
      disabled={loading}
      onClick={() => run(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        confirm:
          `Permanently delete ${name}'s account (${email})?\n\n` +
          `This removes their login and all their data from the database. It cannot be undone.`,
        success: `${name}'s account deleted`,
      })}
    >
      <Trash2 className="w-3.5 h-3.5 mr-1" />
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
