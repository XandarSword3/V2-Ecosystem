import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { defaultLocale, type Locale } from '@/i18n';

import Header from '@/components/layout/Header';
import Footer from '@/components/Footer';
import { ModuleTransition } from '@/components/effects/ModuleTransition';
import { LoadingScreenWrapper } from '@/components/effects/LoadingScreen';
import { OfflineStatusIndicator } from '@/components/offline/OfflineStatusIndicator';
import { JsonLd, generateResortSchema } from '@/lib/structured-data';

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return 'http://localhost:3005';
};

const fallbackSettings = {
  resortName: 'Your Resort',
  description: 'Premier resort platform.'
};

const isLocalApiUrl = (url: string) => /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);

async function getSiteSettings() {
  const baseUrl = getBaseUrl();
  const isLocalApi = isLocalApiUrl(baseUrl);
  const shouldLogError = process.env.NODE_ENV === 'development' || !isLocalApi;

  try {
    // Skip fetch when the API points to localhost.
    if (isLocalApi) {
      return fallbackSettings;
    }

    const res = await fetch(`${baseUrl}/api/settings`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    return data.data || data;
  } catch (error) {
    if (shouldLogError) {
      console.error('Metadata fetch error:', error);
    }
    return fallbackSettings;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.resortName || 'Your Resort';
  const description = settings.description || 'Experience the perfect blend of relaxation and entertainment.';

  return {
    title: `${title} | Luxury Experience`,
    description,
    keywords: 'resort, luxury, dining, experience, vacation',
    manifest: '/manifest.json',
    icons: {
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
      apple: '/icons/icon-192x192.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: title,
    },
    openGraph: {
      title: `${title} | Luxury Experience`,
      description,
      type: 'website',
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use default locale on server
  const locale = defaultLocale;
  const isRtl = locale === 'ar';

  const settings = await getSiteSettings();

  const resortSchema = generateResortSchema({
    name: settings.resortName || 'Your Resort',
    description: settings.description || 'Premier resort experience.',
    url: 'https://v2-ecosystem.vercel.app',
    telephone: '+1 234 567 8900',
    email: settings.email || 'bookings@yourresort.com',
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

  // --------------------------------------------------------------------------
  // GDPR: Theme detection script — classified as STRICTLY NECESSARY
  //
  // This inline script reads two localStorage keys before React hydrates:
  //   - 'v2-ecosystem-theme' — the colour theme (beach, mountain, etc.)
  //   - 'theme' — light/dark mode
  //
  // Justification for strictly-necessary classification:
  //   1. These keys contain no personal data — only UI preference strings
  //   2. Without this script, every page load produces a visible flash of the
  //      wrong colour scheme, which degrades core functionality
  //   3. The ePrivacy Directive Article 5(3) exempts storage that is "strictly
  //      necessary" for the service the user has requested
  //   4. No data is transmitted to any server — read-only from localStorage
  //
  // If Sentry is enabled in the future, its client initialisation MUST be
  // gated behind analytics consent. Create sentry.client.config.ts and wrap
  // Sentry.init() with a consent check:
  //   import { hasConsent } from '@/context/ConsentContext';
  //   if (hasConsent('analytics')) { Sentry.init({...}); }
  //
  // If Google Analytics or any third-party analytics script is added, it MUST
  // only be loaded after analytics consent is granted via the ConsentContext.
  // No analytics scripts are currently active on this platform.
  // --------------------------------------------------------------------------
  const themeScript = `
(function() {
  try {
    // Get theme and mode from localStorage (set by previous visits)
    var theme = localStorage.getItem('v2-ecosystem-theme') || 'beach';
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
      <body
        className={`${isRtl ? 'font-arabic' : 'font-sans'} bg-cms-background transition-colors duration-300 overflow-x-hidden min-h-dvh`}
      >
        <Providers>
          <LoadingScreenWrapper minDuration={2000}>
            <Header />
            <main className="min-h-[60vh] overflow-x-clip">
              <ModuleTransition>{children}</ModuleTransition>
            </main>
            <Footer />
            <Toaster position={isRtl ? 'top-left' : 'top-right'} richColors />
            <OfflineStatusIndicator />
          </LoadingScreenWrapper>
        </Providers>
      </body>
    </html>
  );
}
