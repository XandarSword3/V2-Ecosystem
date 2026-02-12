/**
 * Tests for translation utilities
 */
import { describe, it, expect } from 'vitest';
import {
  getTranslatedField,
  translateItems,
  formatLocalizedPrice,
  createTranslatableItem,
  type SupportedLocale,
} from '@/lib/translate';

describe('getTranslatedField', () => {
  const item = {
    name: 'Grilled Chicken',
    name_ar: 'دجاج مشوي',
    name_fr: 'Poulet Grillé',
    description: 'Juicy grilled chicken',
    description_ar: 'دجاج مشوي لذيذ',
  };

  it('returns English value for "en" locale (no suffix)', () => {
    expect(getTranslatedField(item, 'name', 'en')).toBe('Grilled Chicken');
  });

  it('returns Arabic value for "ar" locale', () => {
    expect(getTranslatedField(item, 'name', 'ar')).toBe('دجاج مشوي');
  });

  it('returns French value for "fr" locale', () => {
    expect(getTranslatedField(item, 'name', 'fr')).toBe('Poulet Grillé');
  });

  it('falls back to English when translation is missing', () => {
    expect(getTranslatedField(item, 'description', 'fr')).toBe('Juicy grilled chicken');
  });

  it('returns empty string for null/undefined item', () => {
    expect(getTranslatedField(null as any, 'name', 'en')).toBe('');
    expect(getTranslatedField(undefined as any, 'name', 'en')).toBe('');
  });

  it('returns empty string for missing field', () => {
    expect(getTranslatedField(item, 'price', 'en')).toBe('');
  });

  it('returns empty string for empty translated field', () => {
    const itemWithEmpty = { name: 'Test', name_ar: '  ' };
    expect(getTranslatedField(itemWithEmpty, 'name', 'ar')).toBe('Test');
  });

  it('falls back to English for unknown locale suffix', () => {
    expect(getTranslatedField(item, 'name', 'de')).toBe('Grilled Chicken');
  });
});

describe('translateItems', () => {
  const items = [
    { id: 1, name: 'Pizza', name_ar: 'بيتزا', price: 10 },
    { id: 2, name: 'Burger', name_ar: 'برغر', price: 8 },
  ];

  it('adds translated_ prefixed fields to each item', () => {
    const result = translateItems(items, ['name'], 'ar');
    expect(result[0]).toHaveProperty('translated_name', 'بيتزا');
    expect(result[1]).toHaveProperty('translated_name', 'برغر');
  });

  it('preserves original items', () => {
    const result = translateItems(items, ['name'], 'ar');
    expect(result[0].name).toBe('Pizza');
    expect(result[0].price).toBe(10);
  });

  it('handles multiple fields', () => {
    const itemsWithDesc = [
      { id: 1, name: 'Pizza', name_fr: 'Pizza', description: 'Cheesy', description_fr: 'Fromagé' },
    ];
    const result = translateItems(itemsWithDesc, ['name', 'description'], 'fr');
    expect(result[0]).toHaveProperty('translated_name', 'Pizza');
    expect(result[0]).toHaveProperty('translated_description', 'Fromagé');
  });

  it('does not modify original array', () => {
    const original = [...items];
    translateItems(items, ['name'], 'ar');
    expect(items).toEqual(original);
  });
});

describe('formatLocalizedPrice', () => {
  it('formats USD price with $ symbol before', () => {
    const result = formatLocalizedPrice(25.99, 'en');
    expect(result).toContain('$');
    expect(result).toContain('25.99');
  });

  it('formats EUR price with € symbol after', () => {
    const result = formatLocalizedPrice(25.99, 'en', 'EUR');
    expect(result).toContain('€');
    expect(result).toContain('25.99');
  });

  it('formats LBP price without decimals', () => {
    const result = formatLocalizedPrice(1000, 'en', 'LBP');
    expect(result).toContain('ل.ل');
    // LBP should have 0 decimal places (the dot in ل.ل is part of the symbol, not a decimal)
    const numberPart = result.replace('ل.ل', '').trim();
    expect(numberPart).not.toContain('.');
  });

  it('formats zero correctly', () => {
    const result = formatLocalizedPrice(0, 'en');
    expect(result).toBe('$0.00');
  });

  it('uses Arabic locale for ar', () => {
    const result = formatLocalizedPrice(25, 'ar', 'USD');
    expect(result).toContain('$');
  });
});

describe('createTranslatableItem', () => {
  it('creates item with English field', () => {
    const item = createTranslatableItem({
      name: { en: 'Pizza' },
    });
    expect(item.name).toBe('Pizza');
  });

  it('creates item with Arabic translation', () => {
    const item = createTranslatableItem({
      name: { en: 'Pizza', ar: 'بيتزا' },
    });
    expect(item.name).toBe('Pizza');
    expect(item.name_ar).toBe('بيتزا');
  });

  it('creates item with multiple languages', () => {
    const item = createTranslatableItem({
      name: { en: 'Pizza', ar: 'بيتزا', fr: 'Pizza' },
      description: { en: 'Delicious', fr: 'Délicieux' },
    });
    expect(item.name).toBe('Pizza');
    expect(item.name_ar).toBe('بيتزا');
    expect(item.name_fr).toBe('Pizza');
    expect(item.description).toBe('Delicious');
    expect(item.description_fr).toBe('Délicieux');
    expect(item.description_ar).toBeUndefined();
  });
});
