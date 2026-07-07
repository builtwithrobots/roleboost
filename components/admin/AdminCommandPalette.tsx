'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Eye, LayoutDashboard, LogOut, ShieldCheck, Shield, CornerDownLeft } from 'lucide-react';
import {
  impersonateUser,
  setAdminPreviewRole,
  exitAdminSession,
  setUserAdmin,
  searchAdminUsers,
  type AdminUserResult,
} from '@/lib/auth/admin-actions';

type QuickAction = {
  id: string;
  label: string;
  hint: string;
  Icon: typeof Eye;
  run: () => void;
};

// Mounted only while open (the parent conditionally renders it), so each open gets a
// fresh instance, no reset-on-open effect needed. The parent restores focus to its
// trigger when this unmounts.
export default function AdminCommandPalette({
  onClose,
  activeSession,
}: {
  onClose: () => void;
  activeSession: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search field on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // Debounced user search (setState happens in the async timeout callback, not
  // synchronously in the effect body).
  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchAdminUsers(query);
        setUsers(rows);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [query]);

  const close = useCallback(() => onClose(), [onClose]);

  const quickActions: QuickAction[] = [
    {
      id: 'admin-home',
      label: 'Open Admin control center',
      hint: '/admin',
      Icon: LayoutDashboard,
      run: () => {
        close();
        router.push('/admin');
      },
    },
    {
      id: 'preview-candidate',
      label: 'Preview as Candidate',
      hint: 'your own data',
      Icon: Eye,
      run: () => startTransition(() => void setAdminPreviewRole('candidate')),
    },
    {
      id: 'preview-employer',
      label: 'Preview as Employer',
      hint: 'your own data',
      Icon: Eye,
      run: () => startTransition(() => void setAdminPreviewRole('employer')),
    },
  ];

  if (activeSession) {
    quickActions.push({
      id: 'exit-session',
      label: 'Exit preview / impersonation',
      hint: 'back to /admin',
      Icon: LogOut,
      run: () => startTransition(() => void exitAdminSession()),
    });
  }

  const q = query.trim().toLowerCase();
  const filteredActions = q
    ? quickActions.filter((a) => a.label.toLowerCase().includes(q))
    : quickActions;

  // Flat, keyboard-navigable list: quick actions first, then user rows.
  const rowCount = filteredActions.length + users.length;

  function activate(index: number) {
    if (index < filteredActions.length) {
      filteredActions[index].run();
      return;
    }
    const user = users[index - filteredActions.length];
    if (user) {
      startTransition(() => void impersonateUser(user.clerk_user_id));
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => (rowCount ? (s + 1) % rowCount : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => (rowCount ? (s - 1 + rowCount) % rowCount : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(selected);
    }
  }

  function toggleAdmin(user: AdminUserResult) {
    startTransition(async () => {
      await setUserAdmin(user.clerk_user_id, !user.is_admin);
      const rows = await searchAdminUsers(query);
      setUsers(rows);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Superadmin command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-[rgb(7_11_20/0.55)] backdrop-blur-sm"
        onClick={close}
      />

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0F1B2D] text-slate-100 shadow-2xl"
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="size-5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Search users by email, or jump to a tool…"
            aria-label="Search users or tools"
            className="min-h-[52px] w-full bg-transparent py-3 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {/* Quick actions */}
          {filteredActions.length > 0 && (
            <div className="px-2">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tools
              </p>
              {filteredActions.map((a, i) => (
                <PaletteRow
                  key={a.id}
                  active={selected === i}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => activate(i)}
                >
                  <a.Icon className="size-4 shrink-0 text-amber-400" strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex-1 text-[14px]">{a.label}</span>
                  <span className="text-[12px] text-slate-500">{a.hint}</span>
                </PaletteRow>
              ))}
            </div>
          )}

          {/* User results */}
          <div className="px-2">
            <p className="flex items-center justify-between px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Users</span>
              {pending && <span className="text-slate-600">searching…</span>}
            </p>
            {users.length === 0 && !pending && (
              <p className="px-3 py-4 text-[13px] text-slate-500">No users match “{query}”.</p>
            )}
            {users.map((u, i) => {
              const index = filteredActions.length + i;
              return (
                <PaletteRow
                  key={u.clerk_user_id}
                  active={selected === index}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => activate(index)}
                >
                  <User className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex-1 truncate text-[14px]">
                    {u.email ?? u.clerk_user_id}
                    <span className="ml-2 text-[12px] text-slate-500">{u.role ?? 'no role'}</span>
                    {u.is_admin && (
                      <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        admin
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAdmin(u);
                    }}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label={u.is_admin ? `Revoke admin from ${u.email}` : `Grant admin to ${u.email}`}
                    title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                  >
                    {u.is_admin ? (
                      <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Shield className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>
                  <CornerDownLeft className="size-3.5 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden="true" />
                </PaletteRow>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> impersonate (read-only)</span>
          <span className="ml-auto flex items-center gap-1 text-slate-600">
            <Shield className="size-3" strokeWidth={2} aria-hidden="true" /> superadmin
          </span>
        </div>
      </div>
    </div>
  );
}

function PaletteRow({
  active,
  children,
  onClick,
  onMouseEnter,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
