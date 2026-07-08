'use client';

import { useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Download,
  Copy,
  Check,
  Star,
  Quote,
  Hash,
  Upload,
  Package,
  Headphones,
  ImageIcon,
  Film,
  ChevronDown,
  Search,
  User,
  UserPlus,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  ASSET_PACKAGE_STORY_TYPE_LABELS,
  type AssetPackage,
  type AssetPackagePerspective,
  type AssetPackagePerspectiveKey,
  type AssetPackagePrompt,
} from '@/lib/types';

// The superadmin Asset Package production tool. Generates the full deliverable
// (both perspectives + all NotebookLM prompts) for a platform candidate or an
// off-platform order, and hands the admin the .md to download and deliver.

export interface AdminCandidateOption {
  id: string;
  slug: string;
  fullName: string;
  targetRole: string | null;
  hasResume: boolean;
  hasPackage: boolean;
}

interface Props {
  candidates: AdminCandidateOption[];
}

const MAX_JD = 50000;
const MAX_RESUME = 100000;

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

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)] focus:shadow-[var(--shadow-focus)] transition-shadow duration-[var(--duration-fast)]';

export default function AdminAssetPackageTool({ candidates }: Props) {
  const [mode, setMode] = useState<'platform' | 'offplatform'>('platform');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminCandidateOption | null>(null);
  const [offName, setOffName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeOverride, setResumeOverride] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pkg, setPkg] = useState<AssetPackage | null>(null);
  const [pkgSlug, setPkgSlug] = useState<string>('candidate');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? candidates.filter(
        (c) =>
          c.fullName.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.slug.includes(query.trim().toLowerCase()),
      )
    : candidates;

  async function pickCandidate(c: AdminCandidateOption) {
    setSelected(c);
    setTargetRole(c.targetRole ?? '');
    setPkg(null);
    setSaved(null);
    setError(null);
    // Re-open the saved delivery record, if any.
    if (c.hasPackage) {
      setLoadingSaved(true);
      try {
        const res = await fetch(
          `/api/admin/asset-package/generate?candidateId=${encodeURIComponent(c.id)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { package: AssetPackage | null };
          if (data.package) {
            setPkg(data.package);
            setPkgSlug(c.slug);
            setTargetRole(data.package.target_role || c.targetRole || '');
            setJobDescription(data.package.job_description ?? '');
            setSaved(true);
          }
        }
      } catch {
        // saved-package load is best-effort; the admin can still regenerate
      } finally {
        setLoadingSaved(false);
      }
    }
  }

  async function onResumeFile(file: File | undefined) {
    if (!file) return;
    try {
      setResumeOverride((await file.text()).slice(0, MAX_RESUME));
      setOverrideOpen(true);
    } catch {
      setError('Could not read that file. Paste the résumé text instead.');
    }
  }

  async function generate() {
    const offPlatform = mode === 'offplatform';
    if (offPlatform && !offName.trim()) {
      setError('Enter the candidate’s full name.');
      return;
    }
    if (!offPlatform && !selected) {
      setError('Pick a candidate first.');
      return;
    }
    if (offPlatform && !resumeOverride.trim()) {
      setError('Paste the candidate’s résumé for an off-platform order.');
      return;
    }
    if (!targetRole.trim()) {
      setError('Enter the target role.');
      return;
    }
    setError(null);
    setGenerating(true);
    setSaved(null);
    try {
      const res = await fetch('/api/admin/asset-package/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_profile_id: offPlatform ? undefined : selected!.id,
          full_name: offPlatform ? offName.trim() : undefined,
          target_role: targetRole.trim(),
          job_description: jobDescription.trim() || undefined,
          resume_override: resumeOverride.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? 'Generation failed. Please try again.');
        return;
      }
      const data = (await res.json()) as { package: AssetPackage; saved: boolean };
      setPkg(data.package);
      setPkgSlug(offPlatform ? data.package.identity.slug : selected!.slug);
      setSaved(offPlatform ? null : data.saved);
    } catch {
      setError('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!pkg) return;
    const blob = new Blob([pkg.full_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkgSlug}-asset-package.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mode switch */}
      <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--rb-border)] p-1 self-start">
        {(
          [
            { key: 'platform', label: 'Platform candidate', Icon: User },
            { key: 'offplatform', label: 'Off-platform order', Icon: UserPlus },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setError(null);
            }}
            aria-pressed={mode === key}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === key
                ? 'bg-[var(--rb-brand-subtle)] text-[var(--rb-brand)]'
                : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        {/* Left: candidate picker / off-platform name */}
        <div className="rb-card flex flex-col gap-3 p-4">
          {mode === 'platform' ? (
            <>
              <label htmlFor="ap-search" className="sr-only">
                Search candidates
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--rb-text-muted)]" />
                <input
                  id="ap-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or slug…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto" aria-label="Candidates">
                {filtered.slice(0, 50).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => pickCandidate(c)}
                      className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors ${
                        selected?.id === c.id
                          ? 'bg-[var(--rb-brand-subtle)]'
                          : 'hover:bg-[var(--rb-bg-surface-raised)]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--rb-text)]">
                          {c.fullName}
                        </span>
                        <span className="block truncate text-xs text-[var(--rb-text-muted)]">
                          /{c.slug}
                          {c.targetRole ? ` · ${c.targetRole}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {c.hasResume && (
                          <FileText
                            className="size-3.5 text-[var(--color-success)]"
                            aria-label="Résumé on file"
                          />
                        )}
                        {c.hasPackage && (
                          <Package
                            className="size-3.5 text-[var(--rb-brand)]"
                            aria-label="Package already generated"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-xs text-[var(--rb-text-muted)]">No candidates match.</li>
                )}
              </ul>
            </>
          ) : (
            <>
              <label
                htmlFor="ap-offname"
                className="text-xs font-medium text-[var(--rb-text-secondary)]"
              >
                Candidate full name
              </label>
              <input
                id="ap-offname"
                type="text"
                value={offName}
                onChange={(e) => setOffName(e.target.value)}
                placeholder="e.g. Jordan Mills"
                maxLength={200}
                className={inputClass}
              />
              <p className="text-xs text-[var(--rb-text-muted)]">
                For orders from candidates who are not on RoleBoost yet. Paste their résumé on the
                right; the slug is derived from the name.
              </p>
            </>
          )}
        </div>

        {/* Right: inputs + result */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rb-card flex flex-col gap-4 p-5">
            <div>
              <label
                htmlFor="ap-role"
                className="mb-1.5 block text-xs font-medium text-[var(--rb-text-secondary)]"
              >
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
              <label
                htmlFor="ap-jd"
                className="mb-1.5 block text-xs font-medium text-[var(--rb-text-secondary)]"
              >
                Job description <span className="text-[var(--rb-text-muted)]">(optional, sharpens the strategy)</span>
              </label>
              <textarea
                id="ap-jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value.slice(0, MAX_JD))}
                placeholder="Paste the job posting the candidate is targeting."
                rows={5}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setOverrideOpen((o) => !o)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:text-[var(--rb-brand)]"
                  aria-expanded={overrideOpen}
                >
                  <ChevronDown
                    className={`size-3 transition-transform ${overrideOpen ? 'rotate-180' : ''}`}
                  />
                  Résumé {mode === 'offplatform' ? '(required)' : 'override (optional)'}
                </button>
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
                  onChange={(e) => onResumeFile(e.target.files?.[0])}
                />
              </div>
              {(overrideOpen || mode === 'offplatform') && (
                <textarea
                  value={resumeOverride}
                  onChange={(e) => setResumeOverride(e.target.value.slice(0, MAX_RESUME))}
                  placeholder={
                    mode === 'offplatform'
                      ? 'Paste the candidate’s full résumé text.'
                      : 'Paste résumé text to use INSTEAD of the candidate’s stored résumé.'
                  }
                  rows={6}
                  className={`${inputClass} mt-2 resize-none`}
                  aria-label="Résumé text"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={generate}
                disabled={generating || loadingSaved}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {generating ? 'Producing the package…' : pkg ? 'Regenerate package' : 'Generate package'}
              </button>
              {generating && (
                <span className="text-xs text-[var(--rb-text-muted)]">
                  Full skill run: Mirror, story type, both perspectives, all prompts. Give it a couple
                  of minutes.
                </span>
              )}
              {loadingSaved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading saved package…
                </span>
              )}
            </div>

            {error && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {error}
              </p>
            )}
          </div>

          {pkg && (
            <PackageResult
              pkg={pkg}
              saved={saved}
              onDownload={download}
              slug={pkgSlug}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Result view ─────────────────────────────────────────────────────────────

function PackageResult({
  pkg,
  saved,
  onDownload,
  slug,
}: {
  pkg: AssetPackage;
  saved: boolean | null;
  onDownload: () => void;
  slug: string;
}) {
  const [jdOpen, setJdOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {saved === false && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg,#FEF3C7)] px-3 py-2.5 text-xs text-[var(--rb-text)]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning,#B45309)]" />
          The package was generated but could not be saved to the candidate&apos;s profile (the
          asset_package migration may not be applied yet). Download it now; it is not stored.
        </p>
      )}

      {/* Meta header */}
      <div className="rb-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: pkg.identity.avatar_color.hex }}
          >
            {pkg.identity.initials || pkg.identity.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-[var(--rb-text)]">{pkg.identity.name}</span>
          <span className="text-xs text-[var(--rb-text-muted)]">·</span>
          <span className="text-sm text-[var(--rb-text-secondary)]">
            {ASSET_PACKAGE_STORY_TYPE_LABELS[pkg.story_type]}
          </span>
          <span className="text-xs text-[var(--rb-text-muted)]">·</span>
          <span className="text-xs text-[var(--rb-text-muted)]">Targeting: {pkg.target_role}</span>
          <span className="ml-auto flex items-center gap-2 text-xs text-[var(--rb-text-muted)]">
            {saved && (
              <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                <CheckCircle2 className="size-3.5" />
                Saved to profile
              </span>
            )}
            Generated {formatDate(pkg.generated_at)}
          </span>
        </div>
        <p className="text-xs text-[var(--rb-text-muted)]">
          Avatar color: {pkg.identity.avatar_color.name} ({pkg.identity.avatar_color.hex}).{' '}
          {pkg.identity.avatar_color.rationale}
        </p>

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
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Download className="size-3.5" />
            Download {slug}-asset-package.md
          </button>
          <CopyButton text={pkg.full_markdown} label="Copy full package" bordered />
        </div>
      </div>

      {(['A', 'B'] as AssetPackagePerspectiveKey[]).map((key) => (
        <PerspectiveCard
          key={key}
          letter={key}
          perspective={pkg.perspectives[key]}
          isRecommended={pkg.recommended === key}
        />
      ))}
    </div>
  );
}

function PerspectiveCard({
  letter,
  perspective: p,
  isRecommended,
}: {
  letter: AssetPackagePerspectiveKey;
  perspective: AssetPackagePerspective;
  isRecommended: boolean;
}) {
  return (
    <div className="rb-card flex flex-col gap-4 p-5">
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
          <p className="text-xs font-semibold text-[var(--rb-text-secondary)]">
            {p.hard_question.question}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--rb-text-muted)]">
            {p.hard_question.answer}
          </p>
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
          <ChevronDown
            className={`size-3.5 shrink-0 text-[var(--rb-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          />
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
  bordered = false,
}: {
  text: string;
  label: string;
  compact?: boolean;
  bordered?: boolean;
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
    : `inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium ${
        bordered ? 'border border-[var(--rb-border)]' : ''
      }`;

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
