'use client';

import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import ChatPanel from './ChatPanel';

interface Props {
  open: boolean;
  onClose: () => void;
  candidateSlug: string;
  candidateName: string;
  suggestedQuestions: string[];
  /** A tapped hero chip to send on open. Bump nonce so each tap re-seeds. */
  seed?: { text: string; nonce: number };
}

/**
 * The conversation surface: a full-screen sheet on mobile, a centered dialog on
 * desktop. Headless UI's Dialog provides the focus trap, ESC-to-close, body
 * scroll lock, and focus return to the trigger -- so the WCAG behaviour is free.
 */
export default function ChatOverlay({
  open,
  onClose,
  candidateSlug,
  candidateName,
  suggestedQuestions,
  seed,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[var(--z-modal)]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[var(--rb-scrim)] backdrop-blur-sm transition duration-[var(--duration-base)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex justify-center sm:items-center sm:p-6">
        <DialogPanel
          transition
          className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--rb-bg-surface)] shadow-[var(--shadow-modal)] transition duration-[var(--duration-base)] ease-[var(--ease-spring)] data-[closed]:translate-y-3 data-[closed]:opacity-0 sm:h-[min(82vh,640px)] sm:max-w-lg sm:rounded-[var(--radius-2xl)] sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95"
        >
          <ChatPanel
            candidateSlug={candidateSlug}
            candidateName={candidateName}
            mode="live"
            fill
            autoFocus
            onClose={onClose}
            suggestedQuestions={suggestedQuestions}
            externalQuestion={seed}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}
