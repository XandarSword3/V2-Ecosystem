import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxService, resolveTaxCategory, type TaxRate } from '../../../src/services/tax.service.js';
import type { PricingLineItem } from '../../../src/engines/types.js';

// Mock getSupabase and resolveSetting
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/modules/multi-property/settings-resolution.service.js', () => ({
  resolveSetting: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { resolveSetting } from '../../../src/modules/multi-property/settings-resolution.service.js';

describe('TaxService (Unit Tests)', () => {
  let taxService: TaxService;

  beforeEach(() => {
    vi.clearAllMocks();
    taxService = new TaxService();
    taxService.invalidateCache();
    taxService.invalidateModuleCache();
  });

  describe('resolveTaxCategory', () => {
    it('should use item metadata tax_category override when present', () => {
      const item: PricingLineItem = {
        id: 'item-1',
        name: 'Cocktail',
        unitPrice: 15,
        quantity: 2,
        taxCategory: 'beverage',
        metadata: {
          tax_category: 'alcohol_premium',
        },
      };

      const result = resolveTaxCategory(item, 'general');
      expect(result).toBe('alcohol_premium');
    });

    it('should fallback to moduleTaxCategory when metadata override is missing', () => {
      const item: PricingLineItem = {
        id: 'item-2',
        name: 'Spa Towel',
        unitPrice: 10,
        quantity: 1,
        taxCategory: 'retail',
      };

      const result = resolveTaxCategory(item, 'spa_service');
      expect(result).toBe('spa_service');
    });

    it('should fallback to "all" when moduleTaxCategory is empty or undefined', () => {
      const item: PricingLineItem = {
        id: 'item-3',
        name: 'Unknown',
        unitPrice: 5,
        quantity: 1,
      };

      const result = resolveTaxCategory(item, '');
      expect(result).toBe('all');
    });
  });

  describe('getTaxConfiguration', () => {
    it('should return property-scoped configuration from resolveSetting when present', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'rate-prop',
          name: 'City Tourism Tax',
          rate: 5,
          type: 'tourism',
          applies_to: ['all'],
          is_default: true,
          is_compound: false,
          order: 1,
        },
      ];

      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 5,
          tax_included_in_price: false,
          show_tax_breakdown: true,
          rounding_method: 'round',
          decimal_places: 2,
          rates: mockRates,
        },
        source: 'property',
      } as any);

      const config = await taxService.getTaxConfiguration('prop-123');
      expect(config.default_rate).toBe(5);
      expect(config.rates).toHaveLength(1);
      expect(config.rates[0].id).toBe('rate-prop');
      expect(resolveSetting).toHaveBeenCalledWith('prop-123', 'tax_configuration', {});
    });

    it('should fallback to site_settings when property setting has no rates', async () => {
      vi.mocked(resolveSetting).mockResolvedValue({
        value: {},
        source: 'default',
      } as any);

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          value: {
            default_rate: 10,
            tax_included_in_price: true,
            show_tax_breakdown: true,
            rounding_method: 'round',
            decimal_places: 2,
            rates: [
              {
                id: 'rate-site',
                name: 'National VAT',
                rate: 10,
                type: 'vat',
                applies_to: ['all'],
                is_default: true,
                is_compound: false,
                order: 1,
              },
            ],
          },
        },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as any);

      const config = await taxService.getTaxConfiguration('prop-empty');
      expect(config.default_rate).toBe(10);
      expect(config.rates[0].id).toBe('rate-site');
    });

    it('should return empty configuration when database returns error or empty data', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Settings row not found'),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      } as any);

      const config = await taxService.getTaxConfiguration();
      expect(config.default_rate).toBe(0);
      expect(config.rates).toEqual([]);
    });

    it('should fallback to default config when config structure is invalid', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          value: {
            default_rate: 15,
            rates: 'not-an-array',
          },
        },
        error: null,
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      } as any);

      const config = await taxService.getTaxConfiguration();
      expect(config.rates).toHaveLength(1);
      expect(config.rates[0].id).toBe('default');
    });
  });

  describe('computeTaxBreakdown', () => {
    it('should compute non-compound and compound taxes in deterministic order', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'vat-standard',
          name: 'Standard VAT',
          rate: 10,
          type: 'vat',
          fee_type: 'tax',
          applies_to: ['all'],
          is_default: true,
          is_compound: false,
          order: 1,
        },
        {
          id: 'city-surcharge',
          name: 'City Compound Surcharge',
          rate: 5,
          type: 'sales',
          fee_type: 'tax',
          applies_to: ['all'],
          is_default: false,
          is_compound: true,
          order: 2,
        },
      ];

      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 10,
          tax_included_in_price: false,
          show_tax_breakdown: true,
          rounding_method: 'round',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const lineItems: PricingLineItem[] = [
        {
          id: 'item-1',
          name: 'Standard Room',
          unitPrice: 100,
          quantity: 2,
        },
      ];

      // Base subtotal = 200
      // Non-compound VAT (10% of 200) = 20
      // Compound Surcharge (5% of 200 + 20 = 5% of 220) = 11
      const breakdown = await taxService.computeTaxBreakdown(lineItems, 200, undefined, undefined, 'prop-1');

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]).toEqual({
        id: 'vat-standard',
        name: 'Standard VAT',
        rate: 10,
        amount: 20,
        type: 'vat',
      });
      expect(breakdown[1]).toEqual({
        id: 'city-surcharge',
        name: 'City Compound Surcharge',
        rate: 5,
        amount: 11,
        type: 'sales',
      });
    });

    it('should respect category scoping (applies_to)', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'alcohol-tax',
          name: 'Alcohol Tax',
          rate: 20,
          type: 'vat',
          fee_type: 'tax',
          applies_to: ['alcohol'],
          is_default: false,
          is_compound: false,
          order: 1,
        },
        {
          id: 'food-tax',
          name: 'Food Tax',
          rate: 5,
          type: 'vat',
          fee_type: 'tax',
          applies_to: ['food'],
          is_default: false,
          is_compound: false,
          order: 1,
        },
      ];

      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 0,
          rounding_method: 'round',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const lineItems: PricingLineItem[] = [
        {
          id: 'item-1',
          name: 'Wine',
          unitPrice: 50,
          quantity: 1,
          taxCategory: 'alcohol',
        },
        {
          id: 'item-2',
          name: 'Pasta',
          unitPrice: 20,
          quantity: 2,
          taxCategory: 'food',
        },
      ];

      // alcohol: 50 * 20% = 10
      // food: 40 * 5% = 2
      const breakdown = await taxService.computeTaxBreakdown(lineItems, 90, undefined, undefined, 'prop-cat');

      expect(breakdown).toHaveLength(2);
      const alcoholItem = breakdown.find((b) => b.id === 'alcohol-tax');
      const foodItem = breakdown.find((b) => b.id === 'food-tax');

      expect(alcoholItem?.amount).toBe(10);
      expect(foodItem?.amount).toBe(2);
    });

    it('should filter taxes based on payment method', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'card-surcharge-tax',
          name: 'Credit Card Processing Tax',
          rate: 2.5,
          type: 'service',
          fee_type: 'tax',
          applies_to: ['all'],
          payment_methods: ['credit_card'],
          is_default: false,
          is_compound: false,
          order: 1,
        },
      ];

      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 0,
          rounding_method: 'round',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const lineItems: PricingLineItem[] = [
        { id: 'item-1', name: 'Service', unitPrice: 100, quantity: 1 },
      ];

      // Cash payment should NOT match credit_card
      const cashBreakdown = await taxService.computeTaxBreakdown(lineItems, 100, undefined, 'cash', 'prop-pm');
      expect(cashBreakdown).toHaveLength(0);

      // Card payment (mapped to credit_card) should match
      const cardBreakdown = await taxService.computeTaxBreakdown(lineItems, 100, undefined, 'card', 'prop-pm');
      expect(cardBreakdown).toHaveLength(1);
      expect(cardBreakdown[0].amount).toBe(2.5);
    });
  });

  describe('computeFeeBreakdown', () => {
    it('should calculate fees other than tax (service charges, resort fees)', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'tax-1',
          name: 'Sales Tax',
          rate: 8,
          type: 'sales',
          fee_type: 'tax',
          applies_to: ['all'],
          is_default: true,
          is_compound: false,
          order: 1,
        },
        {
          id: 'fee-resort',
          name: 'Resort Fee',
          rate: 10,
          type: 'service',
          fee_type: 'resort_fee',
          applies_to: ['all'],
          is_default: false,
          is_compound: false,
          order: 1,
        },
      ];

      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 0,
          rounding_method: 'round',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const lineItems: PricingLineItem[] = [
        { id: 'item-1', name: 'Cabin Stay', unitPrice: 200, quantity: 1 },
      ];

      const feeBreakdown = await taxService.computeFeeBreakdown(lineItems, undefined, undefined, 'prop-fee');
      expect(feeBreakdown).toHaveLength(1);
      expect(feeBreakdown[0]).toEqual({
        id: 'fee-resort',
        type: 'resort_fee',
        name: 'Resort Fee',
        amount: 20,
        rate: 10,
      });
    });
  });

  describe('rounding strategies', () => {
    it('should support floor and ceil rounding methods', async () => {
      const mockRates: TaxRate[] = [
        {
          id: 'tax-rate',
          name: 'Split Tax',
          rate: 3.333,
          type: 'sales',
          fee_type: 'tax',
          applies_to: ['all'],
          is_default: true,
          is_compound: false,
          order: 1,
        },
      ];

      // 100 * 3.333% = 3.333
      // round -> 3.33
      // ceil -> 3.34
      // floor -> 3.33
      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 0,
          rounding_method: 'ceil',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const lineItems: PricingLineItem[] = [
        { id: 'item-1', name: 'Ticket', unitPrice: 100, quantity: 1 },
      ];

      const ceilBreakdown = await taxService.computeTaxBreakdown(lineItems, 100, undefined, undefined, 'prop-ceil');
      expect(ceilBreakdown[0].amount).toBe(3.34);

      taxService.invalidateCache();
      vi.mocked(resolveSetting).mockResolvedValue({
        value: {
          default_rate: 0,
          rounding_method: 'floor',
          decimal_places: 2,
          rates: mockRates,
        },
      } as any);

      const floorBreakdown = await taxService.computeTaxBreakdown(lineItems, 100, undefined, undefined, 'prop-floor');
      expect(floorBreakdown[0].amount).toBe(3.33);
    });
  });

  describe('updateTaxConfiguration', () => {
    it('should upsert into site_settings and clear cache', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          value: {
            default_rate: 5,
            rates: [],
          },
        },
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          upsert: mockUpsert,
        }),
      } as any);

      await taxService.updateTaxConfiguration({
        default_rate: 12,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'tax_configuration',
          value: expect.objectContaining({
            default_rate: 12,
          }),
        }),
        { onConflict: 'key' }
      );
    });
  });
});
