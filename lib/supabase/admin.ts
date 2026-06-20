import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS. Reserved for migrations and webhooks only.
// Lazily initialised to avoid module-load errors when env vars are absent during build.
let _adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase admin env vars not set');
    _adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

// Convenience alias — same lazy getter, backward-compatible name for any existing imports.
export const adminClient = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getAdminClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
