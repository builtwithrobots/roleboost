'use client';

import { useState, useTransition } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Star,
  Quote,
  MessageSquareQuote,
  Hash,
  Compass,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { selectCareerContextAngle } from '@/app/(candidate)/dashboard/ai/actions';
import type {
  CareerContextAngle,
  CareerContextAngleKey,
  CareerContextDrafts,
  CareerContextStoryType,
} from '@/lib/types';

interface Props {
  initialDrafts: CareerContextDrafts | null;
  /** Whether a résumé is on file; without one (and no drafts) we nudge to Assets. */
  hasResume?: boolean;
}

const STORY_TYPE_LABELS: Record<CareerContextStoryType, string> = {
  career_arc: 'The Career Arc',
  builder: 'The Builder',
  problem_solver: 'The Problem Solver',
  leadership: 'The Leadership Story',
  skeptic_champion: 'The Skeptic & the Champion',
  specialist: 'The Specialist',
};

export default function ContextDocumentPanel({ initialDrafts, hasResume = false }: Props) {
  const [drafts, setDrafts] = useState<CareerContextDrafts | null>(initialDrafts);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function update() {
    setError(null);
    setUpdating(true);
    try {
      const res = await fetch('/api/career-context/augment', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        if (res.status === 402) {
          setError('Updating your document needs an active subscription or trial.');
        } else if (body?.error?.message) {
          setError(body.error.message);
        } else {
          setError('Could not update your document just now. Please try again.');
        }
        return;
      }
      const data = (await res.json()) as { drafts: CareerContextDrafts };
      setDrafts(data.drafts);
    } catch {
      setError('Could not update your document just now. Please try again.');
    } finally {
      setUpdating(false);
    }
  }

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/career-context/generate', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        if (res.status === 402) {
          setError('Generating your career story needs an active subscription or trial.');
        } else if (body?.error?.message) {
          setError(body.error.message);
        } else {
          setError('Could not generate your document just now. Please try again.');
        }
        return;
      }
      const data = (await res.json()) as { drafts: CareerContextDrafts };
      setDrafts(data.drafts);
    } catch {
      setError('Could not generate your document just now. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function select(angle: CareerContextAngleKey) {
    if (!drafts) return;
    setError(null);
    startTransition(async () => {
      const res = await selectCareerContextAngle({ angle });
      if (res.ok) {
        setDrafts({ ...drafts, selected: angle });
      } else {
        setError('Could not set that angle as active. Please try again.');
      }
    });
  }

  // Nothing to generate from and nothing generated yet: point the candidate to
  // the Assets section to upload their résumé first.
  if (!hasResume && !drafts) {
    return <ResumeFallback />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
          <Sparkles className="size-4 text-[var(--rb-brand)]" />
          Your career story
        </h2>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          A professionally written story built from your résumé and career sources. Generate two
          versions, pick the one that sounds most like you, your AI leads from it when recruiters
          ask about your background.
        </p>
      </header>

      {!drafts ? (
        <EmptyState onGenerate={generate} generating={generating} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {(['A', 'B'] as CareerContextAngleKey[]).map((key) => (
              <AngleCard
                key={key}
                angle={drafts.angles[key]}
                isRecommended={drafts.recommended === key}
                isSelected={drafts.selected === key}
                onSelect={() => select(key)}
                busy={pending}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs text-[var(--rb-text-muted)]">
              {drafts.selected
                ? 'Your AI is using the selected angle. Added new wins, answers, or sources since? Update folds them in, your document stays sharp instead of just longer.'
                : 'Pick an angle above to make it active in your AI.'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {drafts.selected && (
                <button
                  onClick={update}
                  disabled={updating || generating}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {updating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {updating ? 'Updating…' : 'Update document'}
                </button>
              )}
              <button
                onClick={generate}
                disabled={generating || updating}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)] disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </section>
  );
}

function ResumeFallback() {
  return (
    <div className="rb-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
        <Upload className="size-5 text-[var(--rb-brand)]" />
      </span>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-[var(--rb-text)]">Upload your résumé first</h3>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          Your career story is written from your résumé and career sources. Add your résumé in the
          Assets section, then come back here to generate it.
        </p>
      </div>
      <Link
        href="/dashboard/assets"
        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Upload className="size-4" />
        Go to Assets
      </Link>
    </div>
  );
}

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <div className="rb-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
        <Sparkles className="size-5 text-[var(--rb-brand)]" />
      </span>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-[var(--rb-text)]">
          Generate your career story
        </h3>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          We read your résumé and any career sources, then write two distinct versions of your
          career story. Pick the one that fits, it becomes the foundation your AI reasons from.
        </p>
      </div>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {generating ? 'Writing your story…' : 'Generate my story'}
      </button>
      {generating && (
        <p className="text-xs text-[var(--rb-text-muted)]">
          This takes a moment, we&apos;re synthesizing your whole career.
        </p>
      )}
    </div>
  );
}

function AngleCard({
  angle,
  isRecommended,
  isSelected,
  onSelect,
  busy,
}: {
  angle: CareerContextAngle;
  isRecommended: boolean;
  isSelected: boolean;
  onSelect: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={`rb-card flex flex-col gap-4 p-5 transition-shadow ${
        isSelected ? 'ring-2 ring-[var(--rb-brand)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--rb-text)]">{angle.name}</span>
            {isRecommended && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rb-brand-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-brand)]">
                <Star className="size-2.5" />
                Recommended
              </span>
            )}
          </div>
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)]">
            <Compass className="size-3" />
            {STORY_TYPE_LABELS[angle.story_type] ?? angle.story_type}
          </span>
        </div>
      </div>

      {angle.narrative && (
        <p className="text-sm leading-relaxed text-[var(--rb-text-secondary)]">{angle.narrative}</p>
      )}

      {angle.hook && (
        <div className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-2">
          <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--rb-text)]">
            <Quote className="mt-0.5 size-3 shrink-0 text-[var(--rb-brand)]" />
            {angle.hook}
          </p>
        </div>
      )}

      {angle.hard_question?.question && (
        <div>
          <p className="text-xs font-semibold text-[var(--rb-text-secondary)]">
            {angle.hard_question.question}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--rb-text-muted)]">
            {angle.hard_question.answer}
          </p>
        </div>
      )}

      {angle.key_numbers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {angle.key_numbers.map((num, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--rb-text-secondary)]">
              <Hash className="mt-0.5 size-3 shrink-0 text-[var(--rb-brand)]" />
              {num}
            </li>
          ))}
        </ul>
      )}

      {(angle.evidence_snippets?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--rb-border)] pt-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
            <MessageSquareQuote className="size-3 text-[var(--rb-brand)]" />
            What others say
          </span>
          {angle.evidence_snippets.map((e, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-[var(--rb-border-brand)] pl-2.5 text-xs italic leading-relaxed text-[var(--rb-text-secondary)]"
            >
              “{e.quote}”
              {e.source && <span className="mt-0.5 block not-italic text-[var(--rb-text-muted)]">{e.source}</span>}
            </blockquote>
          ))}
        </div>
      )}

      <div className="mt-auto pt-1">
        {isSelected ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="size-4" />
            Active in your AI
          </span>
        ) : (
          <button
            onClick={onSelect}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Use this angle
          </button>
        )}
      </div>
    </div>
  );
}
