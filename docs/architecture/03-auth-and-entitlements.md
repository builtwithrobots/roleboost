# 03 — Auth & Entitlements

## Clerk = authentication only

Clerk verifies who the user is and issues a JWT whose `sub` claim is the
`clerk_user_id`. Everything about *what they can do* (role, ownership,
subscription) lives in Supabase. **Never trust a client-side role claim**, and
never store role in Clerk metadata.

User rows are created by the Clerk webhook (`app/api/webhooks/clerk/route.ts`,
Svix-verified): `user.created` upserts a `users` row with `role = NULL` and
`subscription_status = 'free'` (`ignoreDuplicates: true`, so re-fires never reset
role/subscription); `user.updated` syncs email; `user.deleted` deletes the row
(CASCADE cleans up all child data). Role is set later in onboarding
(`app/(auth)/onboarding/actions.ts` → `setUserRole`), which refuses to reassign an
existing role.

## `getUserContext` — the gate every server entry point uses

`lib/auth/user-context.ts`:

```ts
const { userId, supabase, role, isAdmin, user } = await getUserContext('candidate');
```

1. `auth()` → Clerk `userId`; missing → `AuthError('UNAUTHENTICATED')`.
2. Look up the `users` row with the **admin client** (this one bootstrap read
   happens before we have a role-scoped client; it filters by `clerk_user_id`,
   equivalent to what RLS would enforce).
3. No row → `AuthError('NO_USER')`; null role (not onboarded) →
   `AuthError('NO_ROLE')`.
4. **Admin preview:** if `is_admin` and the `rb-admin-preview-role` cookie is set,
   the effective role becomes the previewed one (admins can walk both dashboards).
5. If a `requiredRole` was passed and doesn't match → `AuthError('FORBIDDEN')`.
6. Returns the **request-scoped RLS client** (`getRequestClient()`) plus role and
   the user record (which carries `is_admin`, `subscription_status`,
   `subscription_tier`).

`AuthError` codes map to HTTP/error-envelope codes — see
[10 — Conventions](./10-conventions-and-ops.md).

## The three Supabase clients — one purpose each

`lib/supabase/`:

| Client | File | RLS | Use it for |
|---|---|---|---|
| `getRequestClient()` | `server.ts` | **Enforced** (forwards the Clerk JWT as Bearer) | Default. Every API route, Server Action, Server Component read/write. |
| `adminClient` | `admin.ts` | **Bypassed** (service role) | Only where RLS bypass is genuinely required: the `getUserContext` bootstrap read, webhooks, the public chat path (anonymous recruiters), server-side signed-URL generation, transcript delivery. Every import carries a comment explaining why. |
| `getBrowserClient()` | `browser.ts` | Anon role | `"use client"` reads of public data (calling-card profile fields, view tracking). |

Hard rules: `SUPABASE_SERVICE_ROLE_KEY` is read **only** in `admin.ts`; never
import `admin.ts` from anything that can reach the browser bundle; treat every
admin-client use as security-review-worthy.

Why the chat path uses the admin client: recruiters are anonymous (no Clerk JWT),
and the brain spans columns the anon role can't read. `getCandidateBrainBySlug`
therefore reads server-side via the service-role client and the route enforces
visibility itself (`is_published` or owner-preview). See
[07 — Chat](./07-chat-and-transcripts.md).

## Entitlements — the AI-access seam

`lib/auth/entitlements.ts` is the **single** place that decides whether a
candidate may use AI Studio, generate/augment a context document, and (eventually)
use the live chatbot.

```ts
assertCandidateAiAccess(user);   // throws EntitlementError('PAYMENT_REQUIRED') when not entitled
candidateHasAiAccess(user);      // boolean
```

Today it is **open to all candidates during rollout** (`BILLING_ENFORCED =
false`). The real check is already written — admin or
`subscription_status === 'active'` — and gated behind that flag. When candidate
subscriptions/trials ship, flipping `BILLING_ENFORCED` to `true` activates the
paywall with **no caller changes**.

This is the deliberate decoupling that let the Career Context Document feature ship
ahead of billing. The planned billing workstream ("PR 4") will: add candidate
Paddle products + trial-clock state, gate the public chat/AI Studio on entitlement,
and flip the flag. `EntitlementError` maps to HTTP **402 / `PAYMENT_REQUIRED`**.

Routes that already call the seam: `/api/career-context/generate`,
`/api/career-context/augment`, and the `selectCareerContextAngle` server action.
