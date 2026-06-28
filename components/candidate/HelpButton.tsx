'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { HelpCircle, X, ArrowUpRight } from 'lucide-react';
import HowItWorks from './HowItWorks';

// Persistent help affordance in the dashboard chrome. Opens the "How it works"
// explainer in a dialog (Headless UI gives focus trap, ESC, scroll lock, focus
// return for free — WCAG AA). Links inside close the dialog first, because the
// dashboard layout persists across client navigation and would otherwise leave
// the modal open over the new page.
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
      >
        <HelpCircle className="size-4 shrink-0" />
        How it works
      </button>

      <Dialog open={open} onClose={close} className="relative z-[var(--z-modal)]">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm transition duration-[var(--duration-base)] data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex justify-center sm:items-center sm:p-6">
          <DialogPanel
            transition
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--rb-bg-surface)] shadow-[var(--shadow-modal)] transition duration-[var(--duration-base)] ease-[var(--ease-spring)] data-[closed]:translate-y-3 data-[closed]:opacity-0 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-[var(--radius-2xl)] sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
          >
            <div className="flex items-center justify-between border-b border-[var(--rb-border)] px-5 py-3">
              <span className="text-sm font-semibold text-[var(--rb-text)]">Help</span>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded p-1 text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <HowItWorks onLinkClick={close} />
            </div>

            <div className="border-t border-[var(--rb-border)] px-5 py-3">
              <Link
                href="/dashboard/guide"
                onClick={close}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--rb-brand)] hover:opacity-80"
              >
                Open the full guide
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
