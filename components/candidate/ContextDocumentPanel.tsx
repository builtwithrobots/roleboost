'use client';

import { useRef, useState, useTransition } from 'react';
import {
  FileText,
  Sparkles,
  Loader2,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Package,
  ChevronDown,
} from 'lucide-react';
import {
  saveContextPackage,
  clearContextPackage,
} from '@/app/(candidate)/dashboard/assets/package-actions';
import { ResumeFallback } from './AssetPackagePanel';
import { ASSET_PACKAGE_STORY_TYPE_LABELS, type AssetPackage } from '@/lib/types';

// The Context Document tab is the home of the candidate's ACTIVE career-context
// document: the single markdown file the AI brain leads from (context_package_md).
// It is populated by choosing a perspective in the Asset Package tab, or by
// uploading an externally produced document. This panel views and manages it; the
// generator lives in the Asset Package tab.

interface Props {
  contextPackageMd: string | null;
  contextPackageUpdatedAt: string | null;
  /** The staged asset package, used to attribute where the active document came from. */
  assetPackage: AssetPackage | null;
  slug: string;
  hasResume: boolean;
  /** Switch the studio to the Asset Package tab (the generator). */
  onCreatePackage: () => void;
}

const ACCEPT = '.md,.markdown,.txt';
const MAX_CHARS = 100000;
const MIN_CHARS = 30;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContextDocumentPanel({
  contextPackageMd,
  contextPackageUpdatedAt,
  assetPackage,
  slug,
  hasResume,
  onCreatePackage,
}: Props) {
  const [markdown, setMarkdown] = useState<string | null>(contextPackageMd);
  const [savedAt, setSavedAt] = useState<string | null>(contextPackageUpdatedAt);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Attribute the active document to the chosen asset-package perspective when it
  // is the exact text that was promoted; otherwise treat it as uploaded/external.
  const chosenPerspective =
    assetPackage?.chosen && markdown
      ? assetPackage.perspectives[assetPackage.chosen]
      : null;
  const fromPackage = !!chosenPerspective && chosenPerspective.brain_context_md === markdown;

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
        setError('That file looks empty, upload your full context document.');
        return;
      }
      if (text.length > MAX_CHARS) {
        setError('That file is too large (over 100k characters).');
        return;
      }
      const res = await saveContextPackage({ markdown: text });
      if (!res.ok) {
        setError('Could not save the document. Please try again.');
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
        setPreviewOpen(false);
      } else {
        setError('Could not remove the document. Please try again.');
      }
    });
  }

  // No résumé and nothing on file: point the candidate to the assets section first.
  if (!hasResume && !markdown) {
    return <ResumeFallback context="context document" />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
          <FileText className="size-4 text-[var(--rb-brand)]" />
          Career context document
        </h2>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          The single narrative document your AI leads from when recruiters ask about your background.
          Create it by choosing a perspective in the Asset Package tab, or upload one produced
          elsewhere.
        </p>
      </header>

      {markdown ? (
        <div className="rb-card flex flex-col gap-4 p-5">
          {/* Active document summary */}
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--rb-bg-surface-raised)] px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[var(--rb-text)]">
                {fromPackage
                  ? `From your Asset Package: ${chosenPerspective!.name} (${ASSET_PACKAGE_STORY_TYPE_LABELS[assetPackage!.story_type]})`
                  : 'Context document on file'}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--rb-text-muted)]">
                <span className="font-data">{markdown.length.toLocaleString()} chars</span>
                {savedAt && (
                  <>
                    <span>·</span>
                    <span>Updated {formatDate(savedAt)}</span>
                  </>
                )}
                <span>·</span>
                <span>Active in your AI</span>
              </div>
            </div>
            <button
              onClick={download}
              className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-[var(--rb-brand)] transition-colors hover:bg-[var(--rb-brand-subtle)]"
            >
              <Download className="size-3" />
              Download
            </button>
          </div>

          {/* Preview */}
          <div>
            <button
              onClick={() => setPreviewOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
              aria-expanded={previewOpen}
            >
              <ChevronDown className={`size-3 transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
              {previewOpen ? 'Hide document' : 'Preview document'}
            </button>
            {previewOpen && (
              <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] p-4 font-sans text-xs leading-relaxed text-[var(--rb-text-secondary)]">
                {markdown}
              </pre>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-4 border-t border-[var(--rb-border)] pt-3">
            <button
              onClick={onCreatePackage}
              className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
            >
              <Package className="size-3" />
              Update via Asset Package
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
            >
              <RefreshCw className="size-3" />
              Replace with upload
            </button>
            <button
              onClick={remove}
              className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--color-error)]"
            >
              <Trash2 className="size-3" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="rb-card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
            <Sparkles className="size-5 text-[var(--rb-brand)]" />
          </span>
          <div className="max-w-md">
            <h3 className="text-sm font-semibold text-[var(--rb-text)]">No active context document yet</h3>
            <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
              Create your Asset Package and choose the narrative that tells your story best; it becomes
              the document your AI leads from. Or upload a document produced elsewhere.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onCreatePackage}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Package className="size-4" />
              Create your Asset Package
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-4 py-2 text-sm font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)] disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {busy ? 'Saving…' : 'Upload your own'}
            </button>
          </div>
          <span className="text-xs text-[var(--rb-text-muted)]">.md or .txt up to 100k characters</span>
        </div>
      )}

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
    </section>
  );
}
