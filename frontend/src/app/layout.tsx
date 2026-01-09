import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { defaultLocale, getLocaleFromCookie, type Locale } from '@/i18n';

import Header from '@/components/layout/Header';
import Footer from '@/components/Footer';
import { PageTransition } from '@/components/effects/PageTransition';
import { useSiteSettings } from '@/lib/settings-context';
import { resortThemes } from '@/lib/theme-config';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: 'V2 Resort | Restaurant, Chalets & Pool',
  description: 'Welcome to V2 Resort - Your premium destination for dining, chalets, and pool experiences in Lebanon.',
  keywords: 'resort, restaurant, chalets, pool, Lebanon, vacation, dining',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'V2 Resort',
    description: 'Premium resort experience in Lebanon',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use default locale on server, client will handle language switching
  const locale = defaultLocale;
  const isRtl = locale === 'ar';

  // Get theme from settings context (client only)
  let themeClass = '';
  if (typeof window !== 'undefined') {
    try {
      // Dynamically import hook to avoid SSR issues
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { settings } = require('@/lib/settings-context').useSiteSettings();
      const theme = (settings?.theme || 'beach') as import('@/lib/theme-config').ResortTheme;
      themeClass = resortThemes[theme]?.background || '';
    } catch {}
  }

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${notoArabic.variable} ${isRtl ? 'font-arabic' : 'font-sans'} ${themeClass}`}>
        <Providers>
          <Header />
          <main>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Footer />
          <Toaster position={isRtl ? 'top-left' : 'top-right'} richColors />
        </Providers>
      </body>
    </html>
  );
}
