'use client';

import { Download, ChevronDown, UserRound, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface EmployerTranscriptItem {
  id: string;
  candidateName: string;
  candidateSlug: string | null;
  date: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EmployerTranscriptsList({
  transcripts,
}: {
  transcripts: EmployerTranscriptItem[];
}) {
  function download(t: EmployerTranscriptItem) {
    const ai = `${t.candidateName}'s AI`;
    const lines = [
      `# Conversation with ${ai}`,
      formatDate(t.date),
      '',
      ...t.messages.flatMap((m) => [`**${m.role === 'user' ? 'You' : ai}:** ${m.content}`, '']),
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

  return (
    <div className="flex flex-col gap-3">
      {transcripts.map((t) => (
        <details key={t.id} className="rb-card group [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
              <UserRound className="size-4 text-[var(--rb-brand)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--rb-text)]">{t.candidateName}</p>
              <p className="text-xs text-[var(--rb-text-muted)]">
                {formatDate(t.date)} · {t.messages.length} messages
              </p>
            </div>
            {t.candidateSlug && (
              <Link
                href={`/c/${t.candidateSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
              >
                <ExternalLink className="size-3.5" />
                Profile
              </Link>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                download(t);
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
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[var(--rb-brand)] text-white'
                      : 'border border-[var(--rb-border)] bg-[var(--rb-bg-page)] text-[var(--rb-text-secondary)]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
