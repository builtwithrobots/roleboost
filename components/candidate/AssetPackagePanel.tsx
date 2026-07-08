'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Sparkles,
  Loader2,
  Download,
  Copy,
  Check,
  RotateCcw,
  Star,
  CheckCircle2,
  Quote,
  Hash,
  Upload,
  Package,
  Headphones,
  ImageIcon,
  Film,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { chooseAssetPackagePerspective } from '@/app/(candidate)/dashboard/ai/actions';
import {
  ASSET_PACKAGE_STORY_TYPE_LABELS,
  type AssetPackage,
  type AssetPackagePerspective,
  type AssetPackagePerspectiveKey,
  type AssetPackagePrompt,
} from '@/lib/types';

interface Props {
  initialPackage: AssetPackage | null;
  slug: string;
  fullName: string;
  defaultTargetRole: string;
  hasResume: boolean;
  hasSources: boolean;
  /** Refresh the server component so the Context Document tab reflects a new choice. */
  onRefresh: () => void;
}

const MAX_JD = 50000;

const PROMPT_META: {
  key: keyof AssetPackagePerspective['prompts'];
  label: string;
  Icon: typeof Headphones;
}[] = [
  { key: 'deep_dive', label: 'Deep Dive (audio)', Icon: Headphones },
  { key: 'brief', label: 'Brief (audio)', Icon: Headphones },
  { key: 'infographic', label: 'Infographic', Icon: ImageIcon },
  { key: 'short_video', label: 'Short Video', Icon: Film },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AssetPackagePanel({
  initialPackage,
  slug,
  fullName,
  defaultTargetRole,
  hasResume,
  hasSources,
  onRefresh,
}: Props) {
  const [pkg, setPkg] = useState<AssetPackage | null>(initialPackage);
  const [mode, setMode] = useState<'view' | 'form'>(initialPackage ? 'view' : 'form');
  const [targetRole, setTargetRole] = useState(initialPackage?.target_role || defaultTargetRole);
  const [jobDescription, setJobDescription] = useState(initialPackage?.job_description ?? '');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onJdFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = (await file.text()).slice(0, MAX_JD);
      setJobDescription(text);
    } catch {
      setError('Could not read that file. Paste the job description instead.');
    }
  }

  async function generate() {
    if (!targetRole.trim()) {
      setError('Enter the role you are targeting first.');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch('/api/asset-package/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_role: targetRole.trim(),
          job_description: jobDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        if (res.status === 402) {
          setError('Generating an asset package needs an active subscription or trial.');
        } else if (body?.error?.message) {
          setError(body.error.message);
        } else {
          setError('Could not generate your asset package just now. Please try again.');
        }
        return;
      }
      const data = (await res.json()) as { package: AssetPackage };
      setPkg(data.package);
      setMode('view');
      onRefresh();
    } catch {
      setError('Could not generate your asset package just now. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function choose(perspective: AssetPackagePerspectiveKey) {
    if (!pkg) return;
    setError(null);
    startTransition(async () => {
      const res = await chooseAssetPackagePerspective({ perspective });
      if (res.ok) {
        setPkg({ ...pkg, chosen: perspective });
        onRefresh();
      } else {
        setError('Could not set that perspective as active. Please try again.');
      }
    });
  }

  function download() {
    if (!pkg) return;
    const blob = new Blob([pkg.full_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-asset-package.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── Gate: no résumé ─────────────────────────────────────────────────────────
  if (!hasResume) {
    return <ResumeFallback context="asset package" />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
          <Package className="size-4 text-[var(--rb-brand)]" />
          Asset package
        </h2>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          Enter the role you are targeting and paste a job description. Your AI builds two complete
          narrative perspectives, each with ready-to-run scripts for your Boosts (audio and
          infographic), all strategized for that job. Choose a perspective to make it your AI&apos;s
          active career context.
        </p>
      </header>

      {mode === 'form' || !pkg ? (
        <GenerateForm
          targetRole={targetRole}
          setTargetRole={setTargetRole}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          onFile={onJdFile}
          fileRef={fileRef}
          onGenerate={generate}
          generating={generating}
          hasExisting={!!pkg}
          onCancel={pkg ? () => setMode('view') : undefined}
          hasSources={hasSources}
        />
      ) : (
        <PackageView
          pkg={pkg}
          fullName={fullName}
          onChoose={choose}
          choosing={pending}
          onRegenerate={() => setMode('form')}
          onDownload={download}
        />
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </section>
  );
}

// ── Résumé fallback ─────────────────────────────────────────────────────────

export function ResumeFallback({ context }: { context: string }) {
  return (
    <div className="rb-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/40">
        <Upload className="size-5 text-[var(--rb-brand)]" />
      </span>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-[var(--rb-text)]">Upload your résumé first</h3>
        <p className="mt-1 text-xs text-[var(--rb-text-muted)]">
          Your {context} is built from your résumé. Add it in the Assets section, then come back here to
          generate.
        </p>
      </div>
      <Link
        href="/dashboard/assets"
        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Upload className="size-4" />
        Go to Assets
      </Link>
    </div>
  );
}

// ── Generate form ───────────────────────────────────────────────────────────

function GenerateForm({
  targetRole,
  setTargetRole,
  jobDescription,
  setJobDescription,
  onFile,
  fileRef,
  onGenerate,
  generating,
  hasExisting,
  onCancel,
  hasSources,
}: {
  targetRole: string;
  setTargetRole: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  onFile: (file: File | undefined) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onGenerate: () => void;
  generating: boolean;
  hasExisting: boolean;
  onCancel?: () => void;
  hasSources: boolean;
}) {
  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)] focus:shadow-[var(--shadow-focus)] transition-shadow duration-[var(--duration-fast)]';

  return (
    <div className="rb-card flex flex-col gap-5 p-6">
      <div>
        <label htmlFor="ap-role" className="mb-1.5 block text-xs font-medium text-[var(--rb-text-secondary)]">
          Target role
        </label>
        <input
          id="ap-role"
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Customer Service Team Lead"
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="ap-jd" className="block text-xs font-medium text-[var(--rb-text-secondary)]">
            Job description <span className="text-[var(--rb-text-muted)]">(optional, sharpens the strategy)</span>
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
          >
            <Upload className="size-3" />
            Upload .txt / .md
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.markdown,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        <textarea
          id="ap-jd"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value.slice(0, MAX_JD))}
          placeholder="Paste the job posting so your AI can strategize the narrative and scripts for this exact role."
          rows={6}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? 'Building your package…' : hasExisting ? 'Regenerate package' : 'Generate asset package'}
        </button>
        {onCancel && !generating && (
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-2 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
          >
            Cancel
          </button>
        )}
      </div>

      {generating ? (
        <p className="text-xs text-[var(--rb-text-muted)]">
          Reading your career, applying the story framework, and writing both perspectives with their
          scripts. This is the slow, thorough kind of work; give it a couple of minutes.
        </p>
      ) : (
        !hasSources && (
          <p className="text-xs text-[var(--rb-text-muted)]">
            Tip: add career sources in the Build tab (LinkedIn, reviews, recommendations) to give the
            strategy more evidence to work with.
          </p>
        )
      )}
    </div>
  );
}

// ── Package view ────────────────────────────────────────────────────────────

function PackageView({
  pkg,
  fullName,
  onChoose,
  choosing,
  onRegenerate,
  onDownload,
}: {
  pkg: AssetPackage;
  fullName: string;
  onChoose: (p: AssetPackagePerspectiveKey) => void;
  choosing: boolean;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  const [jdOpen, setJdOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {/* Meta header */}
      <div className="rb-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: pkg.identity.avatar_color.hex }}
          >
            {pkg.identity.initials || fullName.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-[var(--rb-text)]">
            {ASSET_PACKAGE_STORY_TYPE_LABELS[pkg.story_type]}
          </span>
          <span className="text-xs text-[var(--rb-text-muted)]">·</span>
          <span className="text-xs text-[var(--rb-text-muted)]">Targeting: {pkg.target_role}</span>
          <span className="ml-auto text-xs text-[var(--rb-text-muted)]">
            Generated {formatDate(pkg.generated_at)}
          </span>
        </div>

        {pkg.job_description && (
          <div>
            <button
              onClick={() => setJdOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-brand)]"
              aria-expanded={jdOpen}
            >
              <ChevronDown className={`size-3 transition-transform ${jdOpen ? 'rotate-180' : ''}`} />
              {jdOpen ? 'Hide' : 'Show'} the job description used
            </button>
            {jdOpen && (
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] p-3 text-xs text-[var(--rb-text-secondary)]">
                {pkg.job_description}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
          >
            <Download className="size-3.5" />
            Download .md
          </button>
          <CopyButton text={pkg.full_markdown} label="Copy full package" idleClass="border" />
          <button
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
          >
            <RotateCcw className="size-3.5" />
            Regenerate
          </button>
        </div>
      </div>

      {!pkg.chosen && (
        <p className="text-xs text-[var(--rb-text-muted)]">
          Pick the perspective that tells your story best. It becomes your AI&apos;s active career
          context and shows up in the Context Document tab. Both perspectives&apos; scripts stay
          available to run in NotebookLM either way.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {(['A', 'B'] as AssetPackagePerspectiveKey[]).map((key) => (
          <PerspectiveCard
            key={key}
            letter={key}
            perspective={pkg.perspectives[key]}
            isRecommended={pkg.recommended === key}
            isChosen={pkg.chosen === key}
            onChoose={() => onChoose(key)}
            busy={choosing}
          />
        ))}
      </div>
    </div>
  );
}

function PerspectiveCard({
  letter,
  perspective: p,
  isRecommended,
  isChosen,
  onChoose,
  busy,
}: {
  letter: AssetPackagePerspectiveKey;
  perspective: AssetPackagePerspective;
  isRecommended: boolean;
  isChosen: boolean;
  onChoose: () => void;
  busy: boolean;
}) {
  return (
    <div className={`rb-card flex flex-col gap-4 p-5 ${isChosen ? 'ring-2 ring-[var(--rb-brand)]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--rb-text-muted)]">
              Perspective {letter}
            </span>
            <span className="text-sm font-semibold text-[var(--rb-text)]">{p.name}</span>
            {isRecommended && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rb-brand-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-brand)]">
                <Star className="size-2.5" />
                Recommended
              </span>
            )}
          </div>
          {p.summary && <p className="mt-1 text-xs text-[var(--rb-text-muted)]">{p.summary}</p>}
        </div>
        <div className="shrink-0">
          {isChosen ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
              <CheckCircle2 className="size-4" />
              Active in your AI
            </span>
          ) : (
            <button
              onClick={onChoose}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Choose this narrative
            </button>
          )}
        </div>
      </div>

      {/* Section 1 */}
      {p.narrative && (
        <p className="text-sm leading-relaxed text-[var(--rb-text-secondary)]">{p.narrative}</p>
      )}
      {p.hook && (
        <div className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-2">
          <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--rb-text)]">
            <Quote className="mt-0.5 size-3 shrink-0 text-[var(--rb-brand)]" />
            {p.hook}
          </p>
        </div>
      )}
      {p.hard_question?.question && (
        <div>
          <p className="text-xs font-semibold text-[var(--rb-text-secondary)]">{p.hard_question.question}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--rb-text-muted)]">{p.hard_question.answer}</p>
        </div>
      )}
      {p.key_numbers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {p.key_numbers.map((num, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--rb-text-secondary)]">
              <Hash className="mt-0.5 size-3 shrink-0 text-[var(--rb-brand)]" />
              {num}
            </li>
          ))}
        </ul>
      )}

      {/* Section 2 -- the NotebookLM prompts */}
      <div className="flex flex-col gap-3 border-t border-[var(--rb-border)] pt-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-text-muted)]">
          NotebookLM prompts
        </span>
        {PROMPT_META.map(({ key, label, Icon }) => (
          <PromptBlock key={key} label={label} Icon={Icon} prompt={p.prompts[key]} />
        ))}
      </div>
    </div>
  );
}

function PromptBlock({
  label,
  Icon,
  prompt,
}: {
  label: string;
  Icon: typeof Headphones;
  prompt: AssetPackagePrompt;
}) {
  const [open, setOpen] = useState(false);
  if (!prompt.body) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--rb-border)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown className={`size-3.5 shrink-0 text-[var(--rb-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
          <Icon className="size-3.5 shrink-0 text-[var(--rb-brand)]" />
          <span className="truncate text-xs font-semibold text-[var(--rb-text)]">{label}</span>
          {prompt.title && (
            <span className="truncate text-xs text-[var(--rb-text-muted)]">· {prompt.title}</span>
          )}
        </button>
        <CopyButton text={prompt.body} label="Copy" compact />
      </div>
      {open && (
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--rb-border)] px-3 py-2.5 font-sans text-xs leading-relaxed text-[var(--rb-text-secondary)]">
          {prompt.body}
        </pre>
      )}
    </div>
  );
}

function CopyButton({
  text,
  label,
  compact = false,
  idleClass = '',
}: {
  text: string;
  label: string;
  compact?: boolean;
  idleClass?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable; silently ignore
    }
  }

  const base = compact
    ? 'inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-medium'
    : `inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium ${idleClass ? 'border border-[var(--rb-border)]' : ''}`;

  return (
    <button
      onClick={copy}
      className={`${base} text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]`}
      aria-live="polite"
    >
      {copied ? <Check className="size-3.5 text-[var(--color-success)]" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
