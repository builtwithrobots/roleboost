import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { guardCron } from '@/lib/cron/guard';
import { isEmailConfigured } from '@/lib/email/client';
import { sendMeetingReminderEmail } from '@/lib/email/meeting-reminder';
import { checkAppRateLimit } from '@/lib/security/rate-limit';

// Nudges candidates about live-meeting requests still sitting in "new" a couple
// of days after a recruiter submitted them. A meeting request is the highest
// intent a recruiter can express on the platform, so a silently dropped one is a
// lost hire. The initial request already emailed the candidate (see
// /api/chat/schedule); this is the single follow-up for the ones that stall.
//
// Window: requests 2 to 14 days old and still 'new'. Younger than 2 days we
// leave alone (they just arrived); older than 14 days we stop chasing. Exactly
// one reminder per request is enforced with a 30-day idempotency key on the
// shared rate-limit table, so repeated cron passes never double-send.
//
// Secured by CRON_SECRET via guardCron (no secret -> harmless no-op).
export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_AGE_DAYS = 2;
const MAX_AGE_DAYS = 14;
const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
// One reminder per request, ever (the window comfortably outlives MAX_AGE_DAYS).
const ONCE_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export async function GET(req: NextRequest) {
  const guard = guardCron(req);
  if (!guard.ok) return guard.response;

  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'email_not_configured' });
  }

  const now = Date.now();
  const newerThan = new Date(now - MAX_AGE_DAYS * DAY_MS).toISOString();
  const olderThan = new Date(now - MIN_AGE_DAYS * DAY_MS).toISOString();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

  const { data: requests, error } = await (adminClient.from('meeting_requests') as any)
    .select('id, candidate_profile_id, recruiter_email, recruiter_name, availability, created_at')
    .eq('status', 'new')
    .gte('created_at', newerThan)
    .lte('created_at', olderThan)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error('cron/meeting-request-reminders: query failed', error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  let reminded = 0;
  let scanned = 0;

  for (const r of (requests ?? []) as Array<{
    id: string;
    candidate_profile_id: string;
    recruiter_email: string;
    recruiter_name: string | null;
    availability: string;
    created_at: string;
  }>) {
    scanned += 1;

    // Claim this request's single reminder before doing any work. checkAppRateLimit
    // returns false once the key has been used, so a second pass skips it.
    const firstTime = await checkAppRateLimit(`meeting-reminder:${r.id}`, 1, ONCE_WINDOW_SECONDS);
    if (!firstTime) continue;

    const { data: profile } = await (adminClient.from('candidate_profiles') as any)
      .select('full_name, clerk_user_id')
      .eq('id', r.candidate_profile_id)
      .maybeSingle();
    if (!profile) continue;

    const { data: candUser } = await (adminClient.from('users') as any)
      .select('email')
      .eq('clerk_user_id', profile.clerk_user_id)
      .maybeSingle();
    const candidateEmail: string | null = candUser?.email ?? null;
    if (!candidateEmail) continue;

    const ageDays = Math.max(1, Math.floor((now - new Date(r.created_at).getTime()) / DAY_MS));

    try {
      await sendMeetingReminderEmail({
        candidateName: profile.full_name,
        candidateEmail,
        recruiterEmail: r.recruiter_email,
        recruiterName: r.recruiter_name,
        availability: r.availability,
        ageDays,
        actionUrl: `${appUrl}/dashboard/meeting-requests`,
      });
      reminded += 1;
    } catch (e) {
      // Best-effort. A send failure should not stop the sweep; the request stays
      // 'new' and the idempotency key is already burned, so we won't retry it.
      console.error('cron/meeting-request-reminders: send failed', r.id, e);
    }
  }

  return NextResponse.json({ ok: true, scanned, reminded });
}
