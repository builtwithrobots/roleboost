'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface Props {
  /** The URL to share. Defaults to the current page at click time. */
  url?: string;
  title?: string;
  text?: string;
  className?: string;
  /** Render icon-only (square tap target) instead of an icon + label. */
  iconOnly?: boolean;
}

/**
 * Native Web Share where the platform supports it (the OS share sheet on
 * mobile), falling back to copy-to-clipboard with confirmation on desktop. One
 * button, two behaviors, so callers don't have to branch. Capability is checked
 * at click time (not render) to avoid SSR/hydration drift.
 */
export default function ShareButton({ url, title, text, className, iconOnly }: Props) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (!shareUrl) return;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (e) {
        // User dismissed the sheet, not an error. Fall through to copy on real failures.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable, nothing more we can do silently */
    }
  }

  const Icon = copied ? Check : Share2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share this profile"
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]'
      }
    >
      <Icon className="size-3.5" />
      {!iconOnly && (copied ? 'Copied!' : 'Share')}
    </button>
  );
}
