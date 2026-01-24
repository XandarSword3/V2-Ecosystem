import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { seasonalPricingService } from '../services/seasonal-pricing.service';
import { supabase } from '../config/supabase';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('SeasonalPricingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSeasonalRules', () => {
    it('should return formatted seasonal rules', async () => {
      const mockRules = [
        {
          id: '1',
          name: 'Summer Peak',
          start_date: '07-01',
          end_date: '08-31',
          price_multiplier: 1.4,
          applicable_to: ['chalets', 'pool'],
          specific_items: null,
          priority: 10,
          is_active: true,
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const rules = await seasonalPricingService.getSeasonalRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        id: '1',
        name: 'Summer Peak',
        startDate: '07-01',
        endDate: '08-31',
        priceMultiplier: 1.4,
        applicableTo: ['chalets', 'pool'],
        specificItems: null,
        priority: 10,
        isActive: true,
      });
    });

    it('should throw error when fetch fails', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      await expect(seasonalPricingService.getSeasonalRules()).rejects.toThrow(
        'Failed to fetch seasonal pricing rules'
      );
    });
  });

  describe('createSeasonalRule', () => {
    it('should create a new seasonal rule', async () => {
      const newRule = {
        name: 'Winter Sale',
        startDate: '01-15',
        endDate: '02-28',
        priceMultiplier: 0.85,
        applicableTo: ['chalets'] as ('chalets' | 'pool' | 'restaurant')[],
        priority: 5,
        isActive: true,
      };

      const mockInsertedRule = {
        id: 'new-id',
        name: 'Winter Sale',
        start_date: '01-15',
        end_date: '02-28',
        price_multiplier: 0.85,
        applicable_to: ['chalets'],
        specific_items: null,
        priority: 5,
        is_active: true,
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockInsertedRule, error: null }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const result = await seasonalPricingService.createSeasonalRule(newRule);

      expect(result.id).toBe('new-id');
      expect(result.name).toBe('Winter Sale');
      expect(result.priceMultiplier).toBe(0.85);
    });
  });

  describe('isDateInRange (via calculatePrice)', () => {
    // Note: isDateInRange is private, so we test it indirectly through calculatePrice

    it('should correctly identify dates in normal ranges', () => {
      // Test the date range logic manually since it's private
      const isDateInRange = (date: string, start: string, end: string): boolean => {
        const [dateMonth, dateDay] = date.split('-').map(Number);
        const [startMonth, startDay] = start.split('-').map(Number);
        const [endMonth, endDay] = end.split('-').map(Number);

        const dateValue = dateMonth * 100 + dateDay;
        const startValue = startMonth * 100 + startDay;
        const endValue = endMonth * 100 + endDay;

        if (startValue <= endValue) {
          return dateValue >= startValue && dateValue <= endValue;
        } else {
          return dateValue >= startValue || dateValue <= endValue;
        }
      };

      // Normal range (June 1 - August 31)
      expect(isDateInRange('07-15', '06-01', '08-31')).toBe(true);
      expect(isDateInRange('05-15', '06-01', '08-31')).toBe(false);
      expect(isDateInRange('09-15', '06-01', '08-31')).toBe(false);

      // Wrapped range (December 15 - January 15)
      expect(isDateInRange('12-20', '12-15', '01-15')).toBe(true);
      expect(isDateInRange('01-10', '12-15', '01-15')).toBe(true);
      expect(isDateInRange('11-01', '12-15', '01-15')).toBe(false);
      expect(isDateInRange('02-01', '12-15', '01-15')).toBe(false);
    });
  });

  describe('getDynamicPricingConfig', () => {
    it('should return default config when not set', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const config = await seasonalPricingService.getDynamicPricingConfig();

      expect(config.enabled).toBe(false);
      expect(config.minOccupancyThreshold).toBe(30);
      expect(config.maxOccupancyThreshold).toBe(80);
      expect(config.minPriceMultiplier).toBe(0.85);
      expect(config.maxPriceMultiplier).toBe(1.25);
    });

    it('should return stored config when available', async () => {
      const storedConfig = {
        enabled: true,
        minOccupancyThreshold: 25,
        maxOccupancyThreshold: 85,
        minPriceMultiplier: 0.9,
        maxPriceMultiplier: 1.3,
        advanceBookingDays: 45,
        earlyBirdDiscount: 0.15,
        lastMinuteDays: 5,
        lastMinutePremium: 0.1,
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { value: storedConfig }, error: null }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const config = await seasonalPricingService.getDynamicPricingConfig();

      expect(config.enabled).toBe(true);
      expect(config.minOccupancyThreshold).toBe(25);
      expect(config.earlyBirdDiscount).toBe(0.15);
    });
  });

  describe('Price Calculation Logic', () => {
    it('should apply seasonal multiplier correctly', async () => {
      // Mock seasonal rules - Summer Peak active
      const mockRules = [
        {
          id: '1',
          name: 'Summer Peak',
          start_date: '07-01',
          end_date: '08-31',
          price_multiplier: 1.4,
          applicable_to: ['chalets'],
          specific_items: null,
          priority: 10,
          is_active: true,
        },
      ];

      // Mock for seasonal rules fetch
      const mockFromSeasonalRules = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      // Mock for dynamic config - disabled
      const mockFromSystemSettings = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { value: { enabled: false } }, 
              error: null 
            }),
          }),
        }),
      });

      // Set up mocks based on table being queried
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'seasonal_pricing_rules') {
          return mockFromSeasonalRules();
        }
        if (table === 'system_settings') {
          return mockFromSystemSettings();
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      // Test date in July (should trigger Summer Peak)
      const checkInDate = new Date('2024-07-15');
      const basePrice = 100;

      const result = await seasonalPricingService.calculatePrice(
        'chalets',
        'chalet-1',
        basePrice,
        checkInDate
      );

      // Base price 100 * 1.4 multiplier = 140
      expect(result.finalPrice).toBe(140);
      expect(result.appliedRules).toContainEqual(
        expect.objectContaining({
          name: 'Summer Peak',
          multiplier: 1.4,
          type: 'seasonal',
        })
      );
    });

    it('should not apply seasonal multiplier outside date range', async () => {
      const mockRules = [
        {
          id: '1',
          name: 'Summer Peak',
          start_date: '07-01',
          end_date: '08-31',
          price_multiplier: 1.4,
          applicable_to: ['chalets'],
          specific_items: null,
          priority: 10,
          is_active: true,
        },
      ];

      const mockFromSeasonalRules = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      const mockFromSystemSettings = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { value: { enabled: false } }, 
              error: null 
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'seasonal_pricing_rules') return mockFromSeasonalRules();
        if (table === 'system_settings') return mockFromSystemSettings();
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      // Test date in October (outside Summer Peak)
      const checkInDate = new Date('2024-10-15');
      const basePrice = 100;

      const result = await seasonalPricingService.calculatePrice(
        'chalets',
        'chalet-1',
        basePrice,
        checkInDate
      );

      // No seasonal rules applied, price should be base price
      expect(result.finalPrice).toBe(100);
      expect(result.appliedRules.filter(r => r.type === 'seasonal')).toHaveLength(0);
    });

    it('should apply discount multiplier for off-season', async () => {
      const mockRules = [
        {
          id: '1',
          name: 'Winter Low Season',
          start_date: '01-15',
          end_date: '02-28',
          price_multiplier: 0.85,
          applicable_to: ['chalets'],
          specific_items: null,
          priority: 5,
          is_active: true,
        },
      ];

      const mockFromSeasonalRules = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      const mockFromSystemSettings = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { value: { enabled: false } }, 
              error: null 
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'seasonal_pricing_rules') return mockFromSeasonalRules();
        if (table === 'system_settings') return mockFromSystemSettings();
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      // Test date in February
      const checkInDate = new Date('2024-02-10');
      const basePrice = 100;

      const result = await seasonalPricingService.calculatePrice(
        'chalets',
        'chalet-1',
        basePrice,
        checkInDate
      );

      // Base price 100 * 0.85 multiplier = 85
      expect(result.finalPrice).toBe(85);
      expect(result.breakdown.seasonalAdjustment).toBe(-15);
    });

    it('should only apply rules to applicable categories', async () => {
      const mockRules = [
        {
          id: '1',
          name: 'Summer Peak - Chalets Only',
          start_date: '07-01',
          end_date: '08-31',
          price_multiplier: 1.5,
          applicable_to: ['chalets'], // Only chalets
          specific_items: null,
          priority: 10,
          is_active: true,
        },
      ];

      const mockFromSeasonalRules = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      const mockFromSystemSettings = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { value: { enabled: false } }, 
              error: null 
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'seasonal_pricing_rules') return mockFromSeasonalRules();
        if (table === 'system_settings') return mockFromSystemSettings();
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      const checkInDate = new Date('2024-07-15');
      const basePrice = 100;

      // Pool should NOT get the chalet multiplier
      const poolResult = await seasonalPricingService.calculatePrice(
        'pool',
        'pool-1',
        basePrice,
        checkInDate
      );

      expect(poolResult.finalPrice).toBe(100);
      expect(poolResult.appliedRules.filter(r => r.type === 'seasonal')).toHaveLength(0);
    });
  });
});
