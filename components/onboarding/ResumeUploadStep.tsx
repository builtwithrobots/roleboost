'use client';

import { useState, useRef } from 'react';
import { UploadCloud, Loader2, ArrowRight } from 'lucide-react';

interface Props {
  onParsed: (resumeDocumentId: string) => void;
  onSkip: () => void;
}

const ACCEPT = '.pdf,.docx,.txt';

export default function ResumeUploadStep({ onParsed, onSkip }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
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
      onParsed(json.resume_document_id);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--rb-text)]">
          Upload your résumé
        </h1>
        <p className="mt-2 text-sm text-[var(--rb-text-secondary)]">
          Any format works. We&apos;ll turn it into a clean, ATS-ready profile you can edit, it only takes a moment.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFiles(e.dataTransfer.files); }}
        aria-busy={uploading}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-2xl)] border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging ? 'border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]' : 'border-[var(--rb-border)] bg-[var(--rb-bg-surface)] hover:border-[var(--rb-border-strong)]'
        }`}
      >
        {uploading ? (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--rb-text-secondary)]">
            <Loader2 className="size-5 animate-spin" /> Building your profile…
          </span>
        ) : (
          <>
            <UploadCloud className="size-8 text-[var(--rb-text-muted)]" />
            <span className="mt-3 text-sm text-[var(--rb-text-secondary)]">
              Drag &amp; drop or <span className="font-semibold text-[var(--rb-text-brand)]">browse</span>
            </span>
            <span className="mt-1 text-xs text-[var(--rb-text-muted)]">PDF, DOCX, or TXT up to 10MB</span>
          </>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {error && <p role="alert" className="mt-3 text-center text-sm text-[var(--color-error)]">{error}</p>}

      <div className="mt-6 flex justify-center">
        <button
          onClick={onSkip}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--rb-text-muted)] hover:text-[var(--rb-text-secondary)] disabled:opacity-50"
        >
          Skip for now
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
