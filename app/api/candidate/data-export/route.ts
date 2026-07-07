import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getAdminClient } from '@/lib/supabase/admin';

// Node runtime: JSZip buffers file contents and we read private Storage via the
// service-role client. Never cache a personal export.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetRow = {
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  asset_type: string;
  is_active: boolean;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file';
}

/**
 * "Download my data": a complete, self-serve export of everything RoleBoost
 * holds for the signed-in candidate.
 *
 *   ?format=json  → a single JSON document with every record plus a manifest of
 *                   media assets (each with a 1-hour signed download link).
 *   ?format=zip   → the same JSON plus the actual media files, bundled.
 *
 * All database reads go through the RLS-scoped request client, so a candidate
 * can only ever export their own data. Private asset buckets are read with the
 * admin client (the same pattern the profile page uses to sign avatars).
 */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : e.code === 'NO_USER' ? 403 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }

  const { supabase, userId } = ctx;
  const format = req.nextUrl.searchParams.get('format') === 'zip' ? 'zip' : 'json';

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('clerk_user_id', userId)
    .single();

  if (!profileRow) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }
  const profile = profileRow as Record<string, unknown> & { id: string; slug?: string };
  const profileId = profile.id;

  // Gather every candidate-owned table. RLS scopes each read to this candidate;
  // a query that errors just contributes an empty array rather than 500-ing.
  const [
    resumeDocs,
    careerSources,
    intakeAnswers,
    sandboxSessions,
    transcriptGaps,
    hardeningSessions,
    chatSessions,
    meetingRequests,
    feedback,
    assets,
  ] = await Promise.all([
    supabase.from('resume_documents').select('*').eq('candidate_profile_id', profileId),
    supabase.from('career_sources').select('*').eq('candidate_profile_id', profileId),
    supabase.from('intake_answers').select('*').eq('candidate_profile_id', profileId),
    supabase.from('sandbox_sessions').select('*').eq('candidate_profile_id', profileId),
    supabase.from('transcript_gaps').select('*').eq('candidate_profile_id', profileId),
    supabase.from('brain_hardening_sessions').select('*').eq('candidate_profile_id', profileId),
    supabase.from('chat_sessions').select('*').eq('candidate_profile_id', profileId),
    supabase.from('meeting_requests').select('*').eq('candidate_profile_id', profileId),
    supabase.from('feedback').select('*').eq('candidate_profile_id', profileId),
    supabase.from('candidate_assets').select('*').eq('candidate_profile_id', profileId),
  ]);

  const sessionRows = (chatSessions.data ?? []) as { id: string }[];
  let chatMessages: unknown[] = [];
  if (sessionRows.length) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .in('chat_session_id', sessionRows.map((s) => s.id))
      .order('created_at', { ascending: true });
    chatMessages = msgs ?? [];
  }

  const assetRows = (assets.data ?? []) as AssetRow[];
  const admin = getAdminClient();

  // Manifest: one entry per stored file, with a freshly signed 1-hour link.
  const assetManifest = await Promise.all(
    assetRows.map(async (a) => {
      let url: string | null = null;
      try {
        const { data } = await admin.storage.from(a.storage_bucket).createSignedUrl(a.storage_path, 3600);
        url = data?.signedUrl ?? null;
      } catch {
        url = null;
      }
      return {
        asset_type: a.asset_type,
        file_name: a.file_name,
        bucket: a.storage_bucket,
        path: a.storage_path,
        is_active: a.is_active,
        download_url: url,
      };
    }),
  );

  const exportObject = {
    export_version: 1,
    exported_at_note:
      'Complete export of your RoleBoost data. Media download links expire in one hour; export again to refresh them.',
    account: { clerk_user_id: userId },
    profile,
    resume_documents: resumeDocs.data ?? [],
    career_sources: careerSources.data ?? [],
    intake_answers: intakeAnswers.data ?? [],
    sandbox_sessions: sandboxSessions.data ?? [],
    transcript_gaps: transcriptGaps.data ?? [],
    brain_hardening_sessions: hardeningSessions.data ?? [],
    chat_sessions: chatSessions.data ?? [],
    chat_messages: chatMessages,
    meeting_requests: meetingRequests.data ?? [],
    feedback: feedback.data ?? [],
    assets: assetManifest,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = typeof profile.slug === 'string' && profile.slug ? profile.slug : 'candidate';
  const json = JSON.stringify(exportObject, null, 2);

  if (format === 'json') {
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="roleboost-export-${slug}-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ZIP: the JSON document plus the real media files, grouped by asset type.
  const zip = new JSZip();
  zip.file('roleboost-data.json', json);
  const assetsFolder = zip.folder('assets');

  await Promise.all(
    assetRows.map(async (a, i) => {
      try {
        const { data, error } = await admin.storage.from(a.storage_bucket).download(a.storage_path);
        if (error || !data) return;
        const buf = new Uint8Array(await data.arrayBuffer());
        const base = a.file_name ? sanitizeFileName(a.file_name) : `${a.asset_type}-${i + 1}`;
        assetsFolder?.file(`${a.asset_type}/${base}`, buf);
      } catch {
        // Skip an unreadable file rather than failing the whole export.
      }
    }),
  );

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  // Copy into a fresh, non-shared ArrayBuffer so the body type is unambiguous.
  const body = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(body).set(zipBytes);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="roleboost-export-${slug}-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
