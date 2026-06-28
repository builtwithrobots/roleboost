import type { LucideIcon } from 'lucide-react';

interface Props {
  Icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

// A compact, plain-language "what this is / why it matters" intro shown at the top
// of an AI Studio tab. Contextual help at the moment of need — teaches without a
// manual. Styled on the shared design tokens so it reads as native.
export default function TabIntro({ Icon, title, children }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] px-4 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--rb-brand-subtle)]">
        <Icon className="size-4 text-[var(--rb-brand)]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--rb-text)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--rb-text-muted)]">{children}</p>
      </div>
    </div>
  );
}
