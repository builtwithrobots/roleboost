'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { Loader2, Sparkles, ArrowRight, AlertTriangle, Check, X } from 'lucide-react';
import type { BrainReadiness, IntakeAnswer, IntakeDocument, IntakeInconsistency, IntakeQuestion } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the brain is assembled so the parent can refresh. */
  onComplete: () => void;
}

type Phase = 'sources' | 'analyzing' | 'inconsistencies' | 'questions' | 'assembling' | 'done' | 'error';

const MAX_TOTAL = 20;

const SEVERITY_STYLE: Record<string, string> = {
  high: 'text-[var(--color-error)]',
  medium: 'text-[var(--color-warning)]',
  low: 'text-[var(--rb-text-muted)]',
};

export default function IntakeInterview({ open, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('sources');
  const [extraText, setExtraText] = useState('');
  const [inconsistencies, setInconsistencies] = useState<IntakeInconsistency[]>([]);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [readiness, setReadiness] = useState<BrainReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answersRef = useRef<IntakeAnswer[]>([]);

  const docs = (): IntakeDocument[] =>
    extraText.trim() ? [{ label: 'Pasted source', text: extraText.trim() }] : [];

  async function analyze(pass: 1 | 2 | 3) {
    const res = await fetch('/api/intake/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass, documents: docs(), previousAnswers: answersRef.current }),
    });
    if (!res.ok) throw new Error('analyze failed');
    return res.json() as Promise<{ inconsistencies: IntakeInconsistency[]; questions: IntakeQuestion[] }>;
  }

  async function start() {
    setError(null);
    setPhase('analyzing');
    try {
      const data = await analyze(1);
      setInconsistencies(data.inconsistencies ?? []);
      setQuestions(data.questions ?? []);
      setIdx(0);
      setPhase((data.inconsistencies?.length ?? 0) > 0 ? 'inconsistencies' : 'questions');
    } catch {
      setError('Could not analyze your documents just now. Please try again.');
      setPhase('error');
    }
  }

  async function fetchPass(pass: 2 | 3) {
    setPhase('analyzing');
    try {
      const data = await analyze(pass);
      const qs = data.questions ?? [];
      if (qs.length > 0) {
        setQuestions(qs);
        setIdx(0);
        setPhase('questions');
      } else if (pass < 3 && answersRef.current.length < MAX_TOTAL) {
        await fetchPass(3);
      } else {
        await assemble();
      }
    } catch {
      setError('Could not continue the interview. Please try again.');
      setPhase('error');
    }
  }

  async function assemble() {
    setPhase('assembling');
    try {
      const res = await fetch('/api/intake/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersRef.current, inconsistenciesResolved: [...resolved] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('assemble failed');
      setReadiness(data.readiness ?? null);
      setPhase('done');
    } catch {
      setError('Your answers are saved, but assembling the brain failed. Please try again.');
      setPhase('error');
    }
  }

  async function advance(record: boolean) {
    const q = questions[idx];
    if (record && answer.trim()) {
      answersRef.current.push({
        questionId: q.id,
        questionText: q.question,
        answerText: answer.trim(),
        category: q.category,
        pass: q.pass,
      });
    }
    setAnswer('');

    const reachedMax = answersRef.current.length >= MAX_TOTAL;
    if (idx < questions.length - 1 && !reachedMax) {
      setIdx(idx + 1);
      return;
    }
    // Pass exhausted -- go deeper or assemble.
    if (q.pass < 3 && !reachedMax) await fetchPass((q.pass + 1) as 2 | 3);
    else await assemble();
  }

  function toggleResolved(id: string) {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const answered = answersRef.current.length;
  const progress = Math.min(100, Math.round((answered / 12) * 100));

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[var(--z-modal)]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm transition duration-[var(--duration-base)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex justify-center sm:items-center sm:p-6">
        <DialogPanel
          transition
          className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--rb-bg-surface)] shadow-[var(--shadow-modal)] transition duration-[var(--duration-base)] ease-[var(--ease-spring)] data-[closed]:translate-y-3 data-[closed]:opacity-0 sm:h-[min(86vh,720px)] sm:max-w-xl sm:rounded-[var(--radius-2xl)] sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--rb-border)] px-5 py-3.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white">
              <Sparkles className="size-4" strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--rb-text)]">Guided brain interview</p>
              {phase === 'questions' && (
                <div className="mt-1 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--rb-bg-surface-sunken)]">
                  <div
                    className="h-full rounded-full bg-[var(--rb-brand)] transition-all duration-[var(--duration-base)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close interview"
              className="flex size-9 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {phase === 'sources' && (
              <div className="mx-auto flex max-w-md flex-col gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--rb-text)]">
                    Let&apos;s build your brain from your documents
                  </h2>
                  <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                    I&apos;ll read your résumé and ask the questions a recruiter actually would. Add a
                    second source (LinkedIn, Indeed) and I&apos;ll also flag anything that doesn&apos;t
                    line up across them.
                  </p>
                </div>
                <div>
                  <label htmlFor="intake-extra" className="mb-1.5 block text-xs font-medium text-[var(--rb-text-secondary)]">
                    Paste extra career text — optional
                  </label>
                  <textarea
                    id="intake-extra"
                    value={extraText}
                    onChange={(e) => setExtraText(e.target.value)}
                    rows={5}
                    placeholder="Your LinkedIn About + experience, an Indeed profile, etc."
                    className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
                  />
                </div>
                <button
                  onClick={start}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Start interview <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {(phase === 'analyzing' || phase === 'assembling') && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="size-6 animate-spin text-[var(--rb-brand)]" />
                <p className="text-sm text-[var(--rb-text-secondary)]">
                  {phase === 'analyzing' ? 'Reading your career and preparing questions…' : 'Assembling your brain…'}
                </p>
              </div>
            )}

            {phase === 'inconsistencies' && (
              <div className="mx-auto flex max-w-md flex-col gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--rb-text)]">
                    A few things don&apos;t line up
                  </h2>
                  <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                    Recruiters and background checks catch these. Note the ones you&apos;ll fix, then
                    continue.
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {inconsistencies.map((c) => (
                    <li key={c.id} className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${SEVERITY_STYLE[c.severity] ?? ''}`} />
                        <div className="flex-1">
                          <p className="text-sm text-[var(--rb-text-secondary)]">{c.description}</p>
                          <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
                            {c.sourceA} vs {c.sourceB}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleResolved(c.id)}
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            resolved.has(c.id)
                              ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
                              : 'border-[var(--rb-border-strong)] text-[var(--rb-text-muted)]'
                          }`}
                          aria-label="Mark as noted"
                          aria-pressed={resolved.has(c.id)}
                        >
                          <Check className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setPhase('questions')}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Continue to questions <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            {phase === 'questions' && questions[idx] && (
              <div className="mx-auto flex max-w-md flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
                  Question {answered + 1}
                </p>
                <h2 className="font-display text-lg font-bold leading-snug text-[var(--rb-text)]">
                  {questions[idx].question}
                </h2>
                {questions[idx].context && (
                  <p className="text-sm text-[var(--rb-text-muted)]">{questions[idx].context}</p>
                )}
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Answer in your own words — specifics and real numbers help most."
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void advance(true)}
                    disabled={!answer.trim()}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ArrowRight className="size-4" />
                  </button>
                  <button
                    onClick={() => void advance(false)}
                    className="text-sm text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text-secondary)]"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                  <Check className="size-6" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--rb-text)]">Your brain is assembled</h2>
                  <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                    Your answers are now in your brain fields below — edit anything, then test it in the sandbox.
                  </p>
                </div>
                {readiness && (
                  <div className="w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] p-4 text-left">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
                        Brain readiness
                      </span>
                      <span className="font-data text-sm font-semibold text-[var(--rb-text)]">{readiness.overall}%</span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {readiness.categories.map((c) => (
                        <li key={c.label} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--rb-text-secondary)]">{c.label}</span>
                          <span className="font-data text-[var(--rb-text-muted)]">{c.score}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => {
                    onComplete();
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Review my brain
                </button>
              </div>
            )}

            {phase === 'error' && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                <p className="text-sm text-[var(--color-error)]">{error}</p>
                <button
                  onClick={() => setPhase('sources')}
                  className="rounded-[var(--radius-md)] border border-[var(--rb-border)] px-4 py-2 text-sm font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-border-strong)]"
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
