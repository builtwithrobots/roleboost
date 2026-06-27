'use client';

import { useRef, useState } from 'react';
import {
  Library,
  UploadCloud,
  ClipboardPaste,
  Link2,
  Loader2,
  Plus,
  ArrowRight,
  Check,
} from 'lucide-react';
import type { CareerSourceType } from '@/lib/types';

interface Props {
  /** Continue to the next destination (résumé review or profile). */
  onContinue: () => void;
}

type Mode = 'upload' | 'paste' | 'link';
type Added = { id: string; label: string };

const SOURCE_TYPES: { value: CareerSourceType; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'github', label: 'GitHub' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'review', label: 'Performance review' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'other', label: 'Other' },
];

const LABELS: Record<CareerSourceType, string> = Object.fromEntries(
  SOURCE_TYPES.map((t) => [t.value, t.label]),
) as Record<CareerSourceType, string>;

function modesFor(type: CareerSourceType): Mode[] {
  if (type === 'github') return ['link', 'paste'];
  return ['upload', 'paste'];
}
function acceptFor(type: CareerSourceType): string {
  return type === 'linkedin' ? '.zip,.pdf,.docx,.txt' : '.pdf,.docx,.txt';
}
// LinkedIn and Indeed both give you a single PDF -- the primary path. LinkedIn's
// full data-export .zip is an optional richer extra.
function hintFor(type: CareerSourceType): string {
  if (type === 'linkedin') return 'LinkedIn → ⋯ More → Save to PDF (or your data-export .zip) · 10MB';
  if (type === 'indeed') return 'Indeed → download icon → save the PDF · 10MB';
  return 'PDF, DOCX, or TXT up to 10MB';
}

const MODE_META: Record<Mode, { label: string; Icon: typeof Library }> = {
  upload: { label: 'Upload', Icon: UploadCloud },
  paste: { label: 'Paste', Icon: ClipboardPaste },
  link: { label: 'Link', Icon: Link2 },
};

export default function OnboardingSourcesStep({ onContinue }: Props) {
  const [type, setType] = useState<CareerSourceType>('linkedin');
  const [mode, setMode] = useState<Mode>('upload');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [added, setAdded] = useState<Added[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const modes = modesFor(type);

  function onTypeChange(next: CareerSourceType) {
    setType(next);
    const allowed = modesFor(next);
    if (!allowed.includes(mode)) setMode(allowed[0]);
    setError(null);
  }

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    try {
      form.append('source_type', type);
      form.append('label', LABELS[type]);
      const res = await fetch('/api/sources', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not add that source.');
        return;
      }
      setAdded((prev) => [...prev, { id: json.source.id, label: json.source.label }]);
      setText('');
      setUrl('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    void submit(form);
  }

  function onPaste() {
    if (text.trim().length < 30) {
      setError('Paste a bit more text — at least a couple of sentences.');
      return;
    }
    const form = new FormData();
    form.append('text', text.trim());
    void submit(form);
  }

  function onLink() {
    if (!url.trim()) {
      setError('Paste a GitHub profile URL or username.');
      return;
    }
    const form = new FormData();
    form.append('url', url.trim());
    void submit(form);
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-7 flex flex-col items-center text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/50">
          <Library className="size-5 text-[var(--rb-brand)]" strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--rb-text)]">
          Bring your other career sources
        </h1>
        <p className="mt-2 text-sm text-[var(--rb-text-secondary)]">
          Add your LinkedIn or Indeed export, a GitHub profile, or a recommendation. Your AI uses them
          as context and cross-checks them against your résumé. Totally optional — you can always add
          more later.
        </p>
      </div>

      {added.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {added.map((a) => (
            <li
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-medium text-[var(--color-success)]"
            >
              <Check className="size-3.5" />
              {a.label}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-[var(--radius-xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-4">
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
          <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] p-0.5 text-xs">
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
              rows={4}
              maxLength={50000}
              placeholder="Paste your LinkedIn About + experience, an Indeed profile, a recommendation, etc."
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
            />
            <button
              onClick={onPaste}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--rb-text)] transition-colors hover:bg-[var(--rb-bg-surface-sunken)] disabled:cursor-not-allowed disabled:opacity-40"
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
              className="inline-flex items-center gap-2 self-start rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--rb-text)] transition-colors hover:bg-[var(--rb-bg-surface-sunken)] disabled:cursor-not-allowed disabled:opacity-40"
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

      <div className="mt-6 flex items-center justify-center gap-5">
        <button
          onClick={onContinue}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {added.length > 0 ? 'Continue' : 'Skip for now'}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
