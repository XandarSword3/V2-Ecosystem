'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { isRtlLocale, type Locale } from '@/i18n';

/**
 * Component that syncs the HTML dir attribute with the current locale
 * This is necessary because the root layout is server-rendered with a default locale,
 * but the actual locale is determined client-side via cookie
 */
export function DirectionSync() {
  const locale = useLocale() as Locale;

  useEffect(() => {
    const isRtl = isRtlLocale(locale);
    
    // Update document direction
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    
    // Update body font class
    document.body.classList.remove('font-arabic', 'font-sans');
    document.body.classList.add(isRtl ? 'font-arabic' : 'font-sans');
    
    // Update Toaster position by dispatching an event
    window.dispatchEvent(new CustomEvent('directionChange', { detail: { isRtl } }));
  }, [locale]);

  return null;
}
