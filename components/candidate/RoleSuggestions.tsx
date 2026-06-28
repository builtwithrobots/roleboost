'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Target, RefreshCw } from 'lucide-react';

interface Role {
  title: string;
  why: string;
}

interface Props {
  /** Fill the candidate's Target role field with a chosen suggestion. */
  onUseRole: (title: string) => void;
}

export default function RoleSuggestions({ onUseRole }: Props) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUploads, setNeedsUploads] = useState(false);
  const [usedTitle, setUsedTitle] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setNeedsUploads(false);
    try {
      const res = await fetch('/api/profile/recommend-roles', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not generate suggestions.');
        return;
      }
      if (json.needsUploads) {
        setNeedsUploads(true);
        setRoles([]);
        return;
      }
      setRoles(json.roles ?? []);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasResults = roles !== null && roles.length > 0;

  return (
    <section className="rb-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
            <Sparkles className="size-4 text-[var(--rb-brand)]" />
            Recommended roles
          </h2>
          <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
            AI suggestions based on your résumé and career sources, pick one to set your target role.
          </p>
        </div>
        {(hasResults || needsUploads || error) && (
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-text)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </button>
        )}
      </div>

      {/* Initial CTA */}
      {roles === null && !error && (
        <button
          onClick={generate}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? 'Analyzing your background…' : 'Suggest roles for me'}
        </button>
      )}

      {/* Needs uploads */}
      {needsUploads && (
        <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] px-3 py-2 text-xs text-[var(--rb-text-muted)]">
          Upload your résumé or add a career source first, then I can suggest roles that fit your
          background.
        </p>
      )}

      {/* Results */}
      {hasResults && (
        <ul className="mt-4 flex flex-col gap-2">
          {roles!.map((role, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3"
            >
              <span className="rb-icon-amber mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]">
                <Target className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--rb-text)]">{role.title}</p>
                <p className="mt-0.5 text-xs text-[var(--rb-text-secondary)]">{role.why}</p>
              </div>
              <button
                onClick={() => {
                  onUseRole(role.title);
                  setUsedTitle(role.title);
                }}
                className="shrink-0 self-center rounded-[var(--radius-md)] border border-[var(--rb-border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-border-brand)] hover:text-[var(--rb-text-brand)]"
              >
                {usedTitle === role.title ? 'Added ✓' : 'Use'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Empty result */}
      {roles !== null && roles.length === 0 && !needsUploads && (
        <p className="mt-4 text-xs text-[var(--rb-text-muted)]">
          No clear suggestions yet, add more detail to your résumé or career sources and try again.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </section>
  );
}
