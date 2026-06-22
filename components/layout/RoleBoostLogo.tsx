import Link from 'next/link'

export default function RoleBoostLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-border-focus)]">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-brand)] text-white shadow-sm">
        <span className="font-display text-sm font-extrabold leading-none">R</span>
      </div>
      {!compact && (
        <span className="font-display text-base font-bold tracking-tight text-[var(--rb-text)]">
          RoleBoost
        </span>
      )}
    </Link>
  )
}
