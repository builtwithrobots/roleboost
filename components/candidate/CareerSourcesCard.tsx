'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Library,
  UploadCloud,
  ClipboardPaste,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Contact,
  Code2,
  FileText,
  Briefcase,
  Quote,
  FolderGit2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { deleteCareerSource } from '@/app/(candidate)/dashboard/ai/actions';
import type { CareerSourceSummary, CareerSourceType } from '@/lib/types';

interface Props {
  sources: CareerSourceSummary[];
  /** Same active-source ceiling the API enforces. */
  maxSources: number;
}

type Mode = 'upload' | 'paste' | 'link';

const SOURCE_TYPES: { value: CareerSourceType; label: string; Icon: typeof Library }[] = [
  { value: 'linkedin', label: 'LinkedIn', Icon: Contact },
  { value: 'indeed', label: 'Indeed', Icon: Briefcase },
  { value: 'github', label: 'GitHub', Icon: Code2 },
  { value: 'portfolio', label: 'Portfolio', Icon: FolderGit2 },
  { value: 'review', label: 'Performance review', Icon: FileText },
  { value: 'recommendation', label: 'Recommendation', Icon: Quote },
  { value: 'other', label: 'Other', Icon: Library },
];

const TYPE_META: Record<CareerSourceType, { label: string; Icon: typeof Library }> = Object.fromEntries(
  SOURCE_TYPES.map((t) => [t.value, { label: t.label, Icon: t.Icon }]),
) as Record<CareerSourceType, { label: string; Icon: typeof Library }>;

const MAX_PASTE = 50000;

// GitHub imports via link; LinkedIn upload also accepts the data-export .zip.
function modesFor(type: CareerSourceType): Mode[] {
  if (type === 'github') return ['link', 'paste'];
  return ['upload', 'paste'];
}
function acceptFor(type: CareerSourceType): string {
  return type === 'linkedin' ? '.zip,.pdf,.docx,.txt' : '.pdf,.docx,.txt';
}
// Tells the candidate exactly how to get the file for this source. Both LinkedIn
// and Indeed hand you a single PDF -- that's the primary path; LinkedIn's full
// data-export .zip is an optional richer extra.
function hintFor(type: CareerSourceType): string {
  if (type === 'linkedin') return 'LinkedIn → ⋯ More → Save to PDF, then upload it (or your data-export .zip) · 10MB';
  if (type === 'indeed') return 'Indeed → download icon on your profile → upload the PDF · 10MB';
  return 'PDF, DOCX, or TXT up to 10MB';
}

const MODE_META: Record<Mode, { label: string; Icon: typeof Library }> = {
  upload: { label: 'Upload file', Icon: UploadCloud },
  paste: { label: 'Paste text', Icon: ClipboardPaste },
  link: { label: 'Link', Icon: Link2 },
};

export default function CareerSourcesCard({ sources, maxSources }: Props) {
  const router = useRouter();
  const [type, setType] = useState<CareerSourceType>('linkedin');
  const [label, setLabel] = useState('LinkedIn');
  const [labelTouched, setLabelTouched] = useState(false);
  const [mode, setMode] = useState<Mode>('upload');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const atCap = sources.length >= maxSources;
  const modes = modesFor(type);

  function onTypeChange(next: CareerSourceType) {
    setType(next);
    if (!labelTouched) setLabel(TYPE_META[next].label);
    // Snap to a mode that makes sense for the new type.
    const allowed = modesFor(next);
    if (!allowed.includes(mode)) setMode(allowed[0]);
    setError(null);
  }

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/sources', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not add that source.');
        return;
      }
      setText('');
      setUrl('');
      setLabelTouched(false);
      setLabel(TYPE_META[type].label);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function base(form: FormData) {
    form.append('source_type', type);
    form.append('label', label.trim() || TYPE_META[type].label);
    return form;
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const form = base(new FormData());
    form.append('file', file);
    void submit(form);
  }

  function onPaste() {
    if (text.trim().length < 30) {
      setError('Paste a bit more text — at least a couple of sentences.');
      return;
    }
    const form = base(new FormData());
    form.append('text', text.trim());
    void submit(form);
  }

  function onLink() {
    if (!url.trim()) {
      setError('Paste a GitHub profile URL or username.');
      return;
    }
    const form = base(new FormData());
    form.append('url', url.trim());
    void submit(form);
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCareerSource({ sourceId: id });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="rb-card p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
        <Library className="size-4 text-[var(--rb-brand)]" />
        Career sources
        <span className="ml-1 text-xs font-normal text-[var(--rb-text-muted)]">
          {sources.length}/{maxSources}
        </span>
      </h2>
      <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
        Bring what you already have — your LinkedIn or Indeed export, a GitHub profile, a performance
        review or recommendation. Your AI uses them as grounding and the guided interview cross-checks
        them against your résumé. They&apos;re private to your AI, never shown raw to recruiters.
      </p>

      {/* Existing sources */}
      {sources.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {sources.map((s) => {
            const Icon = TYPE_META[s.source_type]?.Icon ?? Library;
            const detail =
              s.ingest_method === 'link' ? 'Linked' : s.file_name ?? 'Pasted text';
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-2"
              >
                <span className="rb-icon-amber flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--rb-text)]">{s.label}</p>
                  <p className="truncate text-xs text-[var(--rb-text-muted)]">
                    {detail} · {s.char_count.toLocaleString()} chars
                  </p>
                </div>
                <button
                  onClick={() => onDelete(s.id)}
                  className="rounded p-1 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--color-error)]"
                  aria-label={`Remove source ${s.label}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {atCap ? (
        <p className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] px-3 py-2 text-xs text-[var(--rb-text-muted)]">
          You&apos;ve added the maximum of {maxSources} sources. Remove one to add another.
        </p>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
          {/* Type + label */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value as CareerSourceType)}
              aria-label="Source type"
              className="rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelTouched(true);
              }}
              maxLength={60}
              aria-label="Source label"
              placeholder="Label (e.g. LinkedIn profile)"
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
            />
          </div>

          {/* Mode toggle */}
          <div className="mb-3 inline-flex rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] p-0.5 text-xs">
            {modes.map((m) => {
              const { label: ml, Icon } = MODE_META[m];
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition-colors ${
                    mode === m
                      ? 'bg-[var(--rb-bg-surface)] text-[var(--rb-text)] shadow-sm'
                      : 'text-[var(--rb-text-muted)] hover:text-[var(--rb-text-secondary)]'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {ml}
                </button>
              );
            })}
          </div>

          {mode === 'upload' && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--rb-border)] px-4 py-5 text-center transition-colors hover:border-[var(--rb-border-strong)] disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2 text-sm text-[var(--rb-text-secondary)]">
                  <Loader2 className="size-4 animate-spin" /> Reading…
                </span>
              ) : (
                <>
                  <UploadCloud className="size-5 text-[var(--rb-text-muted)]" />
                  <span className="text-sm text-[var(--rb-text-secondary)]">
                    Drop or <span className="font-semibold text-[var(--rb-text-brand)]">browse</span>
                  </span>
                  <span className="text-xs text-[var(--rb-text-muted)]">{hintFor(type)}</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={acceptFor(type)}
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </button>
          )}

          {mode === 'paste' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={MAX_PASTE}
                placeholder="Paste your LinkedIn About + experience, an Indeed profile, a recommendation, etc."
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
              />
              <button
                onClick={onPaste}
                disabled={busy || !text.trim()}
                className="inline-flex items-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add source
              </button>
            </div>
          )}

          {mode === 'link' && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="github.com/yourname  (or just your username)"
                className="w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
              />
              <button
                onClick={onLink}
                disabled={busy || !url.trim()}
                className="inline-flex items-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Import profile
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs text-[var(--color-error)]">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
