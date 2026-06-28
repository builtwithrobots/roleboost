import 'server-only';
import { Resend } from 'resend';

// Resend client, server-only. Lazily initialised so a missing RESEND_API_KEY
// doesn't crash the build (matches lib/ai/client.ts and lib/supabase/admin.ts).
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

/** Whether email sending is configured. When false, callers no-op gracefully. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
