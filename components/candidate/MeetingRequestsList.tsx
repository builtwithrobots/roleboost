'use client';

import { useState, useTransition } from 'react';
import { Mail, Check, Trash2, CalendarClock } from 'lucide-react';
import { markMeetingResponded, deleteMeetingRequest } from '@/app/(candidate)/dashboard/meeting-requests/actions';
import type { MeetingRequest } from '@/lib/types';

interface Props {
  requests: MeetingRequest[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MeetingRequestsList({ requests }: Props) {
  const [items, setItems] = useState(requests);
  const [pending, startTransition] = useTransition();

  function respond(id: string) {
    startTransition(async () => {
      const res = await markMeetingResponded({ id });
      if (res.ok) setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'responded' } : r)));
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteMeetingRequest({ id });
      if (res.ok) setItems((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((r) => (
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
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                r.status === 'responded'
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--rb-brand-subtle)] text-[var(--rb-brand)]'
              }`}
            >
              {r.status === 'responded' ? 'Responded' : 'New'}
            </span>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">Availability</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--rb-text-secondary)]">{r.availability}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--rb-text-muted)]">{formatDate(r.created_at)}</span>
            <div className="flex items-center gap-2">
              <a
                href={`mailto:${r.recruiter_email}`}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Mail className="size-3.5" />
                Reply
              </a>
              {r.status !== 'responded' && (
                <button
                  onClick={() => respond(r.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)] disabled:opacity-50"
                >
                  <Check className="size-3.5" />
                  Mark responded
                </button>
              )}
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
    </div>
  );
}
