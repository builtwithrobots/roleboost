'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { ShieldAlert, Command, LogOut } from 'lucide-react';
import { exitAdminSession } from '@/lib/auth/admin-actions';
import AdminCommandPalette from '@/components/admin/AdminCommandPalette';

type Props = {
  previewRole: 'candidate' | 'employer' | null;
  impersonating: { email: string | null; role: string } | null;
};

// The persistent superadmin operator strip. Rendered inside the candidate/employer
// dashboard shells whenever an admin is previewing or impersonating, so they always
// know they are in god-mode and can act or exit from anywhere. Deliberately navy
// (the brand's authority color) to read as a distinct control layer over the warm
// product surfaces, per the design system.
export default function AdminCommandBar({ previewRole, impersonating }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toolsBtnRef = useRef<HTMLButtonElement>(null);

  function closePalette() {
    setPaletteOpen(false);
    toolsBtnRef.current?.focus();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function exit() {
    startTransition(async () => {
      await exitAdminSession();
    });
  }

  const status = impersonating ? (
    <>
      Impersonating <strong className="font-semibold">{impersonating.email ?? 'user'}</strong>
      <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
        read-only
      </span>
    </>
  ) : (
    <>
      Previewing dashboard as <strong className="font-semibold">{previewRole}</strong>
      <span className="ml-2 text-[12px] text-slate-400">your own data</span>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-[60] flex items-center gap-3 bg-[#1E3A5F] px-4 py-2 text-sm text-slate-100">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-amber-400" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">{status}</span>
        </span>

        <button
          ref={toolsBtnRef}
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Command className="size-3.5" strokeWidth={2} aria-hidden="true" />
          Tools
          <kbd className="ml-1 hidden rounded border border-white/15 px-1 font-mono text-[10px] text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={exit}
          disabled={pending}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[13px] font-semibold text-[#1E3A5F] hover:bg-amber-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F]"
        >
          <LogOut className="size-3.5" strokeWidth={2} aria-hidden="true" />
          Exit
        </button>
      </div>

      {paletteOpen && (
        <AdminCommandPalette
          onClose={closePalette}
          activeSession={!!(previewRole || impersonating)}
        />
      )}
    </>
  );
}
