import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserContext, AuthError, getAdminPreviewRole } from '@/lib/auth/user-context';
import { setAdminPreviewRole } from '@/lib/auth/admin-actions';
import { getAdminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHENTICATED') redirect('/sign-in');
    throw e;
  }

  if (!ctx.isAdmin) redirect('/');

  const previewRole = await getAdminPreviewRole();
  const admin = getAdminClient();

  // Platform counts for the header stat row. head:true keeps these to cheap
  // count-only queries.
  const [totalRes, candidateRes, employerRes, adminRes] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'candidate'),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('is_admin', true),
  ]);

  const stats = [
    { label: 'Total users', value: totalRes.count ?? 0 },
    { label: 'Candidates', value: candidateRes.count ?? 0 },
    { label: 'Employers', value: employerRes.count ?? 0 },
    { label: 'Admins', value: adminRes.count ?? 0 },
  ];

  async function previewAsCandidate() {
    'use server';
    await setAdminPreviewRole('candidate');
  }

  async function previewAsEmployer() {
    'use server';
    await setAdminPreviewRole('employer');
  }

  async function exitPreview() {
    'use server';
    await setAdminPreviewRole('none');
  }

  return (
    <DashboardPage>
      <PageHeader
        eyebrow="Superadmin"
        title="Overview"
        description="Platform control center. Search or impersonate any user from the command palette (⌘K)."
      />

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {/* Stat row */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-5"
            >
              <p className="text-sm text-[var(--rb-text-secondary)]">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-[var(--rb-text)]">{s.value}</p>
            </div>
          ))}
        </section>

        {/* Preview dashboards */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--rb-text)]">
                Preview a dashboard
              </h2>
              <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                Step into the candidate or employer dashboard with your own data. Exit any time from
                the banner at the top. To view a specific user&apos;s real data, impersonate them from
                the command palette (read-only).
              </p>
            </div>
            {previewRole && (
              <form action={exitPreview}>
                <button
                  type="submit"
                  className="min-h-[44px] shrink-0 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
                >
                  Exit preview: {previewRole}
                </button>
              </form>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <form action={previewAsCandidate}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--rb-brand-hover)] transition-colors"
              >
                View as Candidate
              </button>
            </form>
            <form action={previewAsEmployer}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--rb-text)] hover:bg-[var(--rb-bg-surface-raised)] transition-colors"
              >
                View as Employer
              </button>
            </form>
          </div>
        </section>

        {/* Users shortcut */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--rb-text)]">Users</h2>
              <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
                Search, impersonate, and grant or revoke admin access.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--rb-border)] px-4 py-2 text-sm font-semibold text-[var(--rb-text)] hover:bg-[var(--rb-bg-surface-raised)]"
            >
              Manage users
            </Link>
          </div>
        </section>

        {/* Admin provisioning note */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6">
          <h2 className="mb-2 font-display text-base font-semibold text-[var(--rb-text)]">
            How admin access is granted
          </h2>
          <p className="text-sm text-[var(--rb-text-secondary)]">
            The first admin is bootstrapped from the{' '}
            <code className="rounded bg-[var(--rb-bg-surface-sunken)] px-1 font-mono text-xs">
              SUPERADMIN_EMAILS
            </code>{' '}
            environment variable (comma-separated). Any user whose email is on that list is promoted
            to admin the first time they sign in. After that, grant or revoke admin for anyone from the
            Users page; every grant, revoke, and impersonation is written to the audit log. You cannot
            revoke your own access.
          </p>
        </section>
      </div>
    </DashboardPage>
  );
}
