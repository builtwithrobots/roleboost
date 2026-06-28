'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  Bot,
  Sparkles,
  FlaskConical,
  Rocket,
  ChevronRight,
  X,
  PartyPopper,
} from 'lucide-react';
import type { OnboardingProgress } from '@/lib/candidate/onboarding-progress';

interface Props {
  progress: OnboardingProgress;
}

interface Step {
  key: keyof Pick<OnboardingProgress, 'resumeAdded' | 'brainBuilt' | 'contextReady' | 'tested' | 'live'>;
  title: string;
  blurb: string;
  cta: string;
  href: string;
  Icon: typeof FileText;
}

// Plain-language, second-person steps. Each maps to a real progress signal and
// deep-links to where the candidate does the work.
const STEPS: Step[] = [
  {
    key: 'resumeAdded',
    title: 'Add your résumé',
    blurb: 'This is what your AI learns your career from. Upload it once and we do the rest.',
    cta: 'Add résumé',
    href: '/dashboard/assets',
    Icon: FileText,
  },
  {
    key: 'brainBuilt',
    title: 'Build your career AI',
    blurb: 'Answer a few questions (or fill in the details) so your AI can speak for you — gaps, wins, the hard stuff.',
    cta: 'Open AI Studio',
    href: '/dashboard/ai',
    Icon: Bot,
  },
  {
    key: 'contextReady',
    title: 'Create your context document',
    blurb: 'We write the story your AI leads with. Pick the version that sounds most like you.',
    cta: 'Go to Context Document',
    href: '/dashboard/ai',
    Icon: Sparkles,
  },
  {
    key: 'tested',
    title: 'Try your AI',
    blurb: 'Ask it the tough questions a recruiter would, and see how it answers — before they do.',
    cta: 'Test your AI',
    href: '/dashboard/ai',
    Icon: FlaskConical,
  },
  {
    key: 'live',
    title: 'Go live and share your link',
    blurb: 'Turn your AI on, publish, and drop your link in LinkedIn, your résumé, and your email signature.',
    cta: 'Publish & share',
    href: '/dashboard/share',
    Icon: Rocket,
  },
];

const DISMISS_KEY = 'rb-getting-started-dismissed';
const DISMISS_EVENT = 'rb-getting-started-dismiss';

// Read the client-only dismissed flag without a setState-in-effect or a hydration
// mismatch: useSyncExternalStore renders false on the server, then reconciles to
// the real localStorage value on the client. setItem in the same tab does not
// emit a 'storage' event, so dismiss() dispatches a custom event to re-render.
function subscribe(cb: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(DISMISS_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function GettingStarted({ progress }: Props) {
  // When everything is done, the card collapses to a one-time celebratory note
  // the candidate can dismiss for good. While steps remain, it always shows.
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (progress.allDone && dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — fine, it just shows again next visit */
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  if (progress.allDone) {
    return (
      <section
        className="rb-card mb-6 flex items-center gap-3 p-4"
        aria-label="Setup complete"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
          <PartyPopper className="size-4 text-[var(--color-success)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--rb-text)]">You&apos;re all set — your AI is live.</p>
          <p className="text-xs text-[var(--rb-text-muted)]">
            Keep it sharp: add new wins anytime and your AI gets better.{' '}
            <Link href="/dashboard/ai" className="font-medium text-[var(--rb-brand)] hover:underline">
              Open AI Studio
            </Link>
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss setup complete"
          className="shrink-0 rounded p-1 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text)]"
        >
          <X className="size-4" />
        </button>
      </section>
    );
  }

  // The first incomplete step is the highlighted "next action".
  const nextIndex = STEPS.findIndex((s) => !progress[s.key]);
  const pct = Math.round((progress.completed / progress.total) * 100);

  return (
    <section className="rb-card mb-6 overflow-hidden" aria-label="Getting started">
      <div className="border-b border-[var(--rb-border)] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">Get your AI ready</h2>
          <span className="font-data text-xs text-[var(--rb-text-muted)]">
            {progress.completed} of {progress.total} done
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          Five steps to a live career AI that answers recruiters for you, 24/7.
        </p>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--rb-bg-surface-raised)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div
            className="h-full rounded-full bg-[var(--rb-brand)] transition-[width] duration-[var(--duration-base)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="divide-y divide-[var(--rb-border)]">
        {STEPS.map((step, i) => {
          const done = progress[step.key];
          const isNext = i === nextIndex;
          return (
            <li
              key={step.key}
              className={`flex items-start gap-3 px-5 py-3.5 ${isNext ? 'bg-[var(--rb-brand-subtle)]/40' : ''}`}
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                {done ? (
                  <CheckCircle2 className="size-5 text-[var(--color-success)]" />
                ) : (
                  <step.Icon className={`size-5 ${isNext ? 'text-[var(--rb-brand)]' : 'text-[var(--rb-text-muted)]'}`} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    done ? 'text-[var(--rb-text-muted)] line-through decoration-[var(--rb-border)]' : 'text-[var(--rb-text)]'
                  }`}
                >
                  {step.title}
                </p>
                {!done && <p className="mt-0.5 text-xs text-[var(--rb-text-muted)]">{step.blurb}</p>}
              </div>

              {!done && (
                <Link
                  href={step.href}
                  className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isNext
                      ? 'bg-[var(--rb-brand)] text-white hover:opacity-90'
                      : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-brand)]'
                  }`}
                >
                  {step.cta}
                  <ChevronRight className="size-3.5" />
                </Link>
              )}

              {done && (
                <span className="sr-only">completed</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
