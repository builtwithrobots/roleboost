'use client';

import { useState, useTransition } from 'react';
import { Inbox, ArrowRight, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { markGapAddressed, adoptGapAnswer } from '@/app/(candidate)/dashboard/ai/actions';
import type { TranscriptGap } from '@/lib/types';

interface Props {
  gaps: TranscriptGap[];
  /** Scroll to + focus the matching brain field in the Build section. */
  focusBrainField: (key: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  leadership_philosophy: 'leadership philosophy',
  key_wins: 'key wins',
  departure_reasons: 'departure reasons',
  biggest_challenge: 'biggest challenge',
  ideal_environment: 'ideal environment',
  manager_needs: 'what you need from a manager',
  honest_weaknesses: 'honest weaknesses',
  wish_questions: 'questions you wish recruiters asked',
  custom_qa: 'custom answers',
};

/**
 * The prompt bot: surfaces gaps found in real recruiter conversations. Gaps
 * that come with a drafted answer (grounded in the brain's own data) get a
 * one-click "Add to my AI" approve path; the rest deep-link to the brain field
 * that needs the candidate's own words.
 */
export default function PromptBot({ gaps, focusBrainField }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = gaps.filter((g) => !dismissed.has(g.id));
  if (visible.length === 0) return null;

  function markDone(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      void markGapAddressed({ gapId: id });
    });
  }

  function adopt(id: string) {
    setErrorId(null);
    setAdoptingId(id);
    startTransition(async () => {
      const result = await adoptGapAnswer({ gapId: id });
      setAdoptingId(null);
      if (result.ok) {
        setAdopted((prev) => new Set(prev).add(id));
      } else {
        setErrorId(id);
      }
    });
  }

  return (
    <section className="rb-card p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
        <Inbox className="size-4 text-[var(--rb-brand)]" />
        What recruiters asked
      </h2>
      <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
        Your AI came up short on these in real conversations. Approve a drafted answer or strengthen
        the field, and the next one lands better.
      </p>

      <ul className="flex flex-col gap-2.5">
        {visible.map((g) => {
          const isAdopted = adopted.has(g.id);
          const draft = g.suggested_answer?.trim() || null;
          return (
            <li key={g.id} className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
              {g.pattern_count >= 3 && (
                <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--color-warning)]">
                  <AlertTriangle className="size-3.5" />
                  Asked {g.pattern_count}×, recurring
                </span>
              )}
              <p className="text-sm text-[var(--rb-text-secondary)]">{g.suggested_prompt}</p>

              {draft && !isAdopted && (
                <div className="mt-2.5 rounded-[var(--radius-md)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/40 p-2.5">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--rb-text-brand)]">
                    <Sparkles className="size-3" />
                    Drafted from what your AI already knows
                  </p>
                  <p className="text-xs italic text-[var(--rb-text-secondary)]">
                    &ldquo;{draft}&rdquo;
                  </p>
                </div>
              )}

              {isAdopted ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                  <Check className="size-3.5" />
                  Added to your custom answers. Your AI uses it from the next conversation.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {draft && (
                    <button
                      onClick={() => adopt(g.id)}
                      disabled={adoptingId === g.id}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Sparkles className="size-3.5" />
                      {adoptingId === g.id ? 'Adding…' : 'Add to my AI'}
                    </button>
                  )}
                  {FIELD_LABELS[g.category] && (
                    <button
                      onClick={() => focusBrainField(g.category)}
                      className={
                        draft
                          ? 'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]'
                          : 'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90'
                      }
                    >
                      Strengthen {FIELD_LABELS[g.category]}
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => markDone(g.id)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text-secondary)]"
                  >
                    <Check className="size-3.5" />
                    Mark done
                  </button>
                  {errorId === g.id && (
                    <span className="text-xs text-[var(--color-error)]">
                      Could not add it just now. Please try again.
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
