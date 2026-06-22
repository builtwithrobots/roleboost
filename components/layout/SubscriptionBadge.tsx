import type { SubscriptionTier, SubscriptionStatus } from '@/lib/types'

const tierConfig: Record<NonNullable<SubscriptionTier> | 'free', { label: string; className: string }> = {
  free:    { label: 'Free',    className: 'bg-[--rb-bg-surface-raised] text-[--rb-text-secondary]' },
  pro:     { label: 'Pro',     className: 'bg-[--rb-brand-subtle] text-[--rb-text-brand]' },
  starter: { label: 'Starter', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  growth:  { label: 'Growth',  className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  scale:   { label: 'Scale',   className: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
}

export default function SubscriptionBadge({ tier, status }: { tier: SubscriptionTier | null; status: SubscriptionStatus }) {
  const key = (status === 'free' || !tier) ? 'free' : tier
  const config = tierConfig[key]

  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}>
      {config.label}
    </div>
  )
}
