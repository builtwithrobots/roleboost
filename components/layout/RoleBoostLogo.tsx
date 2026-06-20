import Link from 'next/link'

export default function RoleBoostLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[--rb-border-focus] rounded-md">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[--rb-brand] text-white shadow-sm">
        <span className="font-display text-sm font-extrabold leading-none">R</span>
      </div>
      {!compact && (
        <span className="font-display text-base font-bold tracking-tight text-[--rb-text]">
          RoleBoost
        </span>
      )}
    </Link>
  )
}
