import type { MetadataRoute } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

// Crawlers may index the marketing pages and the Boost examples. Authenticated
// app areas, APIs, and auth flows are disallowed. Candidate calling cards
// (/c/[slug]) are intentionally NOT disallowed here: they carry a per-page
// noindex instead, so crawlers can read that directive and keep them out of
// search while the link stays shareable. (Disallowing them would prevent the
// noindex from ever being seen.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/api/',
          '/sign-in',
          '/sign-up',
          '/onboarding',
          '/preview',
          '/suspended',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
