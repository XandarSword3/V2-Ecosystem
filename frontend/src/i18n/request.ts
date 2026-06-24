import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ar', 'fr', 'de', 'it'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  ar: '🇱🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
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

/**
 * Deep-set a value on a nested object using a dotted key path.
 * e.g. setNestedValue(obj, 'navigation.home', 'Home') → obj.navigation.home = 'Home'
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: string
): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export default getRequestConfig(async ({locale: rawLocale}) => {
  const locale: string = rawLocale ?? defaultLocale;

  // 1. Load local JSON file as baseline (UI never breaks if DB is down)
  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (err) {
    console.error(`Failed to load local messages for ${locale}`, err);
    messages = {};
  }

  // 2. In production, layer dynamic translations from DB — DB values win over static file
  if (process.env.ENABLE_DYNAMIC_TRANSLATIONS === 'true') {
    // Skip during static-generation build against a local backend that isn't running
    if (
      process.env.npm_lifecycle_event === 'build' &&
      (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005').includes('localhost')
    ) {
      console.warn(
        `[Build Bypass] Skipping dynamic translation fetch for ${locale} during static generation`
      );
      return { locale, messages };
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/api/v1/admin/translations/ui?locale=${locale}&status=published&limit=2000`,
        { next: { tags: ['translations'], revalidate: 60 } }
      );

      if (res.ok) {
        const json = await res.json();

        // json.data is an array of { namespace, key, locale, value } rows
        // We merge namespace → key → value into the messages object.
        // DB rows win over static file (DB is the source of truth for published content).
        if (json.data && Array.isArray(json.data)) {
          for (const row of json.data) {
            if (!row.namespace || !row.key || row.value === undefined) continue;

            // Ensure namespace bucket exists (don't overwrite if already an object)
            if (!messages[row.namespace] || typeof messages[row.namespace] !== 'object') {
              messages[row.namespace] = {};
            }

            // Handle dotted sub-keys within the namespace
            // e.g. namespace='navigation', key='menu.home' → messages.navigation.menu.home
            setNestedValue(
              messages[row.namespace] as Record<string, unknown>,
              row.key as string,
              row.value as string
            );
          }
        }
      }
    } catch (e) {
      console.warn('[i18n] Failed to fetch dynamic translations — using static file only', e);
    }
  }

  return { locale, messages };
});
