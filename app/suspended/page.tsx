import { ShieldAlert } from 'lucide-react';
import SignOutButton from '@/components/layout/SignOutButton';

// Shown to a suspended user. Deliberately does NOT call getUserContext (which would
// throw SUSPENDED and loop), it is a plain terminal page with a sign-out.
export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--rb-bg-page)] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
          <ShieldAlert className="size-6 text-[var(--rb-text-brand)]" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-xl font-bold text-[var(--rb-text)]">
          Your account is suspended
        </h1>
        <p className="mt-2 text-sm text-[var(--rb-text-secondary)]">
          Access to RoleBoost has been paused for this account. If you think this is a mistake, reach
          out to support and we&apos;ll take a look.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
