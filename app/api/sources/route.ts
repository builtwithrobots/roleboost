import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { extractResumeText } from '@/lib/resume/extract-text';
import { MAX_ACTIVE_SOURCES } from '@/lib/career-sources/queries';
import { parseLinkedInExport } from '@/lib/career-sources/linkedin-export';
import { fetchGitHubProfile } from '@/lib/career-sources/github-import';
import type { CareerSourceType, SourceIngestMethod } from '@/lib/types';

// Node runtime: text extraction (unpdf/mammoth/jszip) needs Node APIs. Owner-only.
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_EXT = ['pdf', 'docx', 'txt', 'zip'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 50000;
const MIN_TEXT_CHARS = 30;

const SOURCE_TYPES: CareerSourceType[] = [
  'linkedin',
  'indeed',
  'github',
  'portfolio',
  'review',
  'recommendation',
  'other',
];

const MetaSchema = z.object({
  source_type: z.enum(SOURCE_TYPES as [CareerSourceType, ...CareerSourceType[]]),
  label: z.string().min(1).max(60),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected multipart/form-data' } }, { status: 400 });
  }

  const meta = MetaSchema.safeParse({
    source_type: formData.get('source_type'),
    label: (formData.get('label') as string | null)?.trim(),
  });
  if (!meta.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: meta.error.issues } }, { status: 400 });
  }
  const { source_type, label } = meta.data;

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const profileId = (profile as { id: string }).id;

  // Enforce the active-source cap before doing any extraction work.
  const { count } = await supabase
    .from('career_sources')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_profile_id', profileId)
    .eq('is_active', true);
  if ((count ?? 0) >= MAX_ACTIVE_SOURCES) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: `You can keep up to ${MAX_ACTIVE_SOURCES} sources. Remove one to add another.` } },
      { status: 400 },
    );
  }

  // Resolve the text from one of: a link (GitHub), an uploaded file (a LinkedIn
  // .zip export gets structured parsing; pdf/docx/txt go through text extraction),
  // or pasted text.
  let extractedText: string;
  let ingestMethod: SourceIngestMethod;
  let fileName: string | null = null;
  let sourceUrl: string | null = null;
  let resolvedLabel = label;

  const file = formData.get('file') as File | null;
  const pasted = (formData.get('text') as string | null)?.trim() ?? '';
  const url = (formData.get('url') as string | null)?.trim() ?? '';

  if (url) {
    // Link import. GitHub is the only supported provider today.
    try {
      const profile = await fetchGitHubProfile(url);
      extractedText = profile.text;
      sourceUrl = profile.url;
      resolvedLabel = profile.label;
    } catch (e) {
      const code = e instanceof Error ? e.message : 'FETCH_FAILED';
      const message =
        code === 'NOT_FOUND'
          ? 'No public GitHub profile found at that link'
          : code === 'RATE_LIMITED'
            ? 'GitHub is rate-limiting right now, try again in a few minutes'
            : code === 'INVALID_INPUT'
              ? 'That does not look like a GitHub profile link or username'
              : 'Could not fetch that GitHub profile';
      const status = code === 'NOT_FOUND' || code === 'INVALID_INPUT' ? 400 : 502;
      return NextResponse.json({ error: { code: code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'INTERNAL', message } }, { status });
    }
    ingestMethod = 'link';
  } else if (file && file.size > 0) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: `Unsupported file type .${ext}` } }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'File exceeds 10MB limit' } }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      extractedText =
        ext === 'zip'
          ? (await parseLinkedInExport(buffer)).trim()
          : (await extractResumeText(buffer, file.type, ext)).trim();
    } catch (e) {
      console.error('sources: extraction failed', userId, e);
      const message = e instanceof Error && ext === 'zip' ? e.message : 'Could not read that file';
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message } }, { status: 400 });
    }
    ingestMethod = 'upload';
    fileName = file.name;
  } else if (pasted) {
    extractedText = pasted;
    ingestMethod = 'paste';
  } else {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Provide a link, file, or pasted text' } }, { status: 400 });
  }

  if (extractedText.length < MIN_TEXT_CHARS) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Not enough readable text in this source' } }, { status: 400 });
  }
  if (extractedText.length > MAX_TEXT_CHARS) extractedText = extractedText.slice(0, MAX_TEXT_CHARS);

  const { data: inserted, error } = await supabase
    .from('career_sources')
    .insert({
      candidate_profile_id: profileId,
      clerk_user_id: userId,
      source_type,
      label: resolvedLabel,
      ingest_method: ingestMethod,
      extracted_text: extractedText,
      char_count: extractedText.length,
      source_url: sourceUrl,
      file_name: fileName,
    })
    .select('id, source_type, label, ingest_method, char_count, file_name, created_at')
    .single();

  if (error || !inserted) {
    console.error('sources: insert failed', userId, error);
    return NextResponse.json({ error: { code: 'INTERNAL', message: error?.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ ok: true, source: inserted });
}
