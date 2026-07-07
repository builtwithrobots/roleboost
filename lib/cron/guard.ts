import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

// Shared authorization for every scheduled route under app/api/cron/*.
//
// Vercel Cron invokes these paths with `Authorization: Bearer $CRON_SECRET`.
// We mirror the graceful-degradation posture of the transcript sweep: until the
// secret is provisioned the route is a harmless no-op (200, skipped) rather than
// a hard failure, so a cron can ship ahead of its env var. Once the secret is
// set, a missing or mismatched token is rejected with the standard envelope.

export type CronGuard = { ok: true } | { ok: false; response: NextResponse };

export function guardCron(req: NextRequest): CronGuard {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, response: NextResponse.json({ ok: true, skipped: 'no_secret' }) };
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }),
    };
  }
  return { ok: true };
}
