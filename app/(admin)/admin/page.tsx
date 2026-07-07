import { redirect } from 'next/navigation';
import { getUserContext, AuthError, getAdminPreviewRole } from '@/lib/auth/user-context';
import { setAdminPreviewRole, impersonateUser, setUserAdmin } from '@/lib/auth/admin-actions';
import { getAdminClient } from '@/lib/supabase/admin';
import AdminPaletteLauncher from '@/components/admin/AdminPaletteLauncher';

type AdminUserRow = {
  clerk_user_id: string;
  email: string;
  role: string;
  is_admin: boolean;
  subscription_tier: string | null;
  subscription_status: string;
  created_at: string;
};

export default async function AdminPage() {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHENTICATED') redirect('/sign-in');
    throw e;
  }

  if (!ctx.isAdmin) redirect('/');

  const previewRole = await getAdminPreviewRole();

  const { data } = await getAdminClient()
    .from('users')
    .select('clerk_user_id, email, role, is_admin, subscription_tier, subscription_status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const users = (data ?? []) as AdminUserRow[];

  async function exitPreview() {
    'use server';
    await setAdminPreviewRole('none');
  }

  async function previewAsCandidate() {
    'use server';
    await setAdminPreviewRole('candidate');
  }

  async function previewAsEmployer() {
    'use server';
    await setAdminPreviewRole('employer');
  }

  async function impersonate(formData: FormData) {
    'use server';
    await impersonateUser(formData.get('clerk_user_id') as string);
  }

  async function toggleAdmin(formData: FormData) {
    'use server';
    await setUserAdmin(
      formData.get('clerk_user_id') as string,
      formData.get('make') === 'true',
    );
  }

  return (
    <div className="min-h-screen bg-[var(--rb-bg-page)] p-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--rb-text-primary)]">
              Super Admin
            </h1>
            <p className="mt-1 text-sm text-[var(--rb-text-muted)]">
              Signed in as {ctx.userId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AdminPaletteLauncher activeSession={!!previewRole} />
            {previewRole && (
              <form action={exitPreview}>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
                >
                  Exit preview: {previewRole}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Role Switcher */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-card)] p-6">
          <h2 className="mb-1 font-display text-base font-semibold text-[var(--rb-text-primary)]">
            Preview Dashboard As
          </h2>
          <p className="mb-5 text-sm text-[var(--rb-text-muted)]">
            Switch into a role to experience the dashboard exactly as that user type sees it.
            Your admin session is preserved, exit any time via the banner at the top.
          </p>
          <div className="flex gap-4">
            <form action={previewAsCandidate}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--rb-brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--rb-brand-hover)] transition-colors"
              >
                View as Candidate
              </button>
            </form>
            <form action={previewAsEmployer}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--rb-border)] bg-[var(--rb-bg-card)] px-5 py-2.5 text-sm font-semibold text-[var(--rb-text-primary)] hover:bg-[var(--rb-bg-subtle)] transition-colors"
              >
                View as Employer
              </button>
            </form>
          </div>
          {previewRole && (
            <p className="mt-4 text-sm text-amber-700">
              Currently previewing: <strong>{previewRole}</strong>
            </p>
          )}
        </section>

        {/* Users Table */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-card)]">
          <div className="border-b border-[var(--rb-border)] px-6 py-4">
            <h2 className="font-display text-base font-semibold text-[var(--rb-text-primary)]">
              All Users ({users.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-subtle)]">
                  <th className="px-6 py-3 text-left font-medium text-[var(--rb-text-muted)]">Email</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--rb-text-muted)]">Role</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--rb-text-muted)]">Tier</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--rb-text-muted)]">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--rb-text-muted)]">Joined</th>
                  <th className="px-6 py-3 text-right font-medium text-[var(--rb-text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rb-border)]">
                {users.map((u) => (
                  <tr key={u.clerk_user_id} className="hover:bg-[var(--rb-bg-subtle)]">
                    <td className="px-6 py-3 text-[var(--rb-text-primary)]">
                      {u.email}
                      {u.is_admin && (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--rb-text-secondary)]">{u.role}</td>
                    <td className="px-6 py-3 text-[var(--rb-text-secondary)]">{u.subscription_tier ?? 'free'}</td>
                    <td className="px-6 py-3 text-[var(--rb-text-secondary)]">{u.subscription_status}</td>
                    <td className="px-6 py-3 text-[var(--rb-text-muted)]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {(u.role === 'candidate' || u.role === 'employer') && u.clerk_user_id !== ctx.userId && (
                          <form action={impersonate}>
                            <input type="hidden" name="clerk_user_id" value={u.clerk_user_id} />
                            <button
                              type="submit"
                              className="rounded-md border border-[var(--rb-border)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-primary)] hover:bg-[var(--rb-bg-subtle)]"
                              title="View this user's dashboard, read-only"
                            >
                              Impersonate
                            </button>
                          </form>
                        )}
                        {u.clerk_user_id !== ctx.userId && (
                          <form action={toggleAdmin}>
                            <input type="hidden" name="clerk_user_id" value={u.clerk_user_id} />
                            <input type="hidden" name="make" value={(!u.is_admin).toString()} />
                            <button
                              type="submit"
                              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] hover:bg-[var(--rb-bg-subtle)]"
                            >
                              {u.is_admin ? 'Revoke admin' : 'Grant admin'}
                            </button>
                          </form>
                        )}
                        {u.clerk_user_id === ctx.userId && (
                          <span className="text-xs text-[var(--rb-text-muted)]">you</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[var(--rb-text-muted)]">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Admin provisioning note */}
        <section className="rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-card)] p-6">
          <h2 className="mb-2 font-display text-base font-semibold text-[var(--rb-text-primary)]">
            How admin access is granted
          </h2>
          <p className="text-sm text-[var(--rb-text-secondary)]">
            The first admin is bootstrapped from the{' '}
            <code className="rounded bg-[var(--rb-bg-subtle)] px-1 font-mono text-xs">SUPERADMIN_EMAILS</code>{' '}
            environment variable (comma-separated). Any user whose email is on that list is promoted
            to admin the first time they sign in. After that, grant or revoke admin for anyone from the
            table above; every grant, revoke, and impersonation is written to the audit log. You cannot
            revoke your own access.
          </p>
        </section>

        {/* Webhook Setup Instructions */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-2 font-display text-base font-semibold text-amber-900">
            Clerk Webhook Setup
          </h2>
          <p className="mb-3 text-sm text-amber-800">
            Configure the Clerk webhook to sync user creation and deletion to Supabase.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-800">
            <li>Go to Clerk Dashboard → Webhooks → Add Endpoint</li>
            <li>
              Set URL to:{' '}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/clerk
              </code>
            </li>
            <li>
              Subscribe to events:{' '}
              <code className="font-mono text-xs">user.created</code>,{' '}
              <code className="font-mono text-xs">user.deleted</code>
            </li>
            <li>
              Copy the signing secret and set it as{' '}
              <code className="font-mono text-xs">CLERK_WEBHOOK_SECRET</code> in Vercel env vars
            </li>
          </ol>
        </section>

      </div>
    </div>
  );
}
