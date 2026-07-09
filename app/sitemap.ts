import type { MetadataRoute } from 'next';
import { FEATURED_PERSONAS } from '@/lib/boosts/personas';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

// Only public, indexable marketing pages belong here. Candidate calling cards
// (/c/[slug]) are deliberately excluded: they are shareable by link but kept
// out of search (see the noindex in app/c/[slug]/page.tsx), so listing them in
// the sitemap would work against that.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/boosts`, changeFrequency: 'weekly', priority: 0.8 },
  ];

  const personaRoutes: MetadataRoute.Sitemap = FEATURED_PERSONAS.map((persona) => ({
    url: `${BASE_URL}/boosts/${persona.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...personaRoutes];
}
