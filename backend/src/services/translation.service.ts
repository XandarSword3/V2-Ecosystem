// Auto-translation service using LibreTranslate API (free and self-hosted)
// Falls back to basic translation mappings if API is unavailable

import { logger } from '../utils/logger.js';

const LIBRE_TRANSLATE_URL = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com/translate';
const LIBRE_TRANSLATE_KEY = process.env.LIBRE_TRANSLATE_KEY || '';

interface TranslationResult {
  en: string;
  ar: string;
  fr: string;
}

// Basic translation cache to avoid repeated API calls
const translationCache = new Map<string, TranslationResult>();

// Common words/phrases translation mapping for fallback
const fallbackTranslations: Record<string, { ar: string; fr: string }> = {
  // Food items
  'hummus': { ar: 'حمص', fr: 'houmous' },
  'falafel': { ar: 'فلافل', fr: 'falafel' },
  'shawarma': { ar: 'شاورما', fr: 'shawarma' },
  'kebab': { ar: 'كباب', fr: 'kebab' },
  'tabbouleh': { ar: 'تبولة', fr: 'taboulé' },
  'fattoush': { ar: 'فتوش', fr: 'fatouche' },
  'kibbeh': { ar: 'كبة', fr: 'kebbé' },
  'baklava': { ar: 'بقلاوة', fr: 'baklava' },
  'coffee': { ar: 'قهوة', fr: 'café' },
  'tea': { ar: 'شاي', fr: 'thé' },
  'juice': { ar: 'عصير', fr: 'jus' },
  'water': { ar: 'ماء', fr: 'eau' },
  'sandwich': { ar: 'ساندويتش', fr: 'sandwich' },
  'salad': { ar: 'سلطة', fr: 'salade' },
  'soup': { ar: 'شوربة', fr: 'soupe' },
  'grilled': { ar: 'مشوي', fr: 'grillé' },
  'fresh': { ar: 'طازج', fr: 'frais' },
  'traditional': { ar: 'تقليدي', fr: 'traditionnel' },
  'delicious': { ar: 'لذيذ', fr: 'délicieux' },
  // Common descriptions
  'served with': { ar: 'يقدم مع', fr: 'servi avec' },
  'fresh vegetables': { ar: 'خضروات طازجة', fr: 'légumes frais' },
  'homemade': { ar: 'منزلي', fr: 'fait maison' },
  'chef special': { ar: 'خاص الشيف', fr: 'spécial du chef' },
  // Sizes
  'small': { ar: 'صغير', fr: 'petit' },
  'medium': { ar: 'وسط', fr: 'moyen' },
  'large': { ar: 'كبير', fr: 'grand' },
  // Categories
  'appetizers': { ar: 'المقبلات', fr: 'entrées' },
  'main courses': { ar: 'الأطباق الرئيسية', fr: 'plats principaux' },
  'desserts': { ar: 'الحلويات', fr: 'desserts' },
  'beverages': { ar: 'المشروبات', fr: 'boissons' },
  'drinks': { ar: 'مشروبات', fr: 'boissons' },
  'snacks': { ar: 'وجبات خفيفة', fr: 'collations' },
};

export async function translateText(text: string, sourceLang: string = 'en'): Promise<TranslationResult> {
  // Check cache first
  const cacheKey = `${text}-${sourceLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const result: TranslationResult = {
    en: sourceLang === 'en' ? text : text,
    ar: '',
    fr: '',
  };

  // Try API translation
  try {
    if (sourceLang !== 'ar') {
      result.ar = await callTranslateAPI(text, sourceLang, 'ar');
    } else {
      result.ar = text;
    }

    if (sourceLang !== 'fr') {
      result.fr = await callTranslateAPI(text, sourceLang, 'fr');
    } else {
      result.fr = text;
    }

    if (sourceLang !== 'en') {
      result.en = await callTranslateAPI(text, sourceLang, 'en');
    }
  } catch (error) {
    logger.warn('[TRANSLATION] API failed, using fallback:', error);
    // Fallback to basic translation
    const fallback = fallbackTranslations[text.toLowerCase()];
    if (fallback) {
      result.ar = fallback.ar;
      result.fr = fallback.fr;
    } else {
      // Return original text with language indicators
      result.ar = result.ar || text;
      result.fr = result.fr || text;
    }
  }

  // Cache the result
  translationCache.set(cacheKey, result);
  return result;
}

async function callTranslateAPI(text: string, source: string, target: string): Promise<string> {
  // Skip if text is empty or very short
  if (!text || text.length < 2) return text;

  const response = await fetch(LIBRE_TRANSLATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      api_key: LIBRE_TRANSLATE_KEY || undefined,
    }),
  });

  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      // Ignore - bodyText will remain empty if response body can't be read
    }
    throw new Error(`Translation API error: ${response.status} ${bodyText}`);
  }

  const data = await response.json() as { translatedText?: string };
  return data.translatedText || text;
}

// Batch translate multiple texts at once
export async function batchTranslate(texts: string[], sourceLang: string = 'en'): Promise<TranslationResult[]> {
  return Promise.all(texts.map(text => translateText(text, sourceLang)));
}

// Helper to create a translatable item (for menu items, chalets, etc.)
export function createTranslatableFields<T extends Record<string, any>>(
  item: T,
  translations: TranslationResult,
  fieldName: string
): T {
  return {
    ...item,
    [fieldName]: translations.en,
    [`${fieldName}_ar`]: translations.ar,
    [`${fieldName}_fr`]: translations.fr,
  };
}

export default {
  translateText,
  batchTranslate,
  createTranslatableFields,
};
