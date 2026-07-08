'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Package,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { saveContextPackage, clearContextPackage } from '@/app/(candidate)/dashboard/assets/package-actions';

interface Props {
  /** The stored context-package Markdown, or null if none uploaded yet. */
  initialMarkdown: string | null;
  updatedAt: string | null;
  /** The candidate's slug, used to name the downloaded file. */
  slug: string;
}

const ACCEPT = '.md,.markdown,.txt';
const MAX_CHARS = 100000;
const MIN_CHARS = 30;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssetPackageCard({ initialMarkdown, updatedAt, slug }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(initialMarkdown);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!['md', 'markdown', 'txt'].includes(ext)) {
      setError('Please upload a .md or .txt file.');
      return;
    }
    setBusy(true);
    try {
      const text = (await file.text()).trim();
      if (text.length < MIN_CHARS) {
        setError('That file looks empty, upload your full context package.');
        return;
      }
      if (text.length > MAX_CHARS) {
        setError('That file is too large (over 100k characters).');
        return;
      }
      const res = await saveContextPackage({ markdown: text });
      if (!res.ok) {
        setError('Could not save the package. Please try again.');
        return;
      }
      setMarkdown(text);
      setSavedAt(new Date().toISOString());
    } catch {
      setError('Could not read that file. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function download() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleboost-context-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await clearContextPackage();
      if (res.ok) {
        setMarkdown(null);
        setSavedAt(null);
      } else {
        setError('Could not remove the package. Please try again.');
      }
    });
  }

  const hasPackage = !!markdown;

  return (
    <div className="rb-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--rb-border)]">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
          <Package className="size-4.5 text-[var(--rb-brand)]" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--rb-text)]">Asset Package</div>
          <div className="text-xs text-[var(--rb-text-muted)] leading-relaxed mt-0.5">
            Your done-for-you career package, produced by RoleBoost. Drop the file in here when you
            receive it; it becomes the context your AI leads from.
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-4">
        {hasPackage ? (
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--rb-bg-surface-raised)] px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--rb-text)] truncate">Context package on file</div>
              <div className="flex items-center gap-2 text-xs text-[var(--rb-text-muted)]">
                <span className="font-data">{markdown!.length.toLocaleString()} chars</span>
                {savedAt && (
                  <>
                    <span>·</span>
                    <span>{formatDate(savedAt)}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={download}
              className="shrink-0 flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--rb-brand)] hover:bg-[var(--rb-brand-subtle)] transition-colors"
            >
              <Download className="size-3" />
              Download
            </button>
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-sunken)] px-3 py-2.5 text-xs text-[var(--rb-text-secondary)]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--rb-text)]">
              <Sparkles className="size-3.5 text-[var(--rb-brand)]" />
              Don&apos;t have one yet?
            </span>
            <p className="mt-1 text-[var(--rb-text-muted)]">
              Asset Packages are produced for you by RoleBoost from your résumé and career details:
              your strategized narrative plus ready-to-run scripts for every Boost format. Order one
              and drop the file in here when it arrives.
            </p>
          </div>
        )}

        {/* Upload zone */}
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files?.[0]);
          }}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--rb-border)] px-4 py-5 text-center transition-all duration-[var(--duration-base)] hover:border-[var(--rb-border-brand)] hover:bg-[var(--rb-brand-subtle)]/40"
        >
          {busy ? (
            <>
              <Loader2 className="size-5 text-[var(--rb-brand)] animate-spin" />
              <span className="text-xs text-[var(--rb-text-secondary)]">Saving…</span>
            </>
          ) : (
            <>
              <Upload className="size-5 text-[var(--rb-text-muted)]" />
              <div>
                <span className="text-xs font-medium text-[var(--rb-text-secondary)]">
                  {hasPackage ? 'Drop to replace' : 'Drag & drop or '}
                </span>
                {!hasPackage && <span className="text-xs font-medium text-[var(--rb-brand)]">browse</span>}
              </div>
              <span className="text-xs text-[var(--rb-text-muted)]">.md or .txt up to 100k characters</span>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-[var(--color-error)]">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {/* Footer actions */}
      {hasPackage && (
        <div className="flex gap-4 px-5 py-3 border-t border-[var(--rb-border)]">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] hover:text-[var(--rb-brand)] transition-colors"
          >
            <RefreshCw className="size-3" />
            Replace
          </button>
          <button
            onClick={remove}
            className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] hover:text-[var(--color-error)] transition-colors"
          >
            <Trash2 className="size-3" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
