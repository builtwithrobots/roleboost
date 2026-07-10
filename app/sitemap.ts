import type { MetadataRoute } from 'next';
import { FEATURED_PERSONAS } from '@/lib/boosts/personas';
import { adminClient } from '@/lib/supabase/admin';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

// Refresh at most hourly so candidates who newly opt into discovery are picked up
// without a redeploy, while avoiding a DB read on every crawler request.
export const revalidate = 3600;

// Only public, indexable pages belong here. Candidate calling cards (/c/[slug])
// are excluded by default (they are noindex), and included only for candidates
// who opted into search discoverability. Read defensively: the search_discoverable
// column is added by the 20260715 migration, so a not-yet-migrated DB (or any
// query error) simply yields no candidate URLs rather than breaking the sitemap.
async function discoverableCandidateRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data } = await (adminClient.from('candidate_profiles') as any)
      .select('slug, updated_at')
      .eq('is_published', true)
      .eq('search_discoverable', true);

    return ((data ?? []) as { slug: string; updated_at?: string | null }[]).map((c) => ({
      url: `${BASE_URL}/c/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.5,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/boosts`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/recruiters`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const personaRoutes: MetadataRoute.Sitemap = FEATURED_PERSONAS.map((persona) => ({
    url: `${BASE_URL}/boosts/${persona.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const candidateRoutes = await discoverableCandidateRoutes();

  return [...staticRoutes, ...personaRoutes, ...candidateRoutes];
}
