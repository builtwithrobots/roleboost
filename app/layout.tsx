import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import ScrollToTop from '@/components/ui/ScrollToTop';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app').replace(/\/$/, '');

const SITE_DESCRIPTION =
  'RoleBoost turns your resume and career context into a shareable AI candidate profile: a personal career AI recruiters can interrogate 24/7, plus audio, video, infographic, and slide-deck Boosts. Your career. Your AI. Finally heard.';

export const metadata: Metadata = {
  // Resolves every relative OG/canonical URL and the file-based OG images.
  metadataBase: new URL(APP_URL),
  title: {
    default: 'RoleBoost: Your career. Your AI. Finally heard.',
    // Child pages set just their name; this frames it as "Name | RoleBoost".
    template: '%s | RoleBoost',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'RoleBoost',
  keywords: [
    'AI candidate profile',
    'career AI',
    'candidate intelligence',
    'resume alternative',
    'job search',
    'hiring',
    'recruiter tools',
  ],
  authors: [{ name: 'RoleBoost' }],
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'RoleBoost',
    title: 'RoleBoost: Your career. Your AI. Finally heard.',
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoleBoost: Your career. Your AI. Finally heard.',
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: '/icons/32',
    apple: '/icons/180',
  },
  appleWebApp: {
    capable: true,
    title: 'RoleBoost',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#D97706',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      >
        <body className="font-body antialiased">
          {children}
          <ScrollToTop />
        </body>
      </html>
    </ClerkProvider>
  );
}
