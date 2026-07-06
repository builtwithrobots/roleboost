import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@vercel/firewall';

// Public endpoint. A recruiter optionally attaches their name / company / email
// to their chat session, so the candidate sees who reached out and the recruiter
// gets their own transcript copy. Never required; all fields optional. Rate
// limited at the edge; writes via the service-role client (recruiter is anon).
export const runtime = 'nodejs';
export const maxDuration = 10;

const Input = z.object({
  sessionId: z.string().uuid(),
  name: z.string().max(120).optional(),
  company: z.string().max(160).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
});

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export async function POST(req: NextRequest) {
  // Recommended rule: 20 requests / 300s per IP (see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('identify', { request: req });
    if (rateLimited) return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
  } catch (e) {
    console.error('identify: rate limit check failed', e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { sessionId } = parsed.data;
  const name = clean(parsed.data.name);
  const company = clean(parsed.data.company);
  const email = clean(parsed.data.email || undefined);

  // Only update the fields actually provided; leave the rest untouched (so a
  // resolved employer company is not wiped by an empty submission).
  const update: Record<string, string> = {};
  if (name) update.recruiter_name = name;
  if (email) update.recruiter_email = email;
  if (company) update.employer_company_name = company;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, skipped: 'empty' });
  }

  const { error } = await (adminClient.from('chat_sessions') as any)
    .update(update)
    .eq('id', sessionId)
    .eq('is_sandbox', false);
  if (error) {
    console.error('identify: update failed', sessionId, error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
