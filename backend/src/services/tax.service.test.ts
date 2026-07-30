import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTaxCategory } from './tax.service.js';
import type { PricingLineItem } from '../engines/types.js';

describe('Tax Service', () => {
  describe('resolveTaxCategory', () => {
    it('should use item metadata override when present', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1,
        metadata: { tax_category: 'food_beverage' }
      };
      const result = resolveTaxCategory(item, 'all');
      expect(result).toBe('food_beverage');
    });

    it('should fall back to module category when no item override', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1,
        metadata: {}
      };
      const result = resolveTaxCategory(item, 'accommodation');
      expect(result).toBe('accommodation');
    });

    it('should default to "all" when neither item override nor module category', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1,
        metadata: {}
      };
      const result = resolveTaxCategory(item);
      expect(result).toBe('all');
    });

    it('should handle missing metadata gracefully', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1
      };
      const result = resolveTaxCategory(item, 'accommodation');
      expect(result).toBe('accommodation');
    });

    it('should handle null metadata gracefully', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1,
        metadata: null as any
      };
      const result = resolveTaxCategory(item, 'accommodation');
      expect(result).toBe('accommodation');
    });

    it('should ignore non-string tax_category in metadata', () => {
      const item: PricingLineItem = {
        itemId: 'item1',
        name: 'Test Item',
        unitPrice: 100,
        quantity: 1,
        metadata: { tax_category: 123 as any }
      };
      const result = resolveTaxCategory(item, 'accommodation');
      expect(result).toBe('accommodation');
    });
  });
});
