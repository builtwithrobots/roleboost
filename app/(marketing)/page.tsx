import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import { ensureAdminBootstrap } from '@/lib/auth/superadmin';
import LandingHero from '@/components/marketing/LandingHero';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

export const metadata: Metadata = {
  title: {
    absolute: 'RoleBoost: AI candidate profiles recruiters can interrogate 24/7',
  },
  description:
    'Upload your resume and career context; RoleBoost builds a personal career AI that represents you to recruiters 24/7, plus audio, video, infographic, and slide-deck Boosts. Share one link and be heard.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'RoleBoost: AI candidate profiles recruiters can interrogate 24/7',
    description:
      'A personal career AI that represents you to recruiters 24/7, plus audio, video, infographic, and slide-deck Boosts. Your career. Your AI. Finally heard.',
  },
};

// Organization + WebSite structured data, so search engines understand the brand.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'RoleBoost',
      url: APP_URL,
      logo: `${APP_URL}/icons/512`,
      description:
        'AI-powered candidate intelligence platform. A personal career AI, plus audio, video, infographic, and slide-deck Boosts, shared over one link.',
    },
    {
      '@type': 'WebSite',
      name: 'RoleBoost',
      url: APP_URL,
    },
  ],
};

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    // Look up the stored role. Keep the redirect() calls OUTSIDE this try/catch:
    // redirect() signals by throwing NEXT_REDIRECT, so catching here would swallow
    // the role-based redirect and send every user to /onboarding on each login.
    let role: string | null | undefined;
    let isAdmin = false;
    let suspended = false;
    try {
      const { data: user } = await (adminClient.from('users') as any)
        .select('role, is_admin, email')
        .eq('clerk_user_id', userId)
        .single();
      role = user?.role ?? null;
      // Self-heal the SUPERADMIN_EMAILS allowlist so a first-time admin is caught
      // here and routed to /admin even if their stored role is candidate/employer.
      isAdmin = await ensureAdminBootstrap(userId, user?.email ?? null, user?.is_admin ?? false);
    } catch {
      role = null;
    }

    // suspended_at is read separately and defensively: it is added by a later
    // migration, so selecting it in the query above on a not-yet-migrated DB would
    // fail the whole lookup and loop established users through onboarding.
    if (!isAdmin) {
      try {
        const { data } = await (adminClient.from('users') as any)
          .select('suspended_at')
          .eq('clerk_user_id', userId)
          .maybeSingle();
        suspended = Boolean((data as { suspended_at?: string | null } | null)?.suspended_at);
      } catch {
        suspended = false;
      }
    }

    // Admins get the superadmin dashboard regardless of their candidate/employer role.
    if (isAdmin) redirect('/admin');
    // Suspended (non-admin) users are locked out.
    if (suspended) redirect('/suspended');
    if (role === 'candidate') redirect('/dashboard/profile');
    if (role === 'employer') redirect('/dashboard/candidates');

    redirect('/onboarding');
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingHero />
    </>
  );
}
