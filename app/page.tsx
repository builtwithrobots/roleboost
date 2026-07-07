import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import { ensureAdminBootstrap } from '@/lib/auth/superadmin';
import Nav from '@/components/marketing/Nav';
import HeroSection from '@/components/marketing/HeroSection';
import SocialProofBar from '@/components/marketing/SocialProofBar';
import ProblemSection from '@/components/marketing/ProblemSection';
import AssetSuite from '@/components/marketing/AssetSuite';
import HowItWorksCandidate from '@/components/marketing/HowItWorksCandidate';
import HowItWorksEmployer from '@/components/marketing/HowItWorksEmployer';
import AIChatbotSpotlight from '@/components/marketing/AIChatbotSpotlight';
import TranscriptLoop from '@/components/marketing/TranscriptLoop';
import PricingSection from '@/components/marketing/PricingSection';
import DoneForYouSection from '@/components/marketing/DoneForYouSection';
import FinalCTA from '@/components/marketing/FinalCTA';
import Footer from '@/components/marketing/Footer';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    // Look up the stored role. Keep the redirect() calls OUTSIDE this try/catch:
    // redirect() signals by throwing NEXT_REDIRECT, so catching here would swallow
    // the role-based redirect and send every user to /onboarding on each login.
    let role: string | null | undefined;
    let isAdmin = false;
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

    // Admins get the superadmin dashboard regardless of their candidate/employer role.
    if (isAdmin) redirect('/admin');
    if (role === 'candidate') redirect('/dashboard/profile');
    if (role === 'employer') redirect('/dashboard/candidates');

    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#1E3A5F] focus:text-white focus:font-jakarta focus:font-semibold"
      >
        Skip to main content
      </a>
      <Nav />
      <main id="main-content">
        <HeroSection />
        <SocialProofBar />
        <ProblemSection />
        <AssetSuite />
        <HowItWorksCandidate />
        <HowItWorksEmployer />
        <AIChatbotSpotlight />
        <TranscriptLoop />
        <PricingSection />
        <DoneForYouSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
