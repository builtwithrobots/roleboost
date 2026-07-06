'use client';

import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';

interface Props {
  /** Fill the Headline field with a chosen suggestion (candidate can then edit). */
  onUse: (headline: string) => void;
}

/**
 * Optional AI assist under the Headline field: generates a few elite,
 * grounded headline options from the candidate's own materials. Picking one
 * fills the field; nothing is auto-saved and the candidate can edit freely.
 */
export default function HeadlineAssist({ onUse }: Props) {
  const [headlines, setHeadlines] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUploads, setNeedsUploads] = useState(false);
  const [used, setUsed] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setNeedsUploads(false);
    try {
      const res = await fetch('/api/profile/suggest-headline', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not generate a headline.');
        return;
      }
      if (json.needsUploads) {
        setNeedsUploads(true);
        setHeadlines([]);
        return;
      }
      setHeadlines(json.headlines ?? []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasResults = headlines !== null && headlines.length > 0;

  return (
    <div className="mt-3">
      {headlines === null && !error ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-border-brand)] hover:text-[var(--rb-text-brand)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-[var(--rb-brand)]" />}
          {loading ? 'Writing a few options…' : 'Write with AI'}
        </button>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--rb-text-muted)]">
            {hasResults ? 'Pick one to drop it in, then edit as you like.' : ''}
          </span>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-text)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Regenerate
          </button>
        </div>
      )}

      {needsUploads && (
        <p className="mt-2 rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] px-3 py-2 text-xs text-[var(--rb-text-muted)]">
          Upload your résumé or add a career source first, then I can write a headline that fits your background.
        </p>
      )}

      {hasResults && (
        <ul className="mt-2 flex flex-col gap-2">
          {headlines!.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3"
            >
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--rb-text-secondary)]">{h}</p>
              <button
                type="button"
                onClick={() => {
                  onUse(h);
                  setUsed(h);
                }}
                className="inline-flex shrink-0 items-center gap-1 self-center rounded-[var(--radius-md)] border border-[var(--rb-border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-border-brand)] hover:text-[var(--rb-text-brand)]"
              >
                {used === h ? (
                  <>
                    <Check className="size-3.5" />
                    Added
                  </>
                ) : (
                  'Use'
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {headlines !== null && headlines.length === 0 && !needsUploads && (
        <p className="mt-2 text-xs text-[var(--rb-text-muted)]">
          Could not draft one yet, add more detail to your résumé or career sources and try again.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
