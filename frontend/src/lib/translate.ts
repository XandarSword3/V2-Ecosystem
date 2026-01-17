/**
 * Dynamic Content Translation Service
 * 
 * This service handles automatic translation of dynamic content (menu items, chalets, etc.)
 * It uses a combination of:
 * 1. Pre-defined translations stored in the database (name_ar, name_fr, description_ar, etc.)
 * 2. Fallback to the default language if translation is not available
 * 
 * Usage:
 * const { translateContent } = useTranslation();
 * const translatedName = translateContent(item, 'name');
 * const translatedDesc = translateContent(item, 'description');
 */

import { useLocale } from 'next-intl';
import { useMemo, useCallback } from 'react';

// Supported locales
export type SupportedLocale = 'en' | 'ar' | 'fr';

// Language suffix mapping
const localeSuffixMap: Record<SupportedLocale, string> = {
  en: '',        // English is the default, no suffix
  ar: '_ar',
  fr: '_fr',
};

/**
 * Interface for translatable content
 * Content should have fields like: name, name_ar, name_fr, description, description_ar, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslatableItem = Record<string, any>;

/**
 * Get translated field from an item
 * @param item - The item to translate
 * @param field - The field name (e.g., 'name', 'description')
 * @param locale - The target locale
 * @returns The translated value or fallback to default
 */
export function getTranslatedField(
  item: TranslatableItem,
  field: string,
  locale: SupportedLocale
): string {
  if (!item) return '';
  
  const suffix = localeSuffixMap[locale] || '';
  const translatedField = `${field}${suffix}`;
  
  // Try to get the translated version
  const translated = item[translatedField];
  if (translated && typeof translated === 'string' && translated.trim()) {
    return translated;
  }
  
  // Fallback to English (no suffix)
  const fallback = item[field];
  if (fallback && typeof fallback === 'string') {
    return fallback;
  }
  
  return '';
}

/**
 * Hook for translating dynamic content
 */
export function useContentTranslation() {
  const localeRaw = useLocale();
  const locale = (localeRaw as SupportedLocale) || 'en';
  
  const translateContent = useCallback(
    (item: TranslatableItem, field: string): string => {
      return getTranslatedField(item, field, locale);
    },
    [locale]
  );
  
  const translateMultiple = useCallback(
    (item: TranslatableItem, fields: string[]): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const field of fields) {
        result[field] = getTranslatedField(item, field, locale);
      }
      return result;
    },
    [locale]
  );
  
  return {
    locale,
    translateContent,
    translateMultiple,
    isRTL: locale === 'ar',
  };
}

/**
 * Translate an array of items
 */
export function translateItems<T extends TranslatableItem>(
  items: T[],
  fields: string[],
  locale: SupportedLocale
): T[] {
  return items.map(item => {
    const translated = { ...item };
    for (const field of fields) {
      // Create a virtual translated field for easy access
      (translated as any)[`translated_${field}`] = getTranslatedField(item, field, locale);
    }
    return translated;
  });
}

/**
 * Format price with currency based on locale
 */
export function formatLocalizedPrice(
  price: number,
  locale: SupportedLocale,
  currency: 'USD' | 'EUR' | 'LBP' = 'USD'
): string {
  const currencyFormats: Record<string, { symbol: string; position: 'before' | 'after'; decimals: number }> = {
    USD: { symbol: '$', position: 'before', decimals: 2 },
    EUR: { symbol: '€', position: 'after', decimals: 2 },
    LBP: { symbol: 'ل.ل', position: 'after', decimals: 0 },
  };
  
  const format = currencyFormats[currency];
  const formattedNumber = price.toLocaleString(locale === 'ar' ? 'ar-LB' : locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals,
  });
  
  if (format.position === 'before') {
    return `${format.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${format.symbol}`;
  }
}

/**
 * Create a translatable item helper
 * Use this when creating new items to ensure all language fields are included
 */
export function createTranslatableItem(
  fields: Record<string, { en: string; ar?: string; fr?: string }>
): TranslatableItem {
  const item: TranslatableItem = {};
  
  for (const [field, translations] of Object.entries(fields)) {
    item[field] = translations.en;
    if (translations.ar) item[`${field}_ar`] = translations.ar;
    if (translations.fr) item[`${field}_fr`] = translations.fr;
  }
  
  return item;
}

export default useContentTranslation;
