'use client';

import { useMemo, useState, useTransition } from 'react';
import { Mail, Trash2, CalendarClock, ChevronDown, MessagesSquare } from 'lucide-react';
import { setMeetingStatus, deleteMeetingRequest } from '@/app/(candidate)/dashboard/meeting-requests/actions';
import type { MeetingRequest, MeetingRequestStatus } from '@/lib/types';

type TranscriptMessage = { role: 'user' | 'assistant'; content: string };

interface Props {
  requests: MeetingRequest[];
  transcripts?: Record<string, TranscriptMessage[]>;
}

const STATUS_ORDER: MeetingRequestStatus[] = ['new', 'contacted', 'scheduled', 'closed'];

const STATUS_META: Record<MeetingRequestStatus, { label: string; badge: string }> = {
  new: { label: 'New', badge: 'bg-[var(--rb-brand-subtle)] text-[var(--rb-brand)]' },
  contacted: { label: 'Contacted', badge: 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)]' },
  scheduled: { label: 'Scheduled', badge: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  closed: { label: 'Closed', badge: 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-muted)]' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MeetingRequestsList({ requests, transcripts = {} }: Props) {
  const [items, setItems] = useState(requests);
  const [filter, setFilter] = useState<'all' | MeetingRequestStatus>('all');
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<MeetingRequestStatus, number> = { new: 0, contacted: 0, scheduled: 0, closed: 0 };
    for (const r of items) c[r.status] += 1;
    return c;
  }, [items]);

  const visible = filter === 'all' ? items : items.filter((r) => r.status === filter);

  function changeStatus(id: string, status: MeetingRequestStatus) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r))); // optimistic
    startTransition(async () => {
      const res = await setMeetingStatus({ id, status });
      if (!res.ok) setItems(requests); // rollback to server truth on failure
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteMeetingRequest({ id });
      if (res.ok) setItems((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status summary + filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" count={items.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_ORDER.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_META[s].label}
            count={counts[s]}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((r) => (
          <div key={r.id} className="rb-card flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
                  <CalendarClock className="size-4 text-[var(--rb-brand)]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--rb-text)]">
                    {r.recruiter_name?.trim() || r.recruiter_email}
                  </p>
                  <a
                    href={`mailto:${r.recruiter_email}`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-brand)] hover:underline"
                  >
                    <Mail className="size-3" />
                    {r.recruiter_email}
                  </a>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_META[r.status].badge}`}
              >
                {STATUS_META[r.status].label}
              </span>
            </div>

            <div className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">Availability</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--rb-text-secondary)]">{r.availability}</p>
            </div>

            {r.chat_session_id && (transcripts[r.chat_session_id]?.length ?? 0) > 0 && (
              <details className="group rounded-[var(--radius-md)] border border-[var(--rb-border)] [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]">
                  <MessagesSquare className="size-3.5" />
                  The conversation that led here
                  <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-2 border-t border-[var(--rb-border)] p-3">
                  {transcripts[r.chat_session_id]!.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3 py-2 text-xs leading-relaxed ${
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
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[var(--rb-text-muted)]">{formatDate(r.created_at)}</span>
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${r.recruiter_email}`}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Mail className="size-3.5" />
                  Reply
                </a>
                <div className="relative">
                  <label htmlFor={`status-${r.id}`} className="sr-only">
                    Update status
                  </label>
                  <select
                    id={`status-${r.id}`}
                    value={r.status}
                    disabled={pending}
                    onChange={(e) => changeStatus(r.id, e.target.value as MeetingRequestStatus)}
                    className="appearance-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] py-1.5 pl-3 pr-8 text-xs font-medium text-[var(--rb-text-secondary)] outline-none focus-visible:border-[var(--rb-brand)] disabled:opacity-50"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--rb-text-muted)]" />
                </div>
                <button
                  onClick={() => remove(r.id)}
                  disabled={pending}
                  aria-label="Delete request"
                  className="rounded-[var(--radius-md)] p-1.5 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--color-error)] disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="rb-card p-6 text-center text-sm text-[var(--rb-text-muted)]">
            No requests in this status.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--rb-brand)] bg-[var(--rb-brand-subtle)] text-[var(--rb-brand)]'
          : 'border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] hover:border-[var(--rb-border-strong)]'
      }`}
    >
      {label}
      <span
        className={`inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
          active ? 'bg-[var(--rb-brand)] text-white' : 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-muted)]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
