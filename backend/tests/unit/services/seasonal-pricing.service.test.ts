
// Mock supabase - use inline definition
vi.mock('../../../src/lib/supabase', () => {
  const mockClient = { from: vi.fn() };
  return {
    supabase: mockClient,
    getSupabase: vi.fn().mockReturnValue(mockClient),
    getSupabaseAdmin: vi.fn(),
  };
});

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
          applicable_to: ['accommodation_units', 'capacity'],
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
        applicableTo: ['accommodation_units', 'capacity'],
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
        applicable_to: ['accommodation_units'],
        specific_items: ['accommodation unit-1'],
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
        applicableTo: ['accommodation_units'],
        specificItems: ['accommodation unit-1'],
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
          applicableTo: ['accommodation_units'],
          priority: 1,
          isActive: true,
        })
      ).rejects.toThrow('Failed to create seasonal pricing rule');
    });
  });

  describe('updateSeasonalRule', () => {
    // One builder serves BOTH queries: ownership fetch (select→eq→single)
    // then the update (update→eq→terminal tenant eq). eq call 1 belongs to
    // the fetch; eq call 2 continues the update chain; eq call 3 is the
    // terminal tenant scope whose resolved value the service awaits.
    const mockUpdateFlow = (updateError: unknown = null) => {
      const terminal = { error: updateError };
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'rule-1', tenant_id: 'tenant-1' }, error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn()
          .mockReturnValueOnce({ single: vi.fn().mockResolvedValue({ data: { id: 'rule-1', tenant_id: 'tenant-1' }, error: null }) })
          .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue(terminal) }),
      };
    };

    it('should update a seasonal rule', async () => {
      vi.mocked(supabase.from).mockReturnValue(mockUpdateFlow() as any);

      await seasonalPricingService.updateSeasonalRule('rule-1', {
        name: 'Updated Name',
        priceMultiplier: 2.0,
        isActive: false,
      }, 'tenant-1');

      expect(supabase.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    });

    it('should handle partial updates', async () => {
      vi.mocked(supabase.from).mockReturnValue(mockUpdateFlow() as any);

      await seasonalPricingService.updateSeasonalRule('rule-1', {
        isActive: false,
      }, 'tenant-1');

      expect(supabase.from).toHaveBeenCalled();
    });

    it('should throw error on update failure', async () => {
      vi.mocked(supabase.from).mockReturnValue(mockUpdateFlow(new Error('Update failed')) as any);

      await expect(
        seasonalPricingService.updateSeasonalRule('rule-1', { name: 'New' }, 'tenant-1')
      ).rejects.toThrow('Failed to update seasonal pricing rule');
    });
  });

  describe('deleteSeasonalRule', () => {
    const mockDeleteFlow = (deleteError: unknown = null) => {
      const terminal = { error: deleteError };
      return {
        select: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn()
          .mockReturnValueOnce({ single: vi.fn().mockResolvedValue({ data: { id: 'rule-1', tenant_id: 'tenant-1' }, error: null }) })
          .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue(terminal) }),
      };
    };

    it('should delete a seasonal rule', async () => {
      vi.mocked(supabase.from).mockReturnValue(mockDeleteFlow() as any);

      await seasonalPricingService.deleteSeasonalRule('rule-1', 'tenant-1');

      expect(supabase.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    });

    it('should throw error on delete failure', async () => {
      vi.mocked(supabase.from).mockReturnValue(mockDeleteFlow(new Error('Delete failed')) as any);

      await expect(seasonalPricingService.deleteSeasonalRule('rule-1', 'tenant-1')).rejects.toThrow(
        'Failed to delete seasonal pricing rule'
      );
    });
  });
});
