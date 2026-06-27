import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminClient } from '@/lib/supabase/admin';
import { extractResumeText } from '@/lib/resume/extract-text';
import { parseResumeText } from '@/lib/ai/parse-resume';
import { deriveProfileFromResume } from '@/lib/ai/derive-profile';

// Node runtime: text extraction (unpdf/mammoth) + Anthropic call need Node APIs.
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_EXT = ['pdf', 'docx', 'txt'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected multipart/form-data' } }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Missing file' } }, { status: 400 });
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: `Unsupported file type .${ext}` } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'File exceeds 10MB limit' } }, { status: 400 });
  }

  // The candidate's profile (owner-scoped) is the parent for the resume_document.
  // Pull the public-profile fields too so we can pre-fill the empty ones below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id, headline, target_role, location, linkedin_url, summary_bullets')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    rawText = await extractResumeText(buffer, file.type, ext);
  } catch (e) {
    console.error('resume parse: extraction failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Could not read résumé file' } }, { status: 500 });
  }
  if (!rawText || rawText.length < 30) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Could not extract text from this résumé' } }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await parseResumeText(rawText);
  } catch (e) {
    console.error('resume parse: AI parse failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Résumé parsing failed' } }, { status: 500 });
  }

  // Upsert the candidate's single résumé document (status -> draft, awaiting generate/review).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error } = await (adminClient.from('resume_documents') as any)
    .upsert(
      {
        candidate_profile_id: profile.id,
        clerk_user_id: userId,
        canonical_json: parsed.json,
        canonical_markdown: parsed.markdown,
        status: 'draft',
        derived_suggestions: null,
        approved_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'candidate_profile_id' },
    )
    .select('id, status, canonical_markdown')
    .single();

  if (error || !doc) {
    console.error('resume parse: upsert failed', userId, error);
    return NextResponse.json({ error: { code: 'INTERNAL', message: error?.message } }, { status: 500 });
  }

  // Pre-fill empty public-profile fields from the parsed résumé. Only fields the
  // candidate has not already set are touched -- a re-upload never clobbers edits.
  // Best-effort: a failure here must not fail the parse the user is waiting on.
  try {
    const derived = deriveProfileFromResume(parsed.json);
    const prefill: Record<string, string | string[]> = {};
    if (!profile.headline && derived.headline) prefill.headline = derived.headline;
    if (!profile.target_role && derived.target_role) prefill.target_role = derived.target_role;
    if (!profile.location && derived.location) prefill.location = derived.location;
    if (!profile.linkedin_url && derived.linkedin_url) prefill.linkedin_url = derived.linkedin_url;
    if ((!profile.summary_bullets || profile.summary_bullets.length === 0) && derived.summary_bullets.length) {
      prefill.summary_bullets = derived.summary_bullets;
    }

    if (Object.keys(prefill).length > 0) {
      await (adminClient.from('candidate_profiles') as unknown as { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } })
        .update({ ...prefill, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
    }
  } catch (e) {
    console.error('resume parse: profile pre-fill failed (non-fatal)', userId, e);
  }

  return NextResponse.json({ ok: true, resume_document_id: doc.id, markdown: doc.canonical_markdown, status: doc.status });
}
