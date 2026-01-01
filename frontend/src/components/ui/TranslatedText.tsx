'use client';

/**
 * TranslatedText Component
 * 
 * A component that automatically displays translated content for dynamic items.
 * Supports menu items, chalets, and any other translatable content from the database.
 * 
 * Usage:
 * <TranslatedText item={menuItem} field="name" />
 * <TranslatedText item={chalet} field="description" as="p" className="text-gray-600" />
 */

import React from 'react';
import { useContentTranslation, TranslatableItem } from '@/lib/translate';

interface TranslatedTextProps {
  item: TranslatableItem;
  field: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  fallback?: string;
}

export function TranslatedText({
  item,
  field,
  as: Component = 'span',
  className,
  fallback = '',
}: TranslatedTextProps) {
  const { translateContent } = useContentTranslation();
  const text = translateContent(item, field) || fallback;
  
  return <Component className={className}>{text}</Component>;
}

/**
 * TranslatedPrice Component
 * 
 * Displays a price in the appropriate format for the current locale
 */
interface TranslatedPriceProps {
  price: number;
  currency?: 'USD' | 'EUR' | 'LBP';
  className?: string;
}

export function TranslatedPrice({
  price,
  currency = 'USD',
  className,
}: TranslatedPriceProps) {
  const { locale } = useContentTranslation();
  
  const formattedPrice = React.useMemo(() => {
    const currencyFormats: Record<string, { symbol: string; position: 'before' | 'after'; decimals: number }> = {
      USD: { symbol: '$', position: 'before', decimals: 2 },
      EUR: { symbol: '€', position: 'after', decimals: 2 },
      LBP: { symbol: 'ل.ل', position: 'after', decimals: 0 },
    };
    
    const format = currencyFormats[currency];
    const formattedNumber = price.toLocaleString(
      locale === 'ar' ? 'ar-LB' : locale === 'fr' ? 'fr-FR' : 'en-US',
      {
        minimumFractionDigits: format.decimals,
        maximumFractionDigits: format.decimals,
      }
    );
    
    if (format.position === 'before') {
      return `${format.symbol}${formattedNumber}`;
    } else {
      return `${formattedNumber} ${format.symbol}`;
    }
  }, [price, currency, locale]);
  
  return <span className={className}>{formattedPrice}</span>;
}

/**
 * Higher-order component to inject translation capabilities
 */
export function withTranslation<P extends object>(
  WrappedComponent: React.ComponentType<P & { translateContent: (item: TranslatableItem, field: string) => string }>
) {
  return function WithTranslationComponent(props: P) {
    const { translateContent } = useContentTranslation();
    return <WrappedComponent {...props} translateContent={translateContent} />;
  };
}

export default TranslatedText;
