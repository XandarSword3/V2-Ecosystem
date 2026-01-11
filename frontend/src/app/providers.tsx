'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/ThemeProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocaleFromCookie, defaultLocale, type Locale } from '@/i18n';
import { LoadingScreen } from '@/components/effects/LoadingScreen';
import { SettingsProvider } from '@/lib/settings-context';
import { HydrateSettingsFromBackend } from '@/lib/hydrate-settings';
import { DirectionSync } from '@/components/DirectionSync';
import { ThemeInjector } from '@/components/ThemeInjector';
import { WeatherEffects } from '@/components/effects/WeatherEffects';

// Import all messages statically to avoid async loading issues
import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';
import frMessages from '../../messages/fr.json';

const allMessages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  ar: arMessages,
  fr: frMessages,
};

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Get initial locale from cookie (client-side)
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const currentLocale = getLocaleFromCookie();
    setLocale(currentLocale);
  }, []);

  // Listen for locale changes (when user switches language)
  useEffect(() => {
    const handleLocaleChange = () => {
      const newLocale = getLocaleFromCookie();
      setLocale(newLocale);
    };

    // Custom event for language switching
    window.addEventListener('localeChange', handleLocaleChange);
    return () => window.removeEventListener('localeChange', handleLocaleChange);
  }, []);

  // Get messages for current locale (always available, no async loading)
  const messages = useMemo(() => allMessages[locale], [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Beirut">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <HydrateSettingsFromBackend />
              <ThemeInjector />
              <WeatherEffects />
              <DirectionSync />
              <LoadingScreen />
              {children}
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
