import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ar', 'fr'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  ar: '🇱🇧',
  fr: '🇫🇷',
};

// RTL languages
export const rtlLocales: Locale[] = ['ar'];

export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

// Get locale from cookie (client-side) or default
export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  const locale = match ? (match[1] as Locale) : defaultLocale;
  return locales.includes(locale) ? locale : defaultLocale;
}

export default getRequestConfig(async () => {
  // Server-side: use default locale (client will handle switching)
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
