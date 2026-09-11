/**
 * Dynamic Content Translation Service
 * 
 * This service handles automatic translation of dynamic content (catalog items, accommodation units, etc.)
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
export type SupportedLocale = 'en' | 'ar' | 'fr' | 'de' | 'it';

// Language suffix mapping
const localeSuffixMap: Record<SupportedLocale, string> = {
  en: '',        // English is the default, no suffix
  ar: '_ar',
  fr: '_fr',
  de: '_de',
  it: '_it',
};

/**
 * Interface for translatable content
 * Content should have fields like: name, name_ar, name_fr, description, description_ar, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslatableItem = Record<string, any>;

/**
 * Known translations dictionary for resort entities, menu items, descriptions, and categories
 * when database records lack explicit localization columns (e.g. name_ar is NULL).
 */
export const dynamicTranslationDictionary: Record<string, Partial<Record<SupportedLocale, string>>> = {
  // Dishes and Menu Items
  'molten belgian dark chocolate lava cake': {
    ar: 'كعكة الشوكولاتة البلجيكية الداكنة الذائبة',
    fr: 'Gâteau fondant au chocolat noir belge',
  },
  'double aged cheddar smash burger': {
    ar: 'برجر سماش شيدر معتق مزدوج',
    fr: 'Smash Burger au cheddar double affiné',
  },
  'wood-fired margherita royale pizza': {
    ar: 'بيتزا مارغريتا رويال على الحطب',
    fr: 'Pizza Margherita Royale au feu de bois',
  },
  'single-origin iced pour over': {
    ar: 'قهوة مقطرة مثلجة أحادية المصدر',
    fr: 'Pour Over glacé d\'origine unique',
  },
  'classic caesar salad': {
    ar: 'سلطة سيزر كلاسيكية',
    fr: 'Salade César classique',
  },

  // Descriptions
  'warm dark chocolate cake with a flowing molten lava core, served with vanilla bean gelato.': {
    ar: 'كعكة شوكولاتة داكنة دافئة بقلب شوكولاتة ذائب سائل، تقدم مع جيلاتو الفانيليا الطبيعية.',
    fr: 'Gâteau tiède au chocolat noir avec cœur coulant, servi avec gelato à la vanille.',
  },
  'warm dark chocolate cake with a flowing molten lava core, served with vanilla bean gelato': {
    ar: 'كعكة شوكولاتة داكنة دافئة بقلب شوكولاتة ذائب سائل، تقدم مع جيلاتو الفانيليا الطبيعية.',
    fr: 'Gâteau tiède au chocolat noir avec cœur coulant, servi avec gelato à la vanille.',
  },
  'two smashed wagyu beef patties, double cheddar cheese, house burger sauce, dill pickles on brioche bun.': {
    ar: 'شريحتا لحم واغيو سماش، جبن شيدر مزدوج، صلصة البرجر الخاصة، مخلل شبت على خبز بريوش.',
    fr: 'Deux steaks de bœuf wagyu smashés, double cheddar, sauce burger maison, cornichons à l\'aneth sur pain brioché.',
  },
  'two smashed wagyu beef patties, double cheddar cheese, house burger sauce, dill pickles on brioche bun': {
    ar: 'شريحتا لحم واغيو سماش، جبن شيدر مزدوج، صلصة البرجر الخاصة، مخلل شبت على خبز بريوش.',
    fr: 'Deux steaks de bœuf wagyu smashés, double cheddar, sauce burger maison, cornichons à l\'aneth sur pain brioché.',
  },
  'san marzano d.o.p. tomato sauce, fresh mozzarella di bufala, extra virgin olive oil, fresh organic basil leaves.': {
    ar: 'صلصة طماطم سان مارزانو، موزاريلا بوفالو طازجة، زيت زيتون بكر ممتاز، أوراق ريحان عضوي طازج.',
    fr: 'Sauce tomate San Marzano D.O.P., mozzarella di bufala fraîche, huile d\'olive extra vierge, basilic bio frais.',
  },
  'san marzano d.o.p. tomato sauce, fresh mozzarella di bufala, extra virgin olive oil, fresh organic basil leaves': {
    ar: 'صلصة طماطم سان مارزانو، موزاريلا بوفالو طازجة، زيت زيتون بكر ممتاز، أوراق ريحان عضوي طازج.',
    fr: 'Sauce tomate San Marzano D.O.P., mozzarella di bufala fraîche, huile d\'olive extra vierge, basilic bio frais.',
  },
  'double shot espresso over bar': {
    ar: 'قهوة مقطرة مثلجة محضرة من حبوب بن مختارة أحادية المصدر مع ثلج نقي.',
    fr: 'Café filtre glacé préparé à partir de grains d\'origine unique avec glaçons purs.',
  },
  'crisp romaine hearts, house caesar': {
    ar: 'قلوب خس روماني مقرمشة، صلصة سيزر خاصة، خبز محمص، جبن بارميزان معتق.',
    fr: 'Cœurs de romaine croquants, sauce césar maison, croûtons, parmesan affiné.',
  },

  // Categories
  'burgers': { ar: 'برجر', fr: 'Burgers' },
  'burger': { ar: 'برجر', fr: 'Burger' },
  'pizza': { ar: 'بيتزا', fr: 'Pizzas' },
  'pizzas': { ar: 'بيتزا', fr: 'Pizzas' },
  'salads': { ar: 'سلطات', fr: 'Salades' },
  'salad': { ar: 'سلطة', fr: 'Salade' },
  'desserts': { ar: 'حلويات', fr: 'Desserts' },
  'dessert': { ar: 'حلوى', fr: 'Dessert' },
  'drinks': { ar: 'مشروبات', fr: 'Boissons' },
  'beverages': { ar: 'مشروبات', fr: 'Boissons' },
  'coffee': { ar: 'قهوة', fr: 'Café' },
  'cocktails': { ar: 'كوكتيلات', fr: 'Cocktails' },
  'starters': { ar: 'مقبلات', fr: 'Entrées' },
  'appetizers': { ar: 'مقبلات', fr: 'Entrées' },
  'main courses': { ar: 'أطباق رئيسية', fr: 'Plats principaux' },
  'mains': { ar: 'أطباق رئيسية', fr: 'Plats principaux' },
  'sides': { ar: 'أطباق جانبية', fr: 'Accompagnements' },
  'snacks': { ar: 'وجبات خفيفة', fr: 'En-cas' },
  'specials': { ar: 'أطباق مميزة', fr: 'Spécialités' },
  'featured dishes': { ar: 'أطباق مميزة', fr: 'Plats en vedette' },
  'all': { ar: 'الكل', fr: 'Tous' },

  // Modules & Navigation Slugs
  'iron paradise gym': { ar: 'نادي آيرون بارادايس الرياضي', fr: 'Iron Paradise Gym' },
  'the ember bar': { ar: 'بار ذا إمبر', fr: 'The Ember Bar' },
  'the-ember-bar': { ar: 'بار ذا إمبر', fr: 'The Ember Bar' },
  'chocolate box': { ar: 'صندوق الشوكولاتة', fr: 'Chocolate Box' },
  'chocolate-box': { ar: 'صندوق الشوكولاتة', fr: 'Chocolate Box' },
  'nexus': { ar: 'نيكسوس', fr: 'Nexus' },
  'pricing': { ar: 'الأسعار', fr: 'Tarifs' },
  'delete': { ar: 'حذف', fr: 'Supprimer' },
  'test': { ar: 'اختبار', fr: 'Test' },
  'gym': { ar: 'نادي رياضي', fr: 'Salle de sport' },
  'spa': { ar: 'المنتجع الصحي', fr: 'Spa' },
  'spa & wellness': { ar: 'المنتجع الصحي والعافية', fr: 'Spa & Bien-être' },
  'cafe': { ar: 'مقهى', fr: 'Café' },
  'pool': { ar: 'المسبح', fr: 'Piscine' },
  'restaurant': { ar: 'المطعم', fr: 'Restaurant' },

  // UI Phrases & Defaults
  'welcome': { ar: 'أهلاً وسهلاً', fr: 'Bienvenue' },
  'hero title': { ar: 'العنوان الرئيسي', fr: 'Titre principal' },
  'discover our services': { ar: 'اكتشف خدماتنا', fr: 'Découvrez nos services' },
  'get started': { ar: 'ابدأ الآن', fr: 'Commencer' },
  'learn more': { ar: 'اعرف المزيد', fr: 'En savoir plus' },
  'quick links': { ar: 'روابط سريعة', fr: 'Liens rapides' },
  'legal': { ar: 'قانوني', fr: 'Mentions légales' },
  'cookie policy': { ar: 'سياسة ملفات تعريف الارتباط', fr: 'Politique relative aux cookies' },
  'privacy policy': { ar: 'سياسة الخصوصية', fr: 'Politique de confidentialité' },
  'terms of service': { ar: 'شروط الخدمة', fr: 'Conditions d\'utilisation' },
  'gift cards': { ar: 'بطاقات الهدايا', fr: 'Cartes-cadeaux' },
};

/**
 * Translate a dynamic string using the fallback dictionary
 */
export function translateDynamicString(
  text: string | null | undefined,
  locale: string
): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed || locale === 'en') return trimmed;

  const normalizedKey = trimmed.toLowerCase();
  const entry = dynamicTranslationDictionary[normalizedKey];
  if (entry) {
    const loc = locale as SupportedLocale;
    if (entry[loc]) {
      return entry[loc]!;
    }
  }

  // Also check substring matches for long descriptions
  if (normalizedKey.length > 20) {
    for (const [key, val] of Object.entries(dynamicTranslationDictionary)) {
      if (key.length > 15 && normalizedKey.includes(key)) {
        const loc = locale as SupportedLocale;
        if (val[loc]) {
          return val[loc]!;
        }
      }
    }
  }

  return trimmed;
}

/**
 * Translate a module name using database columns, dictionary, or fallback
 */
export function getTranslatedModuleName(
  module: { name?: string; slug?: string; name_ar?: string; name_fr?: string } | null | undefined,
  locale: string
): string {
  if (!module) return '';
  if (locale === 'ar' && module.name_ar && module.name_ar.trim()) {
    return module.name_ar.trim();
  }
  if (locale === 'fr' && module.name_fr && module.name_fr.trim()) {
    return module.name_fr.trim();
  }

  const name = module.name || module.slug || '';
  if (!name) return '';

  const translatedName = translateDynamicString(name, locale);
  if (translatedName && translatedName !== name) {
    return translatedName;
  }

  if (module.slug) {
    const translatedSlug = translateDynamicString(module.slug, locale);
    if (translatedSlug && translatedSlug !== module.slug) {
      return translatedSlug;
    }
  }

  return name;
}

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
    const dynamicTranslation = translateDynamicString(fallback, locale);
    if (dynamicTranslation && dynamicTranslation !== fallback) {
      return dynamicTranslation;
    }
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
