'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { uploadStateFade } from '@/lib/motion-dashboard';
import {
  Headphones,
  MessageSquare,
  Video,
  Layout,
  Image as ImageIcon,
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';

interface ExistingAsset {
  id: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
  signed_url?: string;
}

interface Props {
  assetType: AssetType;
  candidateProfileId: string;
  existingAsset?: ExistingAsset | null;
  onUploadComplete?: () => void;
}

const ASSET_META: Record<AssetType, {
  icon: React.ElementType;
  label: string;
  description: string;
  accept: string;
  hint: string;
  maxSize: string;
}> = {
  audio: {
    icon: Headphones,
    label: 'Audio Brief',
    description: 'Your 2–5 minute career story. Produced via NotebookLM.',
    accept: 'audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.ogg',
    hint: 'MP3, M4A, WAV up to 50MB',
    maxSize: '50MB',
  },
  debate_audio: {
    icon: MessageSquare,
    label: 'Debate Audio',
    description: 'Two-voice AI debate format highlighting your strengths.',
    accept: 'audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.ogg',
    hint: 'MP3, M4A, WAV up to 50MB',
    maxSize: '50MB',
  },
  video: {
    icon: Video,
    label: 'Video Overview',
    description: 'Optional short video overview of your career narrative.',
    accept: 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov',
    hint: 'MP4, WebM up to 500MB',
    maxSize: '500MB',
  },
  deck: {
    icon: Layout,
    label: 'Slide Deck',
    description: 'Career snapshot deck — 5–10 slides in PDF format.',
    accept: 'application/pdf,.pdf',
    hint: 'PDF up to 25MB',
    maxSize: '25MB',
  },
  infographic: {
    icon: ImageIcon,
    label: 'Career Infographic',
    description: 'Visual one-pager of your career timeline and highlights.',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    hint: 'PNG, JPG, WebP up to 10MB',
    maxSize: '10MB',
  },
  resume: {
    icon: FileText,
    label: 'ATS Resume',
    description: 'Clean, machine-readable PDF resume for ATS systems.',
    accept: 'application/pdf,.pdf',
    hint: 'PDF up to 10MB',
    maxSize: '10MB',
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssetUploadCard({ assetType, candidateProfileId, existingAsset, onUploadComplete }: Props) {
  const meta = ASSET_META[assetType];
  const Icon = meta.icon;
  const prefersReduced = useReducedMotion();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [localAsset, setLocalAsset] = useState<ExistingAsset | null | undefined>(existingAsset);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploadState('uploading');
      setErrorMsg('');

      const form = new FormData();
      form.append('file', file);
      form.append('asset_type', assetType);
      form.append('candidate_profile_id', candidateProfileId);

      try {
        const res = await fetch('/api/assets/upload', { method: 'POST', body: form });
        const json = await res.json();

        if (!res.ok || !json.ok) {
          setErrorMsg(json.error?.message ?? 'Upload failed. Please try again.');
          setUploadState('error');
          return;
        }

        setLocalAsset({
          id: json.asset_id,
          file_name: file.name,
          file_size_bytes: file.size,
          created_at: new Date().toISOString(),
        });
        setUploadState('success');
        setTimeout(() => setUploadState('idle'), 3000);
        onUploadComplete?.();
      } catch {
        setErrorMsg('Upload failed. Check your connection and try again.');
        setUploadState('error');
      }
    },
    [assetType, candidateProfileId, onUploadComplete]
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const hasAsset = !!localAsset;

  return (
    <div className="rb-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--rb-border)]">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
          <Icon className="size-4.5 text-[var(--rb-brand)]" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--rb-text)]">{meta.label}</div>
          <div className="text-xs text-[var(--rb-text-muted)] leading-relaxed mt-0.5">{meta.description}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-4">
        {/* Existing asset */}
        {hasAsset && (
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--rb-bg-surface-raised)] px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--rb-text)] truncate">{localAsset!.file_name}</div>
              <div className="flex items-center gap-2 text-xs text-[var(--rb-text-muted)]">
                {localAsset!.file_size_bytes && (
                  <span className="font-data">{formatBytes(localAsset!.file_size_bytes)}</span>
                )}
                <span>·</span>
                <span>{formatDate(localAsset!.created_at)}</span>
              </div>
            </div>
            {/* Preview button for audio/video */}
            {(assetType === 'audio' || assetType === 'debate_audio') && localAsset!.signed_url && (
              <a
                href={localAsset!.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--rb-brand)] hover:bg-[var(--rb-brand-subtle)] transition-colors"
              >
                <Play className="size-3" />
                Play
              </a>
            )}
          </div>
        )}

        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => uploadState !== 'uploading' && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all duration-[var(--duration-base)] ${
            isDragging
              ? 'border-[var(--rb-brand)] bg-[var(--rb-brand-subtle)]'
              : uploadState === 'uploading'
              ? 'border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] cursor-wait'
              : 'border-[var(--rb-border)] hover:border-[var(--rb-border-brand)] hover:bg-[var(--rb-brand-subtle)]/40'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={uploadState}
              variants={uploadStateFade}
              initial={prefersReduced ? false : 'hidden'}
              animate="visible"
              exit="exit"
              className="flex flex-col items-center gap-2"
            >
              {uploadState === 'uploading' ? (
                <>
                  <Loader2 className="size-5 text-[var(--rb-brand)] animate-spin" />
                  <span className="text-xs text-[var(--rb-text-secondary)]">Uploading…</span>
                </>
              ) : uploadState === 'success' ? (
                <>
                  <CheckCircle2 className="size-5 text-[var(--color-success)]" />
                  <span className="text-xs text-[var(--color-success)] font-medium">Uploaded!</span>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-[var(--rb-text-muted)]" />
                  <div>
                    <span className="text-xs font-medium text-[var(--rb-text-secondary)]">
                      {hasAsset ? 'Drop to replace' : 'Drag & drop or '}
                    </span>
                    {!hasAsset && (
                      <span className="text-xs font-medium text-[var(--rb-brand)]">browse</span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--rb-text-muted)]">{meta.hint}</span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {uploadState === 'error' && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] px-3 py-2">
            <AlertCircle className="size-3.5 shrink-0 text-[var(--color-error)] mt-0.5" />
            <span className="text-xs text-[var(--color-error)]">{errorMsg}</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Footer actions */}
      {hasAsset && (
        <div className="flex gap-2 px-5 py-3 border-t border-[var(--rb-border)]">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-[var(--rb-text-secondary)] hover:text-[var(--rb-brand)] transition-colors"
          >
            <RefreshCw className="size-3" />
            Replace
          </button>
        </div>
      )}
    </div>
  );
}
