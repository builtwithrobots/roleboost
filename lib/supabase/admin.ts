import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS. Reserved for migrations and webhooks only.
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
