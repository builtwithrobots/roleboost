'use client';

import { useRef, useState } from 'react';
import {
  Sparkles,
  Play,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import { SANDBOX_QUESTIONS } from '@/lib/ai/sandbox-questions';
import type { SandboxAnalysis, SandboxCategory, SandboxVerdict } from '@/lib/types';

interface Props {
  candidateSlug: string;
  candidateName: string;
  /** Scroll to + focus the matching brain field in the Build section. */
  focusBrainField: (key: string) => void;
}

type AnalysisResult = SandboxAnalysis & { patternSignal: boolean };
type DiagResult = { id: string; category: SandboxCategory; verdict: SandboxVerdict | null };

const CATEGORY_LABELS: Record<SandboxCategory, string> = {
  gap_departure: 'Gaps & departures',
  commitment_tenure: 'Commitment & tenure',
  metric_verification: 'Metrics',
  leadership: 'Leadership',
  adversarial: 'Adversarial',
  weakness_failure: 'Weakness & failure',
};

const CATEGORY_ORDER: SandboxCategory[] = [
  'gap_departure',
  'commitment_tenure',
  'metric_verification',
  'leadership',
  'adversarial',
  'weakness_failure',
];

const VERDICT_STYLE: Record<SandboxVerdict, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  adequate: { label: 'Adequate', className: 'bg-[var(--rb-brand-subtle)] text-[var(--rb-text-brand)]' },
  weak: { label: 'Weak', className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  hallucinated: { label: 'Hallucinated', className: 'bg-red-100 text-red-700' },
};

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

async function analyze(
  candidateSlug: string,
  question: string,
  category: string,
  answer?: string,
): Promise<AnalysisResult & { answer: string }> {
  const res = await fetch('/api/sandbox/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateSlug, question, category, answer }),
  });
  if (!res.ok) throw new Error('analyze failed');
  return res.json();
}

// Bounded-concurrency map so the full diagnostic never fires 20 requests at once.
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function SandboxPanel({ candidateSlug, candidateName, focusBrainField }: Props) {
  const [externalQuestion, setExternalQuestion] = useState<{ text: string; nonce: number }>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult[]>([]);

  const nonceRef = useRef(0);

  function askLibrary(text: string) {
    nonceRef.current += 1;
    setExternalQuestion({ text, nonce: nonceRef.current });
  }

  async function handleExchange(question: string, answer: string) {
    const q = SANDBOX_QUESTIONS.find((sq) => sq.question === question);
    const category = q?.category ?? 'general';
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      setAnalysis(await analyze(candidateSlug, question, category, answer));
    } catch {
      setAnalysisError('Could not analyze that answer just now. Try again in a moment.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function runDiagnostic() {
    setDiagRunning(true);
    setDiagResults([]);
    const collected: DiagResult[] = [];
    await runPool(SANDBOX_QUESTIONS, 3, async (q) => {
      let verdict: SandboxVerdict | null = null;
      try {
        verdict = (await analyze(candidateSlug, q.question, q.category)).verdict;
      } catch {
        verdict = null;
      }
      collected.push({ id: q.id, category: q.category, verdict });
      setDiagResults([...collected]);
    });
    setDiagRunning(false);
  }

  const fieldKey = analysis?.brainFieldTarget ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Question library */}
      <section className="rb-card p-6">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
          <Sparkles className="size-4 text-[var(--rb-brand)]" />
          The 20 hardest questions
        </h3>
        <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
          Tap a question to see how your AI answers it, then read the coaching below. Or type your own
          in the chat.
        </p>

        <div className="flex flex-col gap-4">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="flex flex-wrap gap-2">
                {SANDBOX_QUESTIONS.filter((q) => q.category === cat).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => askLibrary(q.question)}
                    disabled={analyzing || diagRunning}
                    title={q.whyItMatters}
                    className="rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-left text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q.question}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-[var(--rb-border)] pt-4">
          <button
            onClick={runDiagnostic}
            disabled={diagRunning || analyzing}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {diagRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {diagRunning ? `Running… ${diagResults.length}/${SANDBOX_QUESTIONS.length}` : 'Run full diagnostic'}
          </button>
          <p className="mt-2 text-xs text-[var(--rb-text-muted)]">
            Runs all 20 questions through your AI and grades each one. Do this before you share your link.
          </p>
          {(diagRunning || diagResults.length > 0) && <DiagnosticReport results={diagResults} />}
        </div>
      </section>

      {/* Chat + analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChatPanel
          candidateSlug={candidateSlug}
          candidateName={candidateName}
          mode="preview"
          externalQuestion={externalQuestion}
          onExchange={handleExchange}
        />

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--rb-text-muted)]">
            Coaching
          </p>

          {!analysis && !analyzing && !analysisError && (
            <div className="rb-card flex h-40 items-center justify-center p-6 text-center text-sm text-[var(--rb-text-muted)]">
              Ask a question and your answer gets graded here, with the exact field to strengthen.
            </div>
          )}

          {analyzing && (
            <div className="rb-card flex h-40 items-center justify-center gap-2 p-6 text-sm text-[var(--rb-text-muted)]">
              <Loader2 className="size-4 animate-spin" />
              Grading the answer…
            </div>
          )}

          {analysisError && !analyzing && (
            <div className="rb-card p-6 text-sm text-[var(--color-error)]">{analysisError}</div>
          )}

          {analysis && !analyzing && (
            <div className="rb-card flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT_STYLE[analysis.verdict].className}`}
                >
                  {VERDICT_STYLE[analysis.verdict].label}
                </span>
                {analysis.patternSignal && (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
                    <AlertTriangle className="size-3.5" />
                    Recurring weak spot
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--rb-text-muted)]">What happened</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--rb-text-secondary)]">
                  {analysis.diagnosis}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--rb-text-muted)]">How to fix it</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--rb-text-secondary)]">
                  {analysis.prescription}
                </p>
              </div>

              {analysis.expansionPrompt && (
                <p className="rounded-[var(--radius-md)] bg-[var(--rb-bg-page)] p-3 text-sm italic text-[var(--rb-text-secondary)]">
                  “{analysis.expansionPrompt}”
                </p>
              )}

              {fieldKey && FIELD_LABELS[fieldKey] && (
                <button
                  onClick={() => focusBrainField(fieldKey)}
                  className="inline-flex items-center gap-1.5 self-start rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Strengthen {FIELD_LABELS[fieldKey]}
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticReport({ results }: { results: DiagResult[] }) {
  const done = results.length;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--rb-text)]">
        <ClipboardList className="size-4 text-[var(--rb-brand)]" />
        Brain readiness by category
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const inCat = results.filter((r) => r.category === cat);
        const strong = inCat.filter((r) => r.verdict === 'strong' || r.verdict === 'adequate').length;
        const total = SANDBOX_QUESTIONS.filter((q) => q.category === cat).length;
        const weak = inCat.filter((r) => r.verdict === 'weak' || r.verdict === 'hallucinated').length;
        return (
          <div key={cat} className="flex items-center justify-between text-xs">
            <span className="text-[var(--rb-text-secondary)]">{CATEGORY_LABELS[cat]}</span>
            <span className="flex items-center gap-2">
              {weak > 0 ? (
                <span className="text-[var(--color-warning)]">{weak} need work</span>
              ) : inCat.length === total ? (
                <CheckCircle2 className="size-3.5 text-[var(--color-success)]" />
              ) : null}
              <span className="font-data text-[var(--rb-text-muted)]">
                {strong}/{total} ready
              </span>
            </span>
          </div>
        );
      })}
      {done < SANDBOX_QUESTIONS.length && (
        <p className="text-[11px] text-[var(--rb-text-muted)]">Grading… {done}/{SANDBOX_QUESTIONS.length}</p>
      )}
    </div>
  );
}
