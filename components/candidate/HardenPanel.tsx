'use client';

import { useRef, useState, useTransition } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  Trash2,
  History,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { deleteHardeningSession, clearHardeningHistory } from '@/app/(candidate)/dashboard/ai/actions';
import type { BrainHardeningResult, BrainHardeningSession } from '@/lib/types';

interface Props {
  candidateSlug: string;
  /** Scroll to + focus the matching brain field in the Build section. */
  focusBrainField: (key: string) => void;
  sessions: BrainHardeningSession[];
}

type Result = BrainHardeningResult & { gapsAddressed: number };

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

const VERDICT_STYLE: Record<string, string> = {
  missing: 'text-[var(--color-error)] border-[var(--color-error)]',
  weak: 'text-[var(--color-warning)] border-[var(--color-warning)]',
  adequate: 'text-[var(--rb-text-secondary)] border-[var(--rb-border)]',
  strong: 'text-[var(--color-success)] border-[var(--color-success)]',
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
}

/**
 * External transcript hardening: paste or upload a real conversation transcript,
 * analyze it against the brain, and get a prioritized hardening plan that
 * deep-links each fix to the brain field to strengthen. The raw transcript is
 * never stored -- only the resulting plan + counts.
 */
export default function HardenPanel({ candidateSlug, focusBrainField, sessions }: Props) {
  const [sourceContext, setSourceContext] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reanalyzeFor, setReanalyzeFor] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const canSubmit = (!!file || text.trim().length >= 30) && !loading;
  const reanalyzeSession = sessions.find((s) => s.id === reanalyzeFor);

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)] focus:shadow-[var(--shadow-focus)] transition-shadow duration-[var(--duration-fast)]';

  function pickFile(f: File | null) {
    setFile(f);
    if (f) setText('');
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('candidateSlug', candidateSlug);
      fd.set('transcriptSource', file ? 'file' : 'paste');
      if (file) fd.set('file', file);
      else fd.set('transcriptText', text);
      if (sourceContext.trim()) fd.set('sourceContext', sourceContext.trim());
      if (reanalyzeFor) fd.set('reanalyzeSessionId', reanalyzeFor);

      const res = await fetch('/api/transcript/harden', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Analysis failed. Please try again.');
        return;
      }
      setResult(data as Result);
      setText('');
      pickFile(null);
      setSourceContext('');
      setReanalyzeFor(null);
      if (fileRef.current) fileRef.current.value = '';
      startTransition(() => router.refresh());
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startReanalyze(s: BrainHardeningSession) {
    setReanalyzeFor(s.id);
    setSourceContext(s.source_context ?? '');
    setResult(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteHardeningSession({ sessionId: id });
      router.refresh();
    });
  }

  function clearAll() {
    startTransition(async () => {
      await clearHardeningHistory();
      router.refresh();
    });
  }

  return (
    <section className="rb-card p-6" ref={formRef}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
        <ShieldCheck className="size-4 text-[var(--rb-brand)]" />
        Harden against real conversations
      </h2>
      <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
        Paste a transcript from a real recruiter call, a practice session with another AI, or your
        interview notes. We find the questions your AI would fumble and build a plan to fix them.
      </p>

      {/* Privacy disclosure */}
      <div className="mb-5 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] p-3 text-xs text-[var(--rb-text-secondary)]">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--rb-brand)]" />
        <span>
          Anything you paste here is analyzed in the moment and <strong>never stored</strong>, only
          the resulting plan is saved, and no recruiter names or companies are kept. (Your live
          recruiter conversations are different: those are saved to your Transcripts so you can
          review them and keep training your AI.)
        </span>
      </div>

      {/* Re-analysis banner */}
      {reanalyzeSession && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--rb-brand)] bg-[var(--color-success-bg)] px-3 py-2 text-xs text-[var(--rb-text-secondary)]">
          <span className="flex items-center gap-1.5">
            <RotateCcw className="size-3.5 text-[var(--rb-brand)]" />
            Re-analyzing {reanalyzeSession.source_context ? `“${reanalyzeSession.source_context}”` : 'a past session'}, paste the same transcript to confirm gaps are closed.
          </span>
          <button
            onClick={() => setReanalyzeFor(null)}
            className="shrink-0 rounded p-0.5 text-[var(--rb-text-muted)] hover:text-[var(--rb-text)]"
            aria-label="Cancel re-analysis"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={sourceContext}
          onChange={(e) => setSourceContext(e.target.value)}
          placeholder="Where's this from? (optional), e.g. phone screen with Acme, ChatGPT practice"
          maxLength={200}
          className={inputClass}
          aria-label="Source context"
        />

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) pickFile(null);
          }}
          placeholder="Paste the conversation here, any format. Rough notes, a full transcript, a message thread."
          rows={7}
          maxLength={60_000}
          disabled={!!file}
          className={`${inputClass} resize-none disabled:opacity-50`}
          aria-label="Transcript text"
        />

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {file ? (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs text-[var(--rb-text-secondary)]">
              <FileText className="size-3.5 text-[var(--rb-brand)]" />
              {file.name}
              <button
                onClick={() => {
                  pickFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="rounded p-0.5 text-[var(--rb-text-muted)] hover:text-[var(--color-error)]"
                aria-label="Remove file"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
            >
              <Upload className="size-3.5" />
              Upload TXT or PDF
            </button>
          )}

          <button
            onClick={analyze}
            disabled={!canSubmit}
            className="ml-auto inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? 'Analyzing…' : 'Analyze and find gaps'}
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-error)]">
            <AlertCircle className="size-3.5" />
            {error}
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 border-t border-[var(--rb-border)] pt-5">
          <p className="text-sm font-semibold text-[var(--rb-text)]">
            Analyzed against {result.questionsFound}{' '}
            {result.questionsFound === 1 ? 'question' : 'questions'},{' '}
            {result.gapsIdentified.length === 0 ? (
              <span className="text-[var(--color-success)]">no gaps, your brain held up.</span>
            ) : (
              <>
                {result.gapsIdentified.length}{' '}
                {result.gapsIdentified.length === 1 ? 'gap' : 'gaps'} to close.
              </>
            )}
          </p>
          {result.gapsAddressed > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
              <CheckCircle2 className="size-3.5" />
              {result.gapsAddressed} {result.gapsAddressed === 1 ? 'gap' : 'gaps'} closed since last
              time. Nice work.
            </p>
          )}

          {/* Hardening plan */}
          {result.hardeningPlan.length > 0 && (
            <ol className="mt-4 flex flex-col gap-3">
              {result.hardeningPlan.map((a, i) => (
                <li
                  key={i}
                  className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--rb-text)]">{a.action}</p>
                      {a.expansionPrompt && (
                        <p className="mt-1.5 border-l-2 border-[var(--rb-border)] pl-3 text-xs italic text-[var(--rb-text-muted)]">
                          {a.expansionPrompt}
                        </p>
                      )}
                      {FIELD_LABELS[a.brainFieldTarget] && (
                        <button
                          onClick={() => focusBrainField(a.brainFieldTarget)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          Strengthen {FIELD_LABELS[a.brainFieldTarget]}
                          <ArrowRight className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Questions this conversation raised */}
          {result.gapsIdentified.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
                Questions that exposed gaps
              </p>
              <ul className="flex flex-col gap-1.5">
                {result.gapsIdentified.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--rb-text-secondary)]">
                    <span
                      className={`mt-px shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        VERDICT_STYLE[g.brainCoverageVerdict] ?? VERDICT_STYLE.weak
                      }`}
                    >
                      {g.brainCoverageVerdict}
                    </span>
                    <span>{g.questionFromTranscript}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already strong */}
          {result.strongCoverageConfirmed.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-success-bg)] p-3 text-xs text-[var(--rb-text-secondary)]">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
              <span>
                <strong>Already strong:</strong> {result.strongCoverageConfirmed.join(' · ')}
              </span>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="mt-4 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
          >
            Analyze another transcript
          </button>
        </div>
      )}

      {/* History */}
      {sessions.length > 0 && (
        <div className="mt-6 border-t border-[var(--rb-border)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
              <History className="size-3.5" />
              Past hardening sessions
            </p>
            <button
              onClick={clearAll}
              disabled={pending}
              className="text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--color-error)] disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--rb-text-secondary)]">
                    {s.source_context || 'Untitled transcript'}
                  </p>
                  <p className="text-[11px] text-[var(--rb-text-muted)]">
                    {fmtDate(s.created_at)} · {s.questions_found} questions · {s.gaps_identified} gaps
                    {s.gaps_addressed > 0 && ` · ${s.gaps_addressed} closed`}
                    {s.last_reanalyzed_at && ' · re-analyzed'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startReanalyze(s)}
                    className="inline-flex items-center gap-1 rounded p-1.5 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
                    aria-label="Re-analyze this transcript"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={pending}
                    className="rounded p-1.5 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--color-error)] disabled:opacity-50"
                    aria-label="Delete this session"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
