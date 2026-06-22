'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { UserRound, Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { setUserRole } from './actions';

type Role = 'candidate' | 'employer';

const ROLES: {
  role: Role;
  Icon: typeof UserRound;
  title: string;
  blurb: string;
}[] = [
  {
    role: 'candidate',
    Icon: UserRound,
    title: "I'm looking for my next role",
    blurb: 'Build your AI-powered career profile and share one link that tells your whole story.',
  },
  {
    role: 'employer',
    Icon: Briefcase,
    title: "I'm hiring for my team",
    blurb: 'Save candidates, chat with their career AI, and move the right people forward faster.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (role: Role) => {
    setError(null);
    setPendingRole(role);
    startTransition(async () => {
      const result = await setUserRole(role);
      if (result.ok) {
        router.push(role === 'candidate' ? '/dashboard/profile' : '/dashboard/candidates');
      } else {
        setError('Something went wrong. Please try again.');
        setPendingRole(null);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rb-bg-page)] px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--rb-brand)] text-white shadow-sm">
            <span className="font-display text-base font-extrabold leading-none">R</span>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-[var(--rb-text)]">
            Welcome to RoleBoost
          </h1>
          <p className="mt-2 text-sm text-[var(--rb-text-secondary)]">
            Tell us how you&apos;ll use RoleBoost so we can set up the right experience.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROLES.map(({ role, Icon, title, blurb }) => {
            const loading = isPending && pendingRole === role;
            return (
              <button
                key={role}
                onClick={() => handleSelect(role)}
                disabled={isPending}
                aria-busy={loading}
                className="group relative flex flex-col rounded-[var(--radius-2xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6 text-left shadow-[var(--shadow-card)] transition-all duration-[var(--duration-base)] hover:-translate-y-0.5 hover:border-[var(--rb-border-brand)] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-border-focus)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex size-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rb-brand-subtle)] ring-1 ring-[var(--rb-border-brand)]/50">
                  <Icon className="size-5 text-[var(--rb-brand)]" strokeWidth={1.5} />
                </span>
                <span className="mt-4 font-display text-base font-bold text-[var(--rb-text)]">
                  {title}
                </span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--rb-text-secondary)]">
                  {blurb}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--rb-text-brand)]">
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-6 text-center text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-[var(--rb-text-muted)]">
          You can&apos;t change this later, so pick the one that fits you best.
        </p>
      </div>
    </div>
  );
}
