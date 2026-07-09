'use client';

import { useState, useTransition, type ReactNode } from 'react';
import {
  UserRound,
  Eye,
  Bot,
  Search,
  Download,
  FileJson,
  FileArchive,
  ShieldAlert,
  RotateCcw,
  Trash2,
  Loader2,
  Check,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch, SwitchField } from '@/components/ui/switch';
import { Label, Description } from '@/components/ui/fieldset';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog';
import {
  updateVisibilitySettings,
  resetAiLearning,
  deleteEverythingAndRestart,
} from '@/app/(candidate)/dashboard/settings/actions';

interface Props {
  account: {
    fullName: string;
    email: string;
    slug: string;
    memberSince: string | null;
    subscriptionTier: string | null;
    subscriptionStatus: string;
  };
  settings: {
    isPublished: boolean;
    aiEnabled: boolean;
    searchDiscoverable: boolean;
  };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app';

function planLabel(tier: string | null, status: string): string {
  if (tier) return tier.charAt(0).toUpperCase() + tier.slice(1);
  if (status === 'active') return 'Active';
  return 'Free';
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Not available';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Not available';
  }
}

// ── Layout primitives ───────────────────────────────────────────────────────

function Section({
  icon,
  tint,
  title,
  description,
  children,
  danger = false,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={
        danger
          ? 'rounded-xl border border-red-200 bg-red-50/40 shadow-[var(--shadow-card)] dark:border-red-900/50 dark:bg-red-950/20'
          : 'rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] shadow-[var(--shadow-card)]'
      }
    >
      <div className="flex items-start gap-3 border-b border-[var(--rb-border)] px-5 py-4 dark:border-white/5">
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold tracking-tight text-[var(--rb-text)]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--rb-text-secondary)]">{description}</p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm font-medium text-[var(--rb-text-secondary)]">{label}</dt>
      <dd className="min-w-0 text-sm text-[var(--rb-text)] sm:text-right">{children}</dd>
    </div>
  );
}

// ── Confirmation dialog for destructive actions ─────────────────────────────

function DangerDialog({
  open,
  onClose,
  tone,
  title,
  intro,
  removes,
  keeps,
  confirmWord,
  confirmLabel,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  tone: 'amber' | 'red';
  title: string;
  intro: string;
  removes: string[];
  keeps?: string[];
  confirmWord: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const armed = typed.trim().toUpperCase() === confirmWord;

  // Clear the confirmation input on every close path (Cancel, ESC, backdrop),
  // so reopening the dialog always starts blank.
  const handleClose = () => {
    setTyped('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={busy ? () => {} : handleClose} size="lg">
      <div className="flex items-start gap-3">
        <span
          className={
            tone === 'red'
              ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
              : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
          }
          aria-hidden="true"
        >
          <AlertTriangle className="size-5" strokeWidth={2} />
        </span>
        <DialogTitle className="pt-1.5">{title}</DialogTitle>
      </div>

      <DialogBody>
        <p className="text-sm text-[var(--rb-text-secondary)]">{intro}</p>

        <div className="mt-4 rounded-lg border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] p-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--rb-text-secondary)] uppercase">
            This permanently removes
          </p>
          <ul className="mt-2 space-y-1.5">
            {removes.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-[var(--rb-text)]">
                <Trash2 className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {keeps && keeps.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold tracking-wide text-[var(--rb-text-secondary)] uppercase">
                What stays
              </p>
              <ul className="mt-2 space-y-1.5">
                {keeps.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-[var(--rb-text)]">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="mt-5">
          <label htmlFor="danger-confirm" className="text-sm font-medium text-[var(--rb-text)]">
            Type <span className="font-mono font-bold">{confirmWord}</span> to confirm
          </label>
          <Input
            id="danger-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className="mt-1.5"
            aria-label={`Type ${confirmWord} to confirm`}
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} disabled={!armed || busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Working
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────

export default function SettingsPanel({ account, settings }: Props) {
  const [isPublished, setIsPublished] = useState(settings.isPublished);
  const [aiEnabled, setAiEnabled] = useState(settings.aiEnabled);
  const [searchDiscoverable, setSearchDiscoverable] = useState(settings.searchDiscoverable);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  const [downloading, setDownloading] = useState<'json' | 'zip' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

  const publicUrl = `${APP_URL.replace(/\/$/, '')}/c/${account.slug}`;
  const publicHost = publicUrl.replace(/^https?:\/\//, '');

  function saveToggle(key: 'is_published' | 'ai_enabled' | 'search_discoverable', next: boolean) {
    const prev = {
      is_published: isPublished,
      ai_enabled: aiEnabled,
      search_discoverable: searchDiscoverable,
    };
    setToggleError(null);
    if (key === 'is_published') setIsPublished(next);
    else if (key === 'ai_enabled') setAiEnabled(next);
    else setSearchDiscoverable(next);

    startSaving(async () => {
      const res = await updateVisibilitySettings({ [key]: next });
      if (!res.ok) {
        // Revert on failure so the UI never lies about persisted state.
        setIsPublished(prev.is_published);
        setAiEnabled(prev.ai_enabled);
        setSearchDiscoverable(prev.search_discoverable);
        setToggleError('Could not save that change. Please try again.');
        return;
      }
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
    });
  }

  async function download(format: 'json' | 'zip') {
    setDownloading(format);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/candidate/data-export?format=${format}`);
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? `roleboost-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Something went wrong preparing your download. Please try again.');
    } finally {
      setDownloading(null);
    }
  }

  function runDanger(action: () => Promise<{ ok: boolean; redirectTo?: string; error?: { code: string } }>) {
    setDangerBusy(true);
    setDangerError(null);
    startSaving(async () => {
      try {
        const res = await action();
        if (res.ok && res.redirectTo) {
          // Full navigation so the layout re-evaluates role and fresh state.
          window.location.href = res.redirectTo;
          return;
        }
        setDangerError('Something went wrong. Please try again.');
      } catch {
        setDangerError('Something went wrong. Please try again.');
      } finally {
        setDangerBusy(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Account */}
      <Section
        icon={<UserRound className="size-4.5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />}
        tint="bg-indigo-100 dark:bg-indigo-950/50"
        title="Account"
        description="Your identity and plan on RoleBoost."
      >
        <dl className="divide-y divide-[var(--rb-border)]">
          <InfoRow label="Name">{account.fullName || 'Not set'}</InfoRow>
          <InfoRow label="Email">
            <span className="break-all">{account.email || 'Not set'}</span>
          </InfoRow>
          <InfoRow label="Public link">
            <a
              href={`/c/${account.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[var(--rb-brand)] hover:underline"
            >
              <span className="break-all">{publicHost}</span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          </InfoRow>
          <InfoRow label="Plan">
            <span className="inline-flex items-center rounded-full bg-[var(--rb-brand-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--rb-text-brand)]">
              {planLabel(account.subscriptionTier, account.subscriptionStatus)}
            </span>
          </InfoRow>
          <InfoRow label="Member since">{formatDate(account.memberSince)}</InfoRow>
        </dl>
      </Section>

      {/* Visibility & AI */}
      <Section
        icon={<Eye className="size-4.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />}
        tint="bg-amber-100 dark:bg-amber-950/50"
        title="Visibility & AI"
        description="Control whether your page is public and whether your AI answers questions."
      >
        <div className="space-y-6">
          <SwitchField>
            <Label>Profile is live</Label>
            <Description>
              When on, anyone with your link can view your page. Turn off to take it private.
            </Description>
            <Switch
              color="amber"
              checked={isPublished}
              onChange={(v) => saveToggle('is_published', v)}
              aria-label="Profile is live"
            />
          </SwitchField>

          <SwitchField>
            <Label>
              <span className="inline-flex items-center gap-1.5">
                <Bot className="size-4 text-[var(--rb-text-secondary)]" aria-hidden="true" />
                AI assistant enabled
              </span>
            </Label>
            <Description>
              When on, recruiters can chat with your AI on your page. Turn off to hide the chat.
            </Description>
            <Switch
              color="amber"
              checked={aiEnabled}
              onChange={(v) => saveToggle('ai_enabled', v)}
              aria-label="AI assistant enabled"
            />
          </SwitchField>

          <SwitchField>
            <Label>
              <span className="inline-flex items-center gap-1.5">
                <Search className="size-4 text-[var(--rb-text-secondary)]" aria-hidden="true" />
                Discoverable in search
              </span>
            </Label>
            <Description>
              When on, your page can appear in Google and other search engines, so recruiters can
              find you without a link. Off by default: your page then works only for people you share
              the link with. Your profile must be live for this to take effect.
            </Description>
            <Switch
              color="amber"
              checked={searchDiscoverable}
              disabled={!isPublished}
              onChange={(v) => saveToggle('search_discoverable', v)}
              aria-label="Discoverable in search"
            />
          </SwitchField>

          <div aria-live="polite" className="min-h-5 text-sm">
            {toggleError ? (
              <span className="text-red-600 dark:text-red-400">{toggleError}</span>
            ) : savedKey ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" aria-hidden="true" />
                Saved
              </span>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Your data */}
      <Section
        icon={<Download className="size-4.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />}
        tint="bg-emerald-100 dark:bg-emerald-950/50"
        title="Your data"
        description="Export everything RoleBoost holds for you, anytime."
      >
        <p className="text-sm text-[var(--rb-text-secondary)]">
          Your export includes your profile, career brain, custom answers, intake, self-tests,
          recruiter conversations, career sources, and a manifest of your media assets. Choose a
          data-only file, or a full archive with your media bundled in.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button outline onClick={() => download('json')} disabled={downloading !== null}>
            {downloading === 'json' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileJson data-slot="icon" aria-hidden="true" />
            )}
            Download data (JSON)
          </Button>
          <Button outline onClick={() => download('zip')} disabled={downloading !== null}>
            {downloading === 'zip' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileArchive data-slot="icon" aria-hidden="true" />
            )}
            Download all + media (ZIP)
          </Button>
        </div>
        {downloading === 'zip' && (
          <p className="mt-3 text-xs text-[var(--rb-text-muted)]">
            Bundling your media. Larger accounts can take a moment.
          </p>
        )}
        {downloadError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {downloadError}
          </p>
        )}
      </Section>

      {/* Danger zone */}
      <Section
        icon={<ShieldAlert className="size-4.5 text-red-600 dark:text-red-400" strokeWidth={1.75} />}
        tint="bg-red-100 dark:bg-red-950/50"
        title="Danger zone"
        description="Irreversible actions. Consider downloading your data first."
        danger
      >
        <div className="divide-y divide-red-200/70 dark:divide-red-900/40">
          <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
                <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                Reset my AI training
              </h3>
              <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                Wipe everything your AI learned and was taught, then rebuild from scratch. Keeps your
                account, public link, profile, résumé, and media.
              </p>
            </div>
            <div className="shrink-0">
              <Button outline onClick={() => { setDangerError(null); setResetOpen(true); }}>
                Reset my AI
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                <Trash2 className="size-4" aria-hidden="true" />
                Delete everything and start over
              </h3>
              <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                Permanently delete your profile, AI, data, and files, then restart onboarding as a
                brand-new user with a new link.
              </p>
            </div>
            <div className="shrink-0">
              <Button color="red" onClick={() => { setDangerError(null); setDeleteOpen(true); }}>
                Delete &amp; start over
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <DangerDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        tone="amber"
        title="Reset your AI training?"
        intro="Your AI will forget everything it learned and everything you taught it, and you will build it again from your résumé. This cannot be undone."
        removes={[
          'Your career brain fields and custom answers',
          'Intake interview answers and readiness score',
          'Sandbox self-tests and coaching',
          'Recruiter chat history and surfaced gaps',
          'Your generated career story',
        ]}
        keeps={[
          'Your account and public link',
          'Your name, headline, and profile details',
          'Your résumé and career sources',
          'Your uploaded and generated media',
        ]}
        confirmWord="RESET"
        confirmLabel="Reset my AI"
        busy={dangerBusy}
        error={dangerError}
        onConfirm={() => runDanger(resetAiLearning)}
      />

      <DangerDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        tone="red"
        title="Delete everything and start over?"
        intro="This permanently deletes your entire RoleBoost profile and sends you back through onboarding as a brand-new user. Your public link will change, and anyone who saved you will lose access. This cannot be undone."
        removes={[
          'Your whole profile and public link',
          'Your AI, brain, and all learning',
          'Your résumé, career sources, and media files',
          'All recruiter conversations and meeting requests',
          "Your place in any employer's saved pool",
        ]}
        confirmWord="DELETE"
        confirmLabel="Delete everything"
        busy={dangerBusy}
        error={dangerError}
        onConfirm={() => runDanger(deleteEverythingAndRestart)}
      />
    </div>
  );
}
