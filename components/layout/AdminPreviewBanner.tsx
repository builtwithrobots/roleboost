'use client'

import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

export default function AdminPreviewBanner({ previewRole }: { previewRole: 'candidate' | 'employer' }) {
  const router = useRouter()

  async function exitPreview() {
    await fetch('/api/admin/exit-preview', { method: 'POST' })
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <ShieldAlert className="size-4" strokeWidth={2} />
        Admin preview, viewing as <strong>{previewRole}</strong>
      </span>
      <button
        onClick={exitPreview}
        className="rounded bg-amber-950/10 px-3 py-1 text-xs font-semibold hover:bg-amber-950/20 transition-colors"
      >
        Exit Preview → /admin
      </button>
    </div>
  )
}
