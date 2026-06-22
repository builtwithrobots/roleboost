// components/ui/empty-state.tsx
// Centered, branded empty / placeholder state used across dashboard pages.
import clsx from 'clsx'
import type { ElementType, ReactNode } from 'react'

interface Props {
  icon: ElementType
  title: string
  description?: ReactNode
  /** Optional CTA element (button or link). */
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-dashed border-[var(--rb-border-strong)] bg-[var(--rb-bg-surface)] px-6 py-16 text-center',
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/50">
        <Icon className="size-6 text-[var(--rb-brand)]" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-base font-semibold text-[var(--rb-text)]">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--rb-text-secondary)]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
