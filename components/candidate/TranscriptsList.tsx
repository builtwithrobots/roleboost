'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import {
  Download,
  ChevronDown,
  Building2,
  FlaskConical,
  Sparkles,
  Check,
  X,
  Mail,
  Info,
  Archive,
  ArchiveRestore,
  Trash2,
  MessageSquare,
  GraduationCap,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import {
  teachAiFromTranscript,
  archiveTranscript,
  unarchiveTranscript,
  deleteTranscript,
} from '@/app/(candidate)/dashboard/transcripts/actions';

export interface TranscriptItem {
  id: string;
  kind: 'recruiter' | 'test';
  label: string;
  contactEmail?: string | null;
  date: string;
  archived: boolean;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface Props {
  transcripts: TranscriptItem[];
  candidateName: string;
  /** Lowercased questions the candidate has already taught an answer to. */
  taughtQuestions: string[];
}

type Filter = 'all' | 'recruiter' | 'test' | 'archived';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TranscriptsList({ transcripts, candidateName, taughtQuestions }: Props) {
  const firstName = candidateName.split(' ')[0] || candidateName;
  const assistantName = `${firstName}'s Personal Assistant`;
  const [filter, setFilter] = useState<Filter>('all');
  const [infoOpen, setInfoOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TranscriptItem | null>(null);

  const taughtSet = useMemo(
    () => new Set(taughtQuestions.map((q) => q.trim().toLowerCase())),
    [taughtQuestions],
  );

  const active = transcripts.filter((t) => !t.archived);
  const archived = transcripts.filter((t) => t.archived);

  const counts = {
    all: active.length,
    recruiter: active.filter((t) => t.kind === 'recruiter').length,
    test: active.filter((t) => t.kind === 'test').length,
    archived: archived.length,
  };

  // If the archive empties out while it's the active tab, fall back to All.
  const effectiveFilter = filter === 'archived' && counts.archived === 0 ? 'all' : filter;

  const shown =
    effectiveFilter === 'archived'
      ? archived
      : active.filter((t) => effectiveFilter === 'all' || t.kind === effectiveFilter);

  const tabs: { key: Filter; label: string; show: boolean }[] = [
    { key: 'all', label: `All ${counts.all}`, show: true },
    { key: 'recruiter', label: `Recruiters ${counts.recruiter}`, show: counts.test > 0 },
    { key: 'test', label: `Your tests ${counts.test}`, show: counts.test > 0 },
    { key: 'archived', label: `Archived ${counts.archived}`, show: counts.archived > 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar with the info affordance pinned to the far right. */}
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-1">
        <div role="tablist" aria-label="Filter transcripts" className="flex flex-wrap gap-1">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={effectiveFilter === t.key}
                onClick={() => setFilter(t.key)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-colors ${
                  effectiveFilter === t.key
                    ? 'bg-[var(--rb-brand)] text-white'
                    : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="How transcripts and AI training work"
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-brand)]"
        >
          <Info className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {shown.length === 0 ? (
          <p className="rb-card p-6 text-center text-sm text-[var(--rb-text-muted)]">
            {effectiveFilter === 'archived'
              ? 'No archived conversations.'
              : 'No conversations here yet.'}
          </p>
        ) : (
          shown.map((t) => (
            <TranscriptCard
              key={t.id}
              transcript={t}
              assistantName={assistantName}
              taughtSet={taughtSet}
              onRequestDelete={() => setToDelete(t)}
            />
          ))
        )}
      </div>

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} firstName={firstName} />
      <DeleteModal
        transcript={toDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function TranscriptCard({
  transcript: t,
  assistantName,
  taughtSet,
  onRequestDelete,
}: {
  transcript: TranscriptItem;
  assistantName: string;
  taughtSet: Set<string>;
  onRequestDelete: () => void;
}) {
  const router = useRouter();
  const [teachIndex, setTeachIndex] = useState<number | null>(null);
  // Questions taught in this session, so the badge appears without a reload.
  const [justTrained, setJustTrained] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  function download() {
    const lines = [
      `# Conversation with ${assistantName}`,
      `${t.label} · ${formatDate(t.date)}`,
      '',
      ...t.messages.flatMap((m) => [`**${m.role === 'user' ? 'Recruiter' : assistantName}:** ${m.content}`, '']),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleboost-transcript-${t.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function runArchive() {
    startTransition(async () => {
      const res = await archiveTranscript({ sessionId: t.id });
      if (res.ok) router.refresh();
    });
  }

  function runRestore() {
    startTransition(async () => {
      const res = await unarchiveTranscript({ sessionId: t.id });
      if (res.ok) router.refresh();
    });
  }

  const isTest = t.kind === 'test';

  // A small square action button used in the summary row.
  const actionBtn =
    'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)] disabled:opacity-50';

  return (
    <details className="rb-card group [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            isTest ? 'bg-[var(--rb-bg-surface-raised)]' : 'bg-[var(--rb-brand-subtle)]'
          }`}
        >
          {isTest ? (
            <FlaskConical className="size-4 text-[var(--rb-text-muted)]" />
          ) : (
            <Building2 className="size-4 text-[var(--rb-brand)]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--rb-text)]">{t.label}</p>
            {isTest && (
              <span className="shrink-0 rounded-full border border-[var(--rb-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--rb-text-muted)]">
                Test
              </span>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--rb-text-muted)]">
            <span>
              {formatDate(t.date)} · {t.messages.length} messages
            </span>
            {t.contactEmail && (
              <a
                href={`mailto:${t.contactEmail}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[var(--rb-text-brand)] hover:underline"
              >
                <Mail className="size-3" />
                {t.contactEmail}
              </a>
            )}
          </p>
        </div>

        {/* Active: Download + Archive. Archived: Restore + Delete. */}
        <button
          onClick={(e) => {
            e.preventDefault();
            download();
          }}
          className={actionBtn}
          aria-label="Download transcript"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>
        {t.archived ? (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                runRestore();
              }}
              disabled={pending}
              className={actionBtn}
            >
              <ArchiveRestore className="size-3.5" />
              <span className="hidden sm:inline">Restore</span>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onRequestDelete();
              }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--color-error)] hover:text-[var(--color-error)]"
              aria-label="Delete transcript"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              runArchive();
            }}
            disabled={pending}
            className={actionBtn}
          >
            <Archive className="size-3.5" />
            <span className="hidden sm:inline">Archive</span>
          </button>
        )}
        <ChevronDown className="size-4 shrink-0 text-[var(--rb-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3 border-t border-[var(--rb-border)] p-4">
        {t.messages.map((m, i) => {
          const trained =
            m.role === 'user' &&
            (taughtSet.has(m.content.trim().toLowerCase()) || justTrained.has(i));
          return (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--rb-brand)] text-white'
                    : 'border border-[var(--rb-border)] bg-[var(--rb-bg-page)] text-[var(--rb-text-secondary)]'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="mt-1 flex items-center gap-2">
                  {trained && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                      <GraduationCap className="size-3" />
                      AI trained
                    </span>
                  )}
                  <button
                    onClick={() => setTeachIndex(teachIndex === i ? null : i)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
                  >
                    <Sparkles className="size-3" />
                    {trained ? 'Update taught answer' : 'Teach a better answer'}
                  </button>
                </div>
              )}
              {m.role === 'user' && teachIndex === i && (
                <TeachComposer
                  question={m.content}
                  archived={t.archived}
                  onTrained={() => setJustTrained((prev) => new Set(prev).add(i))}
                  onArchive={runArchive}
                  onDone={() => setTeachIndex(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function TeachComposer({
  question,
  archived,
  onTrained,
  onArchive,
  onDone,
}: {
  question: string;
  archived: boolean;
  onTrained: () => void;
  onArchive: () => void;
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!answer.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await teachAiFromTranscript({ question, answer: answer.trim() });
      if (res.ok) {
        setSaved(true);
        onTrained();
      } else {
        setError(res.error?.message ?? 'Could not save that just now. Please try again.');
      }
    });
  }

  // Success state: confirm the training, then nudge the archive step so the
  // candidate's transcript inbox reflects "reviewed and taught".
  if (saved) {
    return (
      <div className="mt-2 w-full max-w-[85%] self-end rounded-[var(--radius-lg)] border border-[var(--rb-border-brand)] bg-[var(--color-success-bg)] p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
          <Check className="size-4" />
          AI trained successfully. It uses this answer from the next conversation on.
        </p>
        <div className="mt-2 flex items-center gap-2">
          {!archived && (
            <button
              onClick={() => {
                onArchive();
                onDone();
              }}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Archive className="size-3.5" />
              Archive this conversation
            </button>
          )}
          <button
            onClick={onDone}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-[85%] self-end rounded-[var(--radius-lg)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/40 p-3">
      <p className="mb-1.5 text-[11px] font-medium text-[var(--rb-text-secondary)]">
        Write the answer you wish your AI had given. It takes priority on every future chat.
      </p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        autoFocus
        placeholder="The answer you'd want a recruiter to hear…"
        className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30"
      />
      {error && <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending || !answer.trim()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {pending ? 'Saving…' : 'Teach my AI'}
        </button>
        <button
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
        >
          <X className="size-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Shared warm modal shell matching the sitewide dialog style (IntakeInterview / ChatOverlay). */
function ModalShell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[var(--z-modal)]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm transition duration-[var(--duration-base)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <DialogPanel
          transition
          className="flex w-full flex-col overflow-hidden rounded-t-[var(--radius-2xl)] bg-[var(--rb-bg-surface)] shadow-[var(--shadow-modal)] transition duration-[var(--duration-base)] ease-[var(--ease-spring)] data-[closed]:translate-y-3 data-[closed]:opacity-0 sm:max-w-md sm:rounded-[var(--radius-2xl)] sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
        >
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function InfoModal({
  open,
  onClose,
  firstName,
}: {
  open: boolean;
  onClose: () => void;
  firstName: string;
}) {
  const steps = [
    {
      Icon: MessageSquare,
      title: 'Review every conversation',
      body: `Each chat your Personal Assistant has, with recruiters or in your own tests, is saved here in full so you can see exactly how it answered and carry the context into a meeting.`,
    },
    {
      Icon: GraduationCap,
      title: 'Teach a better answer',
      body: `Under any recruiter question, tap "Teach a better answer" and write what you wish your AI had said. It saves as a custom answer, the highest-priority layer of your AI, and applies from the next conversation on. The question is then badged "AI trained".`,
    },
    {
      Icon: Archive,
      title: 'Archive when you are done',
      body: `Once you have reviewed a conversation (and taught anything you wanted to), archive it to keep your list to what still needs attention. Archived chats move to their own tab and can be restored anytime.`,
    },
    {
      Icon: ShieldCheck,
      title: 'Delete only from the archive',
      body: `You can permanently delete a conversation from the archive. That removes the transcript for good, but any answer you taught your AI from it stays in your custom answers, so your AI never forgets what it learned.`,
    },
  ];

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--rb-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
            <Inbox className="size-4 text-[var(--rb-brand)]" />
          </span>
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">How transcripts train your AI</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-5">
        <p className="text-sm text-[var(--rb-text-secondary)]">
          Every conversation is a chance to sharpen {firstName}&apos;s AI. Here is the loop:
        </p>
        {steps.map(({ Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
              <Icon className="size-4 text-[var(--rb-brand)]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--rb-text)]">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--rb-text-secondary)]">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--rb-border)] px-5 py-3">
        <button
          onClick={onClose}
          className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteModal({
  transcript,
  onClose,
}: {
  transcript: TranscriptItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!transcript) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTranscript({ sessionId: transcript.id });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error?.message ?? 'Could not delete that just now. Please try again.');
      }
    });
  }

  return (
    <ModalShell open={!!transcript} onClose={onClose}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-bg)]">
            <Trash2 className="size-5 text-[var(--color-error)]" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--rb-text)]">Delete this conversation?</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--rb-text-secondary)]">
              This permanently removes the transcript
              {transcript ? ` with ${transcript.label}` : ''} and all of its messages. This cannot be
              undone.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
          <p className="text-xs leading-relaxed text-[var(--rb-text-secondary)]">
            Any answer you taught your AI from this conversation stays in your custom answers. Deleting
            the transcript does not remove your training.
          </p>
        </div>
        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--rb-border)] px-4 py-2 text-sm font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-border-strong)] hover:text-[var(--rb-text)]"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-error)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
