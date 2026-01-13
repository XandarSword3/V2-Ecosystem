/**
 * Auto-translation service supporting multiple providers:
 * 
 * 1. GOOGLE TRANSLATE (Recommended - Most Reliable)
 *    - Set GOOGLE_TRANSLATE_API_KEY in your .env
 *    - Get an API key from: https://console.cloud.google.com/apis/credentials
 *    - Enable "Cloud Translation API" in your Google Cloud project
 *    - Cost: ~$20 per 1 million characters
 * 
 * 2. LIBRE TRANSLATE (Free / Self-Hosted)
 *    - Set LIBRE_TRANSLATE_URL and optionally LIBRE_TRANSLATE_KEY
 *    - Public API: https://libretranslate.com (rate limited, may require key)
 *    - Self-hosted: https://github.com/LibreTranslate/LibreTranslate
 * 
 * 3. FALLBACK (No API Required)
 *    - Uses built-in dictionary for common hospitality terms
 *    - Limited vocabulary, returns original text for unknown phrases
 */

import { logger } from '../utils/logger.js';

// Provider configuration
const TRANSLATION_PROVIDER = process.env.TRANSLATION_PROVIDER || 'auto'; // 'google', 'libre', 'fallback', 'auto'
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || '';
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

/**
 * Determine which translation provider to use
 */
function getActiveProvider(): 'google' | 'libre' | 'fallback' {
  if (TRANSLATION_PROVIDER === 'google' && GOOGLE_TRANSLATE_API_KEY) {
    return 'google';
  }
  if (TRANSLATION_PROVIDER === 'libre') {
    return 'libre';
  }
  if (TRANSLATION_PROVIDER === 'fallback') {
    return 'fallback';
  }
  // Auto-detect: prefer Google if key exists, then Libre, then fallback
  if (GOOGLE_TRANSLATE_API_KEY) {
    return 'google';
  }
  if (LIBRE_TRANSLATE_KEY || LIBRE_TRANSLATE_URL !== 'https://libretranslate.com/translate') {
    return 'libre';
  }
  return 'fallback';
}

/**
 * Call the appropriate translation API based on configuration
 */
async function callTranslateAPI(text: string, source: string, target: string): Promise<string> {
  // Skip if text is empty or very short
  if (!text || text.length < 2) return text;

  const provider = getActiveProvider();
  
  if (provider === 'fallback') {
    // Use fallback dictionary
    const fallback = fallbackTranslations[text.toLowerCase()];
    if (fallback) {
      return target === 'ar' ? fallback.ar : fallback.fr;
    }
    logger.debug(`[TRANSLATION] No fallback for "${text}", returning original`);
    return text;
  }

  if (provider === 'google') {
    return callGoogleTranslateAPI(text, source, target);
  }

  return callLibreTranslateAPI(text, source, target);
}

/**
 * Google Cloud Translation API v2
 */
async function callGoogleTranslateAPI(text: string, source: string, target: string): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: 'text',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
    throw new Error(`Google Translate API error: ${response.status} - ${errorMsg}`);
  }

  const data = await response.json() as { 
    data?: { translations?: Array<{ translatedText?: string }> } 
  };
  
  return data?.data?.translations?.[0]?.translatedText || text;
}

/**
 * LibreTranslate API (free / self-hosted)
 */
async function callLibreTranslateAPI(text: string, source: string, target: string): Promise<string> {
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
    throw new Error(`LibreTranslate API error: ${response.status} ${bodyText}`);
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

/**
 * Get the current translation service status
 */
export function getTranslationStatus(): {
  provider: string;
  configured: boolean;
  apiKeySet: boolean;
  message: string;
} {
  const provider = getActiveProvider();
  
  if (provider === 'google') {
    return {
      provider: 'Google Translate',
      configured: true,
      apiKeySet: true,
      message: 'Google Translate API is configured and ready',
    };
  }
  
  if (provider === 'libre') {
    const hasKey = !!LIBRE_TRANSLATE_KEY;
    const isCustomUrl = LIBRE_TRANSLATE_URL !== 'https://libretranslate.com/translate';
    return {
      provider: 'LibreTranslate',
      configured: true,
      apiKeySet: hasKey || isCustomUrl,
      message: isCustomUrl 
        ? `Using custom LibreTranslate at ${LIBRE_TRANSLATE_URL}`
        : hasKey 
          ? 'LibreTranslate API key configured'
          : 'Using public LibreTranslate (may be rate limited)',
    };
  }
  
  return {
    provider: 'Fallback Dictionary',
    configured: false,
    apiKeySet: false,
    message: 'No translation API configured. Using built-in dictionary (limited vocabulary). Set GOOGLE_TRANSLATE_API_KEY or LIBRE_TRANSLATE_KEY in your .env file for full auto-translation.',
  };
}

export default {
  translateText,
  batchTranslate,
  createTranslatableFields,
  getTranslationStatus,
};
