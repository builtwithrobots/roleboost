import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminClient } from '@/lib/supabase/admin';
import { extractResumeText } from '@/lib/resume/extract-text';
import { parseResumeText } from '@/lib/ai/parse-resume';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id')
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

  return NextResponse.json({ ok: true, resume_document_id: doc.id, markdown: doc.canonical_markdown, status: doc.status });
}
