import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import DashboardPage from '@/components/layout/DashboardPage';
import HowItWorks from '@/components/candidate/HowItWorks';

// The full "How it works" guide as a bookmarkable page. The same content also
// opens in a dialog from the persistent help button (components/candidate/HelpButton).
export default async function GuidePage() {
  try {
    await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  return (
    <DashboardPage>
      <div className="mx-auto max-w-3xl p-6">
        <HowItWorks />
      </div>
    </DashboardPage>
  );
}
