import 'server-only';
import type { SubscriptionStatus } from '@/lib/types';

// Entitlement seam for the candidate AI Studio.
//
// The product direction is that AI Studio (chatbot + context generation) becomes
// a paid candidate component with a free trial -- a departure from the original
// "candidates always free" decision. The billing/trial system (candidate Paddle
// products, trial clock, gating the public chat) is a separate workstream.
//
// This file is the single place that decides candidate AI access. Until billing
// ships, BILLING_ENFORCED is false and access is open to all candidates during
// rollout. When subscriptions/trials land, flip the flag and the real check below
// takes over -- no caller changes needed.

export class EntitlementError extends Error {
  constructor(public code: 'PAYMENT_REQUIRED' = 'PAYMENT_REQUIRED') {
    super(code);
  }
}

interface AccessUser {
  is_admin: boolean;
  subscription_status: SubscriptionStatus;
}

// Typed as boolean (not the literal `false`) so the real check below is not
// flagged as unreachable while the flag is off. Flip to true in the billing PR.
const BILLING_ENFORCED: boolean = false;

/** Whether a candidate may use AI Studio + context generation + the live chatbot. */
export function candidateHasAiAccess(user: AccessUser): boolean {
  if (!BILLING_ENFORCED) return true;
  if (user.is_admin) return true;
  return user.subscription_status === 'active';
}

/** Throws EntitlementError('PAYMENT_REQUIRED') when the candidate lacks access. */
export function assertCandidateAiAccess(user: AccessUser): void {
  if (!candidateHasAiAccess(user)) throw new EntitlementError();
}
