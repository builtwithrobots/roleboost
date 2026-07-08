import Link from 'next/link';
import {
  Bot,
  Share2,
  MessagesSquare,
  FileText,
  Sparkles,
  FlaskConical,
  Rocket,
  RefreshCw,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

interface Props {
  /** Called when a link is clicked, lets a host modal close itself before navigating. */
  onLinkClick?: () => void;
}

// The loop, drawn once. Plain-language stages of how RoleBoost works end to end.
const LOOP = [
  { label: 'You build your AI', Icon: Bot },
  { label: 'You share your link', Icon: Share2 },
  { label: 'Recruiters chat with it', Icon: MessagesSquare },
  { label: 'You see what they asked', Icon: FileText },
  { label: 'Your AI gets sharper', Icon: Sparkles },
];

// The do-this steps, each deep-linked to where the work happens.
const STEPS = [
  {
    n: 1,
    title: 'Add your résumé',
    body: 'It’s how your AI learns your career. Upload it once.',
    href: '/dashboard/assets',
    cta: 'Assets',
    Icon: FileText,
  },
  {
    n: 2,
    title: 'Build your career AI',
    body: 'Answer a few questions so it can speak for you, gaps, wins, the hard stuff.',
    href: '/dashboard/ai?tab=build',
    cta: 'AI Studio',
    Icon: Bot,
  },
  {
    n: 3,
    title: 'Create your career story',
    body: 'We write the story your AI leads with. Pick the version that sounds like you.',
    href: '/dashboard/ai?tab=context',
    cta: 'Career Story',
    Icon: Sparkles,
  },
  {
    n: 4,
    title: 'Try it yourself',
    body: 'Ask the tough questions a recruiter would, before they do.',
    href: '/dashboard/ai?tab=test',
    cta: 'Test',
    Icon: FlaskConical,
  },
  {
    n: 5,
    title: 'Go live and share your link',
    body: 'Drop it in LinkedIn, your résumé, your email signature. One link, everywhere.',
    href: '/dashboard/share',
    cta: 'Share Hub',
    Icon: Rocket,
  },
];

export default function HowItWorks({ onLinkClick }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--rb-text)]">
          How RoleBoost works
        </h1>
        <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
          You build a personal career AI once. It answers recruiters for you, 24/7, over a single
          link, and it gets smarter every time someone uses it.
        </p>
      </header>

      {/* The loop */}
      <section aria-label="The RoleBoost loop" className="rb-card p-5">
        <div className="flex flex-col flex-wrap items-stretch gap-2 sm:flex-row sm:items-center">
          {LOOP.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-2">
                <s.Icon className="size-4 shrink-0 text-[var(--rb-brand)]" />
                <span className="text-xs font-medium text-[var(--rb-text)]">{s.label}</span>
              </div>
              {i < LOOP.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 text-[var(--rb-text-muted)] sm:block" aria-hidden />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)]">
          <RefreshCw className="size-3.5 text-[var(--rb-brand)]" aria-hidden />
          And it repeats, every conversation shows you what to sharpen, so your AI keeps improving.
        </p>
      </section>

      {/* The steps */}
      <section aria-label="How to set it up" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[var(--rb-text)]">Setting it up, step by step</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rb-card flex items-start gap-3 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)] font-data text-xs font-semibold text-[var(--rb-brand)]">
                {step.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--rb-text)]">{step.title}</p>
                <p className="mt-0.5 text-xs text-[var(--rb-text-muted)]">{step.body}</p>
              </div>
              <Link
                href={step.href}
                onClick={onLinkClick}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--rb-brand)] transition-opacity hover:opacity-80"
              >
                {step.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Why it's different */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] p-4">
        <p className="text-xs leading-relaxed text-[var(--rb-text-secondary)]">
          <span className="font-semibold text-[var(--rb-text)]">Why this beats a résumé alone:</span>{' '}
          a résumé can’t answer “why did you leave?” or “walk me through that gap.” Your AI can, using
          only what you’ve told it, never invented, and every recruiter conversation teaches you
          exactly where to add more. The longer you use it, the stronger it gets.
        </p>
      </section>
    </div>
  );
}
