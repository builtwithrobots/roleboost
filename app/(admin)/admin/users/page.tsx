import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { impersonateUser, setUserAdmin } from '@/lib/auth/admin-actions';
import { getAdminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

type AdminUserRow = {
  clerk_user_id: string;
  email: string;
  role: string | null;
  is_admin: boolean;
  subscription_tier: string | null;
  subscription_status: string;
  created_at: string;
};

export default async function AdminUsersPage() {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHENTICATED') redirect('/sign-in');
    throw e;
  }

  if (!ctx.isAdmin) redirect('/');

  const { data } = await getAdminClient()
    .from('users')
    .select('clerk_user_id, email, role, is_admin, subscription_tier, subscription_status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const users = (data ?? []) as AdminUserRow[];

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
    <DashboardPage>
      <PageHeader
        eyebrow="Superadmin"
        title="Users"
        description={`${users.length} most recent. Impersonate is read-only; you cannot revoke your own admin.`}
      />

      <div className="mx-auto max-w-6xl px-6 py-6">
        <section className="overflow-hidden rounded-xl border border-[var(--rb-border)] bg-[var(--rb-bg-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)]">
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
                  <tr key={u.clerk_user_id} className="hover:bg-[var(--rb-bg-surface-raised)]">
                    <td className="px-6 py-3 text-[var(--rb-text)]">
                      {u.email}
                      {u.is_admin && (
                        <span className="ml-2 rounded-full bg-[var(--rb-brand-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--rb-text-brand)]">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--rb-text-secondary)]">{u.role ?? '—'}</td>
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
                              className="rounded-md border border-[var(--rb-border)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text)] hover:bg-[var(--rb-bg-surface-raised)]"
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
                              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] hover:bg-[var(--rb-bg-surface-raised)]"
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
      </div>
    </DashboardPage>
  );
}
