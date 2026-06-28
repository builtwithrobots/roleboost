'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import {
  Sparkles,
  Trophy,
  Compass,
  DoorOpen,
  Mountain,
  Users,
  HeartHandshake,
  AlertTriangle,
  HelpCircle,
  MessageSquarePlus,
  ShieldCheck,
  Plus,
  Trash2,
  Hammer,
  FileText,
  FlaskConical,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { updateCandidateBrain } from '@/app/(candidate)/dashboard/ai/actions';
import SandboxPanel from '@/components/candidate/SandboxPanel';
import PromptBot from './PromptBot';
import HardenPanel from './HardenPanel';
import IntakeInterview from './IntakeInterview';
import CareerSourcesCard from './CareerSourcesCard';
import ContextDocumentPanel from './ContextDocumentPanel';
import TabIntro from './TabIntro';
import type {
  CandidateProfile,
  CustomQAPair,
  TranscriptGap,
  BrainHardeningSession,
  CareerSourceSummary,
} from '@/lib/types';

interface Props {
  profile: CandidateProfile;
  /** Tab to open on load (from the ?tab= deep link). Defaults to "build". */
  initialTab?: StudioTab;
  /** Open gaps from real recruiter conversations, surfaced by the prompt bot. */
  gaps?: TranscriptGap[];
  /** Past external-transcript hardening sessions (most recent first). */
  hardeningSessions?: BrainHardeningSession[];
  /** Saved external career sources that feed the brain as grounding. */
  sources?: CareerSourceSummary[];
  /** Active-source ceiling, mirrored from the API. */
  maxSources?: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// The eight free-text brain fields, in the order they appear in the form.
const TEXT_FIELDS = [
  {
    key: 'key_wins',
    label: 'Top career wins (with real numbers)',
    Icon: Trophy,
    placeholder: 'e.g. Rebuilt the third-shift operation at Brightship: cut order errors 38% and hired/trained a 24-person team in 90 days.',
  },
  {
    key: 'leadership_philosophy',
    label: 'Leadership philosophy',
    Icon: Compass,
    placeholder: 'How you lead, in your own words.',
  },
  {
    key: 'departure_reasons',
    label: 'Why you left each of your recent roles',
    Icon: DoorOpen,
    placeholder: 'A calm, honest reason for each move. This is the first thing recruiters probe.',
  },
  {
    key: 'biggest_challenge',
    label: 'Biggest professional challenge and what you did',
    Icon: Mountain,
    placeholder: 'The hardest thing you faced and how you handled it.',
  },
  {
    key: 'ideal_environment',
    label: 'Ideal team and work environment',
    Icon: Users,
    placeholder: 'Where you do your best work.',
  },
  {
    key: 'manager_needs',
    label: 'What you need from a manager',
    Icon: HeartHandshake,
    placeholder: 'What good support looks like for you.',
  },
  {
    key: 'honest_weaknesses',
    label: "What you're not good at (be honest)",
    Icon: AlertTriangle,
    placeholder: 'A real, self-aware answer beats a humblebrag every time.',
  },
  {
    key: 'wish_questions',
    label: 'Questions you wish recruiters would ask',
    Icon: HelpCircle,
    placeholder: 'The questions that let you show your best.',
  },
] as const;

type TextFieldKey = (typeof TEXT_FIELDS)[number]['key'];

type StudioTab = 'build' | 'context' | 'test' | 'harden';

const TABS: { key: StudioTab; label: string; Icon: typeof Hammer }[] = [
  { key: 'build', label: 'Build', Icon: Hammer },
  { key: 'context', label: 'Context Document', Icon: FileText },
  { key: 'test', label: 'Test', Icon: FlaskConical },
  { key: 'harden', label: 'Harden', Icon: ShieldCheck },
];

export default function AIStudio({ profile, initialTab, gaps, hardeningSessions, sources, maxSources = 10 }: Props) {
  const [fields, setFields] = useState<Record<TextFieldKey, string>>({
    key_wins: profile.key_wins ?? '',
    leadership_philosophy: profile.leadership_philosophy ?? '',
    departure_reasons: profile.departure_reasons ?? '',
    biggest_challenge: profile.biggest_challenge ?? '',
    ideal_environment: profile.ideal_environment ?? '',
    manager_needs: profile.manager_needs ?? '',
    honest_weaknesses: profile.honest_weaknesses ?? '',
    wish_questions: profile.wish_questions ?? '',
  });
  const [qaPairs, setQaPairs] = useState<CustomQAPair[]>(
    Array.isArray(profile.custom_qa_pairs) ? profile.custom_qa_pairs : [],
  );
  const [topics, setTopics] = useState<string[]>(
    Array.isArray(profile.redirect_topics) ? profile.redirect_topics : [],
  );
  const [aiEnabled, setAiEnabled] = useState(profile.ai_enabled ?? true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [tab, setTab] = useState<StudioTab>(initialTab ?? 'build');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentData = useCallback(
    () => ({
      ...fields,
      custom_qa_pairs: qaPairs.filter((p) => p.question.trim() && p.answer.trim()),
      redirect_topics: topics.map((t) => t.trim()).filter(Boolean),
      ai_enabled: aiEnabled,
    }),
    [fields, qaPairs, topics, aiEnabled],
  );

  const save = useCallback(
    (overrides?: Partial<ReturnType<typeof currentData>>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('saving');
      startTransition(async () => {
        const result = await updateCandidateBrain({ ...currentData(), ...overrides });
        setSaveStatus(result.ok ? 'saved' : 'error');
        if (result.ok) saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      });
    },
    [currentData],
  );

  const setField = (key: TextFieldKey, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const toggleAi = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    save({ ai_enabled: next });
  };

  // ── Custom QA ──────────────────────────────────────────────────────────────
  const addQa = () => setQaPairs((prev) => [...prev, { question: '', answer: '' }]);
  const removeQa = (i: number) => {
    setQaPairs((prev) => prev.filter((_, idx) => idx !== i));
    setTimeout(() => save(), 50);
  };
  const updateQa = (i: number, key: keyof CustomQAPair, value: string) =>
    setQaPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));

  // ── Redirect topics ─────────────────────────────────────────────────────────
  const addTopic = () => setTopics((prev) => [...prev, '']);
  const removeTopic = (i: number) => {
    setTopics((prev) => prev.filter((_, idx) => idx !== i));
    setTimeout(() => save(), 50);
  };
  const updateTopic = (i: number, value: string) =>
    setTopics((prev) => prev.map((t, idx) => (idx === i ? value : t)));

  // Deep-link from a sandbox diagnosis to the brain field that needs work.
  const focusBrainField = useCallback((key: string) => {
    const el = document.getElementById(`brain-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.focus();
  }, []);

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)] focus:shadow-[var(--shadow-focus)] transition-shadow duration-[var(--duration-fast)]';

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--rb-text)]">
              AI Studio
            </h1>
            <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
              Arm the career AI that answers recruiters on your behalf, then test it live.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span aria-live="polite" className="text-xs">
              {saveStatus === 'saving' && <span className="text-[var(--rb-text-muted)]">Saving…</span>}
              {saveStatus === 'saved' && <span className="text-[var(--color-success)]">✓ Saved</span>}
              {saveStatus === 'error' && <span className="text-[var(--color-error)]">Save failed</span>}
            </span>
            <button
              onClick={toggleAi}
              role="switch"
              aria-checked={aiEnabled}
              className={`flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--duration-base)] ${
                aiEnabled
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)]'
              }`}
            >
              <Sparkles className="size-3" />
              {aiEnabled ? 'AI On' : 'AI Off'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="AI Studio sections"
          className="flex flex-wrap gap-1 border-b border-[var(--rb-border)]"
        >
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                id={`studio-tab-${key}`}
                aria-selected={active}
                aria-controls={`studio-panel-${key}`}
                onClick={() => setTab(key)}
                className={`-mb-px inline-flex items-center gap-1.5 rounded-t-[var(--radius-md)] border px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[var(--rb-border)] border-b-transparent bg-[var(--rb-bg-surface)] text-[var(--rb-brand)]'
                    : 'border-transparent text-[var(--rb-text-secondary)] hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Build ─────────────────────────────────────────────────────────── */}
        {tab === 'build' && (
        <div
          role="tabpanel"
          id="studio-panel-build"
          aria-labelledby="studio-tab-build"
          className="flex flex-col gap-6"
        >
          <TabIntro Icon={Hammer} title="Teach your AI about your career">
            This is where your AI learns who you are — your wins, the hard questions, the things a
            résumé can&apos;t say. Use the guided interview to do it fast, or fill in the details
            yourself. Everything here saves automatically and applies to your AI right away.
          </TabIntro>

          {/* Prompt bot: gaps found in real recruiter conversations */}
          {gaps && gaps.length > 0 && <PromptBot gaps={gaps} focusBrainField={focusBrainField} />}

          {/* Guided interview launcher */}
          <section className="rb-card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rb-icon-amber flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--rb-text)]">Build with a guided interview</h2>
                <p className="mt-0.5 text-xs text-[var(--rb-text-muted)]">
                  Let the AI read your résumé and interview you — it fills the fields below for you.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 self-end sm:self-auto">
              {typeof profile.brain_readiness_score === 'number' && profile.brain_readiness_score > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
                    Readiness
                  </p>
                  <p className="font-data text-sm font-semibold text-[var(--rb-text)]">
                    {profile.brain_readiness_score}%
                  </p>
                </div>
              )}
              <button
                onClick={() => setInterviewOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Sparkles className="size-4" />
                {profile.intake_completed ? 'Redo interview' : 'Start interview'}
              </button>
            </div>
          </section>

          {/* Career sources: external material that grounds the brain + interview */}
          <CareerSourcesCard sources={sources ?? []} maxSources={maxSources} />

          <section className="rb-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
              <Sparkles className="size-4 text-[var(--rb-brand)]" />
              Career context
            </h2>
            <p className="mb-5 text-xs text-[var(--rb-text-muted)]">
              The more honest detail you give, the better your AI answers the hard questions. Everything
              here stays private to your AI — it is never shown raw on your public profile.
            </p>

            <div className="flex flex-col gap-5">
              {TEXT_FIELDS.map(({ key, label, Icon, placeholder }) => (
                <div key={key}>
                  <label
                    htmlFor={`brain-${key}`}
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--rb-text-secondary)]"
                  >
                    <Icon className="size-3.5 text-[var(--rb-brand)]" />
                    {label}
                  </label>
                  <textarea
                    id={`brain-${key}`}
                    value={fields[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    onBlur={() => save()}
                    placeholder={placeholder}
                    rows={3}
                    maxLength={5000}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Custom answers */}
          <section id="brain-custom_qa" className="rb-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
              <MessageSquarePlus className="size-4 text-[var(--rb-brand)]" />
              Custom answers
              <span className="ml-1 text-xs font-normal text-[var(--rb-text-muted)]">(highest priority)</span>
            </h2>
            <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
              Pin an exact answer to a specific question. Your AI uses these word-for-word before anything else.
            </p>

            <div className="flex flex-col gap-4">
              {qaPairs.map((pair, i) => (
                <div key={i} className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--rb-text-muted)]">Answer {i + 1}</span>
                    <button
                      onClick={() => removeQa(i)}
                      className="rounded p-1 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--color-error)]"
                      aria-label={`Remove custom answer ${i + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pair.question}
                    onChange={(e) => updateQa(i, 'question', e.target.value)}
                    onBlur={() => save()}
                    placeholder="Recruiter question — e.g. Why did you leave Bedgear?"
                    maxLength={500}
                    className={`${inputClass} mb-2`}
                    aria-label={`Question for custom answer ${i + 1}`}
                  />
                  <textarea
                    value={pair.answer}
                    onChange={(e) => updateQa(i, 'answer', e.target.value)}
                    onBlur={() => save()}
                    placeholder="The exact answer you want your AI to give."
                    rows={3}
                    maxLength={3000}
                    className={`${inputClass} resize-none`}
                    aria-label={`Answer for custom answer ${i + 1}`}
                  />
                </div>
              ))}
            </div>

            {qaPairs.length < 50 && (
              <button
                onClick={addQa}
                className="mt-3 flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
              >
                <Plus className="size-3.5" />
                Add a custom answer
              </button>
            )}
          </section>

          {/* Privacy / redirect topics */}
          <section className="rb-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
              <ShieldCheck className="size-4 text-[var(--rb-brand)]" />
              Redirect topics
            </h2>
            <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
              Topics your AI should never answer and instead route to a direct conversation — e.g. salary
              expectations, references, start date.
            </p>

            <div className="flex flex-col gap-2">
              {topics.map((topic, i) => (
                <div key={i} className="group flex items-center gap-2">
                  <span className="shrink-0 text-sm font-bold text-[var(--rb-brand)]">·</span>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => updateTopic(i, e.target.value)}
                    onBlur={() => save()}
                    placeholder="e.g. salary expectations"
                    maxLength={100}
                    className={`${inputClass} flex-1`}
                    aria-label={`Redirect topic ${i + 1}`}
                  />
                  <button
                    onClick={() => removeTopic(i)}
                    className="rounded p-1 text-[var(--rb-text-muted)] opacity-0 transition-all hover:text-[var(--color-error)] group-hover:opacity-100"
                    aria-label={`Remove redirect topic ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {topics.length < 30 && (
              <button
                onClick={addTopic}
                className="mt-3 flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
              >
                <Plus className="size-3.5" />
                Add a redirect topic
              </button>
            )}
          </section>
        </div>
        )}

        {/* ── Context Document ──────────────────────────────────────────────── */}
        {tab === 'context' && (
          <div role="tabpanel" id="studio-panel-context" aria-labelledby="studio-tab-context">
            <ContextDocumentPanel initialDrafts={profile.career_context_drafts ?? null} />
          </div>
        )}

        {/* ── Test ──────────────────────────────────────────────────────────── */}
        {tab === 'test' && (
        <div
          role="tabpanel"
          id="studio-panel-test"
          aria-labelledby="studio-tab-test"
          className="flex flex-col gap-4"
        >
          <TabIntro Icon={FlaskConical} title="Try your AI before recruiters do">
            Ask your AI the tough questions a recruiter would — about a gap, a short stint, a big
            number — and see exactly how it answers. Anything that comes out weak points you to the
            field to strengthen. Edits in Build apply here instantly.
          </TabIntro>
          {aiEnabled ? (
            <SandboxPanel
              candidateSlug={profile.slug}
              candidateName={profile.full_name}
              focusBrainField={focusBrainField}
            />
          ) : (
            <div className="rb-card p-6 text-center text-sm text-[var(--rb-text-muted)]">
              Turn your AI on to test it. While it is off, the chat tab is hidden from recruiters.
            </div>
          )}
        </div>
        )}

        {/* ── Harden ────────────────────────────────────────────────────────── */}
        {tab === 'harden' && (
        <div
          role="tabpanel"
          id="studio-panel-harden"
          aria-labelledby="studio-tab-harden"
          className="flex flex-col gap-4"
        >
          <TabIntro Icon={ShieldCheck} title="Sharpen with real conversations">
            Already had recruiter calls or practice interviews? Paste a transcript and your AI finds
            the exact questions it isn&apos;t ready for yet — then shows you how to close each gap.
            Transcripts are analyzed and never stored.
          </TabIntro>
          <HardenPanel
            candidateSlug={profile.slug}
            focusBrainField={focusBrainField}
            sessions={hardeningSessions ?? []}
          />
        </div>
        )}
      </div>

      <IntakeInterview
        open={interviewOpen}
        onClose={() => setInterviewOpen(false)}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}
