'use client';

import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function SignOutButton({ className, label = 'Sign out' }: { className?: string; label?: string }) {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => signOut(() => router.push('/'))}
      className={
        className ??
        'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--rb-brand)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--rb-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-border-focus)] focus-visible:ring-offset-2'
      }
    >
      {label}
    </button>
  );
}
