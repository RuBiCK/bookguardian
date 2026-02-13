'use client'

import { useEffect, useState } from 'react'

interface ImpersonationState {
  id: string
  email: string
  name: string | null
}

export default function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<ImpersonationState | null>(null)

  useEffect(() => {
    fetch('/api/admin/impersonate')
      .then((res) => res.json())
      .then((data) => {
        if (data.impersonating) {
          setImpersonating(data.impersonating)
        }
      })
      .catch(() => {
        // Ignore — user is not an admin or not logged in
      })
  }, [])

  if (!impersonating) return null

  const handleEnd = async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-yellow-400 text-yellow-900 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <span>
        Impersonating <strong>{impersonating.email}</strong>
      </span>
      <button
        onClick={handleEnd}
        className="px-3 py-1 bg-yellow-900 text-yellow-100 rounded text-xs font-semibold hover:bg-yellow-800 transition-colors"
      >
        End
      </button>
    </div>
  )
}
