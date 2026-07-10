import LandingNav from '@/components/marketing/LandingNav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#1E3A5F] focus:text-white focus:font-jakarta focus:font-semibold"
      >
        Skip to main content
      </a>
      <LandingNav />
      <main id="main-content">{children}</main>
    </div>
  );
}
