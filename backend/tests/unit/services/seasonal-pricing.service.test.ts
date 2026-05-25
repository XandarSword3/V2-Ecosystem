
// Mock supabase - use inline definition
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Stripe properly as a class
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      constructor() {}
    },
  };
});

// Import after mocks
import { seasonalPricingService } from '../../../src/services/seasonal-pricing.service';
import { supabase } from '../../../src/lib/supabase';

describe('SeasonalPricingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSeasonalRules', () => {
    it('should return seasonal rules mapped correctly', async () => {
      const mockData = [
        {
          id: 'rule-1',
          name: 'Summer Peak',
          start_date: '06-01',
          end_date: '08-31',
          price_multiplier: 1.5,
          applicable_to: ['chalets', 'pool'],
          specific_items: null,
          priority: 1,
          is_active: true,
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      } as any);

      const result = await seasonalPricingService.getSeasonalRules();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'rule-1',
        name: 'Summer Peak',
        startDate: '06-01',
        endDate: '08-31',
        priceMultiplier: 1.5,
        applicableTo: ['chalets', 'pool'],
        specificItems: null,
        priority: 1,
        isActive: true,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
        }),
      } as any);

      await expect(seasonalPricingService.getSeasonalRules()).rejects.toThrow(
        'Failed to fetch seasonal pricing rules'
      );
    });
  });

  describe('createSeasonalRule', () => {
    it('should create a new seasonal rule', async () => {
      const mockResult = {
        id: 'new-rule-1',
        name: 'Holiday Season',
        start_date: '12-20',
        end_date: '01-05',
        price_multiplier: 1.8,
        applicable_to: ['chalets'],
        specific_items: ['chalet-1'],
        priority: 2,
        is_active: true,
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
          }),
        }),
      } as any);

      const result = await seasonalPricingService.createSeasonalRule({
        name: 'Holiday Season',
        startDate: '12-20',
        endDate: '01-05',
        priceMultiplier: 1.8,
        applicableTo: ['chalets'],
        specificItems: ['chalet-1'],
        priority: 2,
        isActive: true,
      });

      expect(result.id).toBe('new-rule-1');
      expect(result.name).toBe('Holiday Season');
      expect(result.priceMultiplier).toBe(1.8);
    });

    it('should throw error on insert failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') }),
          }),
        }),
      } as any);

      await expect(
        seasonalPricingService.createSeasonalRule({
          name: 'Test',
          startDate: '01-01',
          endDate: '01-31',
          priceMultiplier: 1.0,
          applicableTo: ['chalets'],
          priority: 1,
          isActive: true,
        })
      ).rejects.toThrow('Failed to create seasonal pricing rule');
    });
  });

  describe('updateSeasonalRule', () => {
    it('should update a seasonal rule', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      await seasonalPricingService.updateSeasonalRule('rule-1', {
        name: 'Updated Name',
        priceMultiplier: 2.0,
        isActive: false,
      });

      expect(supabase.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    });

    it('should handle partial updates', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      await seasonalPricingService.updateSeasonalRule('rule-1', {
        isActive: false,
      });

      expect(supabase.from).toHaveBeenCalled();
    });

    it('should throw error on update failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Update failed') }),
        }),
      } as any);

      await expect(
        seasonalPricingService.updateSeasonalRule('rule-1', { name: 'New' })
      ).rejects.toThrow('Failed to update seasonal pricing rule');
    });
  });

  describe('deleteSeasonalRule', () => {
    it('should delete a seasonal rule', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      await seasonalPricingService.deleteSeasonalRule('rule-1');

      expect(supabase.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    });

    it('should throw error on delete failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
        }),
      } as any);

      await expect(seasonalPricingService.deleteSeasonalRule('rule-1')).rejects.toThrow(
        'Failed to delete seasonal pricing rule'
      );
    });
  });
});
