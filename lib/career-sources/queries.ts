import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CareerSource, IntakeDocument } from '@/lib/types';

// Per-candidate active-source cap fed to the brain. Bounds prompt size and cost;
// the AI Studio UI enforces the same ceiling on the write path.
export const MAX_ACTIVE_SOURCES = 10;

const SOURCE_COLUMNS =
  'id, candidate_profile_id, clerk_user_id, source_type, label, ingest_method, extracted_text, char_count, source_url, file_name, is_active, created_at, updated_at';

/**
 * Active career sources for a profile, oldest first. Owner-scoped: pass an
 * authenticated (RLS) client; the explicit profile filter is defense-in-depth
 * and keeps the query indexed.
 */
export async function getActiveCareerSources(
  supabase: SupabaseClient,
  profileId: string,
): Promise<CareerSource[]> {
  const { data } = await supabase
    .from('career_sources')
    .select(SOURCE_COLUMNS)
    .eq('candidate_profile_id', profileId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(MAX_ACTIVE_SOURCES);
  return (data ?? []) as unknown as CareerSource[];
}

/** Shapes active sources into the { label, text } grounding docs the brain consumes. */
export async function getSourceDocuments(
  supabase: SupabaseClient,
  profileId: string,
): Promise<IntakeDocument[]> {
  const sources = await getActiveCareerSources(supabase, profileId);
  return sources
    .filter((s) => s.extracted_text.trim())
    .map((s) => ({ label: s.label, text: s.extracted_text }));
}
