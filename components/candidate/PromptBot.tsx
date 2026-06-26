'use client';

import { useState, useTransition } from 'react';
import { Inbox, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { markGapAddressed } from '@/app/(candidate)/dashboard/ai/actions';
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
 * The prompt bot: surfaces gaps found in real recruiter conversations as
 * targeted expansion prompts, each deep-linking to the brain field to strengthen.
 */
export default function PromptBot({ gaps, focusBrainField }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = gaps.filter((g) => !dismissed.has(g.id));
  if (visible.length === 0) return null;

  function markDone(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      void markGapAddressed({ gapId: id });
    });
  }

  return (
    <section className="rb-card p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
        <Inbox className="size-4 text-[var(--rb-brand)]" />
        What recruiters asked
      </h2>
      <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
        Your AI came up short on these in real conversations. Strengthen the field and the next one lands better.
      </p>

      <ul className="flex flex-col gap-2.5">
        {visible.map((g) => (
          <li key={g.id} className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
            {g.pattern_count >= 3 && (
              <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--color-warning)]">
                <AlertTriangle className="size-3.5" />
                Asked {g.pattern_count}× — recurring
              </span>
            )}
            <p className="text-sm text-[var(--rb-text-secondary)]">{g.suggested_prompt}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {FIELD_LABELS[g.category] && (
                <button
                  onClick={() => focusBrainField(g.category)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
