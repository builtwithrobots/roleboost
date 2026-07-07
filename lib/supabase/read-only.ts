import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Read-only client wrapper ──────────────────────────────────────────────────
//
// Superadmin impersonation is deliberately READ-ONLY for v1: an admin can view any
// user's dashboard, but never write on their behalf. We enforce that by construction
// rather than by trusting every downstream server action to check a flag. This Proxy
// wraps the service-role admin client (which bypasses RLS so cross-user reads work)
// and throws on any mutating call, so a stray insert/update/delete/upsert/rpc during
// an impersonation session fails loudly instead of silently mutating a real user's data.

export class ImpersonationWriteError extends Error {
  constructor(op: string) {
    super(
      `Blocked "${op}" during read-only impersonation. Exit impersonation before making changes.`,
    );
    this.name = 'ImpersonationWriteError';
  }
}

const BLOCKED_BUILDER_METHODS = new Set(['insert', 'update', 'delete', 'upsert']);

/**
 * Wrap a Supabase client so that only reads are allowed. `.from(table).select()...`
 * passes through; `.from(table).insert/update/delete/upsert(...)` and top-level
 * `.rpc(...)` throw ImpersonationWriteError.
 */
export function createReadOnlyClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        return () => {
          throw new ImpersonationWriteError('rpc');
        };
      }

      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table);
          return new Proxy(builder, {
            get(b, p) {
              if (typeof p === 'string' && BLOCKED_BUILDER_METHODS.has(p)) {
                return () => {
                  throw new ImpersonationWriteError(p);
                };
              }
              const value = Reflect.get(b, p);
              return typeof value === 'function' ? value.bind(b) : value;
            },
          });
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as SupabaseClient;
}
