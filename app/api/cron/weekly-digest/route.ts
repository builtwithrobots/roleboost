import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { guardCron } from '@/lib/cron/guard';
import { isEmailConfigured } from '@/lib/email/client';
import { sendWeeklyDigestEmail } from '@/lib/email/digest';
import { checkAppRateLimit } from '@/lib/security/rate-limit';

// Weekly re-engagement digest. For each candidate who saw real recruiter
// activity in the last 7 days, emails a small summary: profile views,
// conversations their AI held, and questions it fielded, with a link back into
// the dashboard. Candidates with zero activity are skipped, so the email is a
// signal, never noise.
//
// Aggregation runs in-process over three capped scans (views, sessions,
// messages) rather than a SQL GROUP BY, to stay inside the untyped service-role
// client the rest of the pipeline uses. Send is idempotent per candidate per
// ~week via a rate-limit key, so a Vercel cron retry cannot double-send.
//
// Secured by CRON_SECRET via guardCron (no secret -> harmless no-op).
export const runtime = 'nodejs';
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_LIMIT = 5000;
// Once per candidate per week; window sits just under 7 days so the next weekly
// run is never blocked by the previous one, but same-day retries are.
const ONCE_WINDOW_SECONDS = 6 * 24 * 60 * 60;

export async function GET(req: NextRequest) {
  const guard = guardCron(req);
  if (!guard.ok) return guard.response;

  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'email_not_configured' });
  }

  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

  // 1) Views per candidate.
  const viewsByCandidate = new Map<string, number>();
  const { data: views } = await (adminClient.from('profile_views') as any)
    .select('candidate_profile_id')
    .gte('viewed_at', since)
    .limit(SCAN_LIMIT);
  for (const v of (views ?? []) as Array<{ candidate_profile_id: string }>) {
    viewsByCandidate.set(v.candidate_profile_id, (viewsByCandidate.get(v.candidate_profile_id) ?? 0) + 1);
  }

  // 2) Conversations per candidate, plus a session -> candidate map for step 3.
  //    Sandbox self-tests are excluded so a candidate's own testing never inflates
  //    their numbers.
  const conversationsByCandidate = new Map<string, number>();
  const sessionToCandidate = new Map<string, string>();
  const { data: sessions } = await (adminClient.from('chat_sessions') as any)
    .select('id, candidate_profile_id, is_sandbox')
    .gte('started_at', since)
    .limit(SCAN_LIMIT);
  for (const s of (sessions ?? []) as Array<{ id: string; candidate_profile_id: string; is_sandbox: boolean }>) {
    if (s.is_sandbox) continue;
    sessionToCandidate.set(s.id, s.candidate_profile_id);
    conversationsByCandidate.set(
      s.candidate_profile_id,
      (conversationsByCandidate.get(s.candidate_profile_id) ?? 0) + 1,
    );
  }

  // 3) Recruiter questions per candidate (user-role messages in this week's sessions).
  const questionsByCandidate = new Map<string, number>();
  if (sessionToCandidate.size > 0) {
    const { data: msgs } = await (adminClient.from('chat_messages') as any)
      .select('chat_session_id')
      .eq('role', 'user')
      .gte('created_at', since)
      .limit(SCAN_LIMIT);
    for (const m of (msgs ?? []) as Array<{ chat_session_id: string }>) {
      const cand = sessionToCandidate.get(m.chat_session_id);
      if (!cand) continue;
      questionsByCandidate.set(cand, (questionsByCandidate.get(cand) ?? 0) + 1);
    }
  }

  // Union of candidates with any activity this week.
  const active = new Set<string>([
    ...viewsByCandidate.keys(),
    ...conversationsByCandidate.keys(),
  ]);
  if (active.size === 0) return NextResponse.json({ ok: true, active: 0, sent: 0 });

  // Resolve profiles + emails in bulk.
  const ids = [...active];
  const { data: profiles } = await (adminClient.from('candidate_profiles') as any)
    .select('id, full_name, clerk_user_id')
    .in('id', ids);
  const profileRows = (profiles ?? []) as Array<{ id: string; full_name: string; clerk_user_id: string }>;

  const clerkIds = profileRows.map((p) => p.clerk_user_id);
  const emailByClerkId = new Map<string, string>();
  if (clerkIds.length > 0) {
    const { data: usersRows } = await (adminClient.from('users') as any)
      .select('clerk_user_id, email')
      .in('clerk_user_id', clerkIds);
    for (const u of (usersRows ?? []) as Array<{ clerk_user_id: string; email: string }>) {
      if (u.email) emailByClerkId.set(u.clerk_user_id, u.email);
    }
  }

  let sent = 0;
  for (const p of profileRows) {
    const email = emailByClerkId.get(p.clerk_user_id);
    if (!email) continue;

    const firstTime = await checkAppRateLimit(
      `weekly-digest:${p.clerk_user_id}`,
      1,
      ONCE_WINDOW_SECONDS,
    );
    if (!firstTime) continue;

    try {
      await sendWeeklyDigestEmail({
        candidateName: p.full_name,
        candidateEmail: email,
        views: viewsByCandidate.get(p.id) ?? 0,
        conversations: conversationsByCandidate.get(p.id) ?? 0,
        questions: questionsByCandidate.get(p.id) ?? 0,
        analyticsUrl: `${appUrl}/dashboard/analytics`,
        studioUrl: `${appUrl}/dashboard/ai`,
      });
      sent += 1;
    } catch (e) {
      console.error('cron/weekly-digest: send failed', p.clerk_user_id, e);
    }
  }

  return NextResponse.json({ ok: true, active: active.size, sent });
}
