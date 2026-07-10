import type { Metadata } from 'next';
import RecruiterHero from '@/components/marketing/RecruiterHero';

export const metadata: Metadata = {
  title: 'For Recruiters',
  description:
    "Every RoleBoost candidate comes with a personal career AI you can interrogate 24/7, plus audio, video, infographic, and deck Boosts behind one link. Know who you're calling before you pick up the phone.",
  alternates: { canonical: '/recruiters' },
  openGraph: {
    url: '/recruiters',
    title: 'RoleBoost for Recruiters: talk to the candidate’s AI before the first call',
    description:
      'A live candidate AI you can question, plus audio, video, infographic, and deck Boosts, all from one link. The screening call becomes a confirmation, not an interrogation.',
  },
};

export default function RecruitersPage() {
  return <RecruiterHero />;
}
