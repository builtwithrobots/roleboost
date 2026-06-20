import 'server-only';
import { getRequestClient } from '@/lib/supabase/server';

export async function getSignedAssetUrl(bucket: string, path: string): Promise<string> {
  const supabase = await getRequestClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
