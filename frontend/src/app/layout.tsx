import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { defaultLocale, type Locale } from '@/i18n';

import Header from '@/components/layout/Header';
import Footer from '@/components/Footer';
import { PageTransition } from '@/components/effects/PageTransition';
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

  // Theme detection script that runs BEFORE React hydrates
  // This prevents the "flash of wrong theme" on initial load
  const themeScript = `
(function() {
  try {
    // Get theme and mode from localStorage (set by previous visits)
    var theme = localStorage.getItem('v2-resort-theme') || 'beach';
    var mode = localStorage.getItem('theme') || 'light';
    
    // Theme color mappings (must match theme-config.ts)
    var themes = {
      beach: { bg: '#f0fdfa', bgDark: '#042f2e', primary: '#0891b2' },
      mountain: { bg: '#fafaf9', bgDark: '#1c1917', primary: '#78716c' },
      sunset: { bg: '#fff7ed', bgDark: '#431407', primary: '#ea580c' },
      forest: { bg: '#f0fdf4', bgDark: '#052e16', primary: '#15803d' },
      midnight: { bg: '#faf5ff', bgDark: '#2e1065', primary: '#7c3aed' },
      luxury: { bg: '#fffbeb', bgDark: '#0f172a', primary: '#d97706' }
    };
    
    var t = themes[theme] || themes.beach;
    var isDark = mode === 'dark';
    var bgColor = isDark ? t.bgDark : t.bg;
    
    // Apply initial background color to prevent flash
    document.documentElement.style.setProperty('--initial-bg', bgColor);
    document.documentElement.style.setProperty('--color-primary', t.primary);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-color-mode', mode);
    document.documentElement.classList.add(mode);
    
    // Set body background immediately
    document.documentElement.style.backgroundColor = bgColor;
  } catch (e) {}
})();
`;

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <head>
        {/* Critical: Theme detection script runs BEFORE React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={resortSchema} />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.variable} ${notoArabic.variable} ${isRtl ? 'font-arabic' : 'font-sans'} bg-cms-background transition-colors duration-300`}>
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
