'use client';

import { useEffect, useRef, useState } from 'react';
import { Command } from 'lucide-react';
import AdminCommandPalette from '@/components/admin/AdminCommandPalette';

// A ⌘K launcher for the /admin control center, so the command palette is reachable
// from the admin's home base, not only while previewing/impersonating a dashboard.
export default function AdminPaletteLauncher({ activeSession }: { activeSession: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
      >
        <Command className="size-4" strokeWidth={2} aria-hidden="true" />
        Command palette
        <kbd className="ml-1 hidden rounded border border-white/25 px-1.5 font-mono text-[11px] text-slate-200 sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && <AdminCommandPalette onClose={close} activeSession={activeSession} />}
    </>
  );
}
