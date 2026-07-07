import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

// Audit-trail writer for privileged superadmin actions. Writes go through the
// service-role client (admin_audit_log has no INSERT policy by design). Logging is
// best-effort: a failed write is logged but never blocks the action, an admin
// should not be locked out because the audit table hiccupped.

export type AdminAction =
  | 'impersonate.start'
  | 'impersonate.stop'
  | 'admin.grant'
  | 'admin.revoke'
  | 'user.suspend'
  | 'user.unsuspend'
  | 'user.delete';

export async function logAdminAction(params: {
  actorUserId: string;
  action: AdminAction;
  targetUserId?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await (getAdminClient().from('admin_audit_log') as any).insert({
    actor_clerk_user_id: params.actorUserId,
    action: params.action,
    target_clerk_user_id: params.targetUserId ?? null,
    context: params.context ?? {},
  });
  if (error) {
    console.error('logAdminAction: failed to record', params.action, error);
  }
}
