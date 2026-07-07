import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

// Every candidate storage bucket. Files are laid out as `{clerk_user_id}/...`,
// so a candidate owns exactly the objects under their own id prefix.
const CANDIDATE_BUCKETS = [
  'candidate-audio',
  'candidate-video',
  'candidate-documents',
  'candidate-images',
] as const;

/**
 * Deletes every stored file owned by a candidate across all asset buckets.
 *
 * Postgres ON DELETE CASCADE never touches Supabase Storage, so a full account
 * reset has to clear these objects explicitly. The admin (service-role) client
 * is used so the sweep completes reliably regardless of the caller's session;
 * every path is strictly prefixed by the caller's own clerk_user_id, which is
 * the ownership boundary the storage RLS policy also enforces.
 *
 * Best effort: a failure on one bucket is logged and does not stop the others.
 */
export async function deleteAllCandidateFiles(userId: string): Promise<void> {
  const admin = getAdminClient();

  for (const bucket of CANDIDATE_BUCKETS) {
    try {
      const { data: entries, error } = await admin.storage
        .from(bucket)
        .list(userId, { limit: 1000 });

      if (error) {
        console.error('deleteAllCandidateFiles: list failed', bucket, userId, error);
        continue;
      }
      if (!entries?.length) continue;

      const paths = entries
        .filter((e) => e.name)
        .map((e) => `${userId}/${e.name}`);

      if (paths.length) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) {
          console.error('deleteAllCandidateFiles: remove failed', bucket, userId, removeError);
        }
      }
    } catch (e) {
      console.error('deleteAllCandidateFiles: unexpected error', bucket, userId, e);
    }
  }
}
