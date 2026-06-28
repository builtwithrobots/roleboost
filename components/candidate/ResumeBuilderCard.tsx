'use client';

import { useState, useTransition, useRef } from 'react';
import { FileText, UploadCloud, Loader2, CheckCircle2, Download, Sparkles } from 'lucide-react';
import { saveAndRegenerateResume, approveResume } from '@/app/(candidate)/dashboard/assets/resume-actions';

export interface ResumeDoc {
  id: string;
  status: 'draft' | 'generating' | 'ready' | 'approved';
  markdown: string;
  docxUrl?: string;
  pdfUrl?: string;
}

interface Props {
  resume: ResumeDoc | null;
}

const ACCEPT = '.pdf,.docx,.txt';

export default function ResumeBuilderCard({ resume }: Props) {
  const [doc, setDoc] = useState<ResumeDoc | null>(resume);
  const [markdown, setMarkdown] = useState(resume?.markdown ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadResume(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not process that résumé.');
        return;
      }
      const next: ResumeDoc = { id: json.resume_document_id, status: json.status, markdown: json.markdown };
      setDoc(next);
      setMarkdown(json.markdown);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void uploadResume(file);
  };

  function saveAndRegenerate() {
    if (!doc) return;
    setError(null);
    startTransition(async () => {
      const result = await saveAndRegenerateResume({ id: doc.id, markdown });
      if (!result.ok) {
        setError('Could not regenerate. Please try again.');
        return;
      }
      // Reflect the new status + fresh download URLs immediately (the local doc
      // state wouldn't otherwise pick up the revalidated server props).
      setDoc({
        ...doc,
        status: result.status,
        pdfUrl: result.pdfUrl ?? doc.pdfUrl,
        docxUrl: result.docxUrl ?? doc.docxUrl,
      });
    });
  }

  function approve() {
    if (!doc) return;
    setError(null);
    startTransition(async () => {
      const result = await approveResume({ id: doc.id });
      if (!result.ok) setError('Could not approve. Generate the résumé first.');
      else setDoc({ ...doc, status: 'approved' });
    });
  }

  const busy = uploading || isPending;

  return (
    <div className="mx-auto max-w-6xl px-6 pt-8">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/50">
            <FileText className="size-5 text-[var(--rb-brand)]" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[var(--rb-text)]">ATS Résumé Builder</h2>
            <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
              Upload your résumé in any format. We&apos;ll build a clean, ATS-ready version you can edit and download as PDF and Word.
            </p>
          </div>
        </div>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFiles(e.dataTransfer.files); }}
          className={`mt-5 flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed px-4 py-5 text-center transition-colors ${
            isDragging ? 'border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]' : 'border-[var(--rb-border)] hover:border-[var(--rb-border-strong)]'
          }`}
        >
          {uploading ? (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--rb-text-secondary)]">
              <Loader2 className="size-4 animate-spin" /> Reading your résumé…
            </span>
          ) : (
            <>
              <UploadCloud className="size-6 text-[var(--rb-text-muted)]" />
              <span className="mt-2 text-sm text-[var(--rb-text-secondary)]">
                Drag &amp; drop or <span className="font-semibold text-[var(--rb-text-brand)]">browse</span>
              </span>
              <span className="mt-0.5 text-xs text-[var(--rb-text-muted)]">PDF, DOCX, or TXT up to 10MB</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error}</p>
        )}

        {/* Editor + actions (once parsed) */}
        {doc && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="resume-md" className="text-sm font-semibold text-[var(--rb-text)]">
                Edit your résumé (Markdown)
              </label>
              <StatusPill status={doc.status} />
            </div>
            <textarea
              id="resume-md"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              rows={16}
              className="w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--rb-text)] focus:border-[var(--rb-border-focus)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveAndRegenerate}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--rb-brand-hover)] disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Save &amp; regenerate
              </button>

              {doc.pdfUrl && (
                <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--rb-text-secondary)] hover:bg-[var(--rb-bg-surface-raised)]">
                  <Download className="size-4" /> PDF
                </a>
              )}
              {doc.docxUrl && (
                <a href={doc.docxUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--rb-text-secondary)] hover:bg-[var(--rb-bg-surface-raised)]">
                  <Download className="size-4" /> Word
                </a>
              )}

              <button
                onClick={approve}
                disabled={busy || (doc.status !== 'ready' && doc.status !== 'approved')}
                className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-emerald-200"
              >
                <CheckCircle2 className="size-4" />
                {doc.status === 'approved' ? 'Approved' : 'Approve'}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--rb-text-muted)]">
              Tip: edit the Markdown above, then “Save &amp; regenerate” to rebuild the PDF and Word files.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ResumeDoc['status'] }) {
  const map: Record<ResumeDoc['status'], { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)]' },
    generating: { label: 'Generating…', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
    ready: { label: 'Ready', cls: 'bg-[var(--rb-brand-subtle)] text-[var(--rb-text-brand)]' },
    approved: { label: 'Approved', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  };
  const s = map[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
