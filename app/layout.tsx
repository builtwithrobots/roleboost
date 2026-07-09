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

export const metadata: Metadata = {
  title: 'RoleBoost',
  description: 'When everyone sounds the same on paper, be heard.',
  manifest: '/manifest.webmanifest',
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
