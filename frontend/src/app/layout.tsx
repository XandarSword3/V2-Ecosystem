import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { defaultLocale, getLocaleFromCookie, type Locale } from '@/i18n';
import Header from '@/components/layout/Header';
import { WeatherEffects } from '@/components/effects/WeatherEffects';
import { PageTransition } from '@/components/effects/PageTransition';

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

  return (
    <html 
      lang={locale} 
      dir={isRtl ? 'rtl' : 'ltr'} 
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${notoArabic.variable} ${isRtl ? 'font-arabic' : 'font-sans'}`}>
        <Providers>
          <WeatherEffects />
          <Header />
          <main>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Toaster position={isRtl ? 'top-left' : 'top-right'} richColors />
        </Providers>
      </body>
    </html>
  );
}
