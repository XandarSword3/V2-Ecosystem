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
import { JsonLd, generateResortSchema } from '@/lib/structured-data';

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
  description: 'Welcome to V2 Resort - Your premium destination for dining, chalets, and pool experiences. Featuring luxury chalets, fine dining restaurant, and family pool.',
  keywords: 'resort, restaurant, chalets, pool, vacation, dining, getaway, luxury',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'V2 Resort',
  },
  openGraph: {
    title: 'V2 Resort | Luxury Getaway',
    description: 'Experience the perfect blend of relaxation and entertainment. Luxury chalets, exquisite dining, and refreshing pool sessions.',
    type: 'website',
  },
  other: {
    'mobile-web-app-capable': 'yes',
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

  const resortSchema = generateResortSchema({
    name: 'V2 Resort',
    description: 'Premier resort offering luxury chalets, fine dining, and pool experiences.',
    url: 'https://v2-ecosystem.vercel.app',
    telephone: '+1 234 567 8900',
    email: 'bookings@v2resort.com',
    address: {
      street: '123 Resort Boulevard',
      city: 'Global City',
      region: 'State',
      country: 'Country',
    },
    images: ['https://v2-ecosystem.vercel.app/images/resort-cover.jpg'],
    priceRange: '$$',
    openingHours: ['10:00-23:00'],
  });

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
      <head>
        <JsonLd data={resortSchema} />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
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
