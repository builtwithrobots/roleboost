'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, ChevronDown, Building2, FlaskConical, Sparkles, Check, X } from 'lucide-react';
import { teachAiFromTranscript } from '@/app/(candidate)/dashboard/transcripts/actions';

export interface TranscriptItem {
  id: string;
  kind: 'recruiter' | 'test';
  label: string;
  date: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

interface Props {
  transcripts: TranscriptItem[];
  candidateName: string;
}

type Filter = 'all' | 'recruiter' | 'test';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TranscriptsList({ transcripts, candidateName }: Props) {
  const firstName = candidateName.split(' ')[0] || candidateName;
  const assistantName = `${firstName}'s Personal Assistant`;
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => ({
      all: transcripts.length,
      recruiter: transcripts.filter((t) => t.kind === 'recruiter').length,
      test: transcripts.filter((t) => t.kind === 'test').length,
    }),
    [transcripts],
  );

  const shown = transcripts.filter((t) => filter === 'all' || t.kind === filter);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${counts.all}` },
    { key: 'recruiter', label: `Recruiters ${counts.recruiter}` },
    { key: 'test', label: `Your tests ${counts.test}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      {counts.test > 0 && (
        <div
          role="tablist"
          aria-label="Filter transcripts"
          className="flex flex-wrap gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === t.key
                  ? 'bg-[var(--rb-brand)] text-white'
                  : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {shown.map((t) => (
          <TranscriptCard key={t.id} transcript={t} assistantName={assistantName} />
        ))}
      </div>
    </div>
  );
}

function TranscriptCard({
  transcript: t,
  assistantName,
}: {
  transcript: TranscriptItem;
  assistantName: string;
}) {
  const [teachIndex, setTeachIndex] = useState<number | null>(null);

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

  const isTest = t.kind === 'test';

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
          <p className="text-xs text-[var(--rb-text-muted)]">
            {formatDate(t.date)} · {t.messages.length} messages
          </p>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            download();
          }}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
        >
          <Download className="size-3.5" />
          Download
        </button>
        <ChevronDown className="size-4 shrink-0 text-[var(--rb-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3 border-t border-[var(--rb-border)] p-4">
        {t.messages.map((m, i) => (
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
              <button
                onClick={() => setTeachIndex(teachIndex === i ? null : i)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
              >
                <Sparkles className="size-3" />
                Teach a better answer
              </button>
            )}
            {m.role === 'user' && teachIndex === i && (
              <TeachComposer question={m.content} onDone={() => setTeachIndex(null)} />
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function TeachComposer({ question, onDone }: { question: string; onDone: () => void }) {
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
        setTimeout(onDone, 1200);
      } else {
        setError(res.error?.message ?? 'Could not save that just now. Please try again.');
      }
    });
  }

  if (saved) {
    return (
      <p className="mt-2 flex items-center gap-1.5 self-end text-xs font-medium text-[var(--color-success)]">
        <Check className="size-4" />
        Saved. Your AI will use this answer from now on.
      </p>
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
