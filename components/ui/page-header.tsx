// components/ui/page-header.tsx
// Uniform dashboard page title band. Matches the header treatment used across
// the candidate and employer dashboards so every page reads as one product.
import clsx from 'clsx'
import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: ReactNode
  /** Right-aligned actions (buttons, links). */
  actions?: ReactNode
  /** Small uppercase overline above the title. */
  eyebrow?: string
  /** Max width of the inner content; align with the page body. */
  width?: string
  className?: string
}

export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  width = 'max-w-6xl',
  className,
}: Props) {
  return (
    <header
      className={clsx(
        'border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4',
        className
      )}
    >
      <div className={clsx('mx-auto flex items-start justify-between gap-4', width)}>
        <div className="min-w-0">
          {eyebrow && <p className="rb-section-label mb-1.5">{eyebrow}</p>}
          <h1 className="font-display text-xl font-bold tracking-tight text-[var(--rb-text)]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
