/**
 * Seasonal Pricing Service Tests
 *
 * Rewired to test src/services/seasonal-pricing.service.ts.
 * Mocks database/connection + Stripe + logger.
 */


// ── Mock Stripe before service loads ────────────────────────────────────────
const mockStripe = vi.hoisted(() => ({
  prices: { create: vi.fn().mockResolvedValue({ id: 'price_mock' }) },
}));

vi.mock('stripe', () => {
  class MockStripe {
    constructor() {
      return mockStripe;
    }
  }
  return { default: MockStripe };
});

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockChain = vi.hoisted(() => {
  const chain = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    filter: vi.fn(),
  };
  Object.keys(chain).forEach((k) => (chain as any)[k].mockReturnValue(chain));
  return chain;
});

vi.mock('../../src/lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockChain),
  getSupabaseAdmin: vi.fn(() => mockChain),
  supabase: mockChain,
  supabaseAdmin: mockChain,
}));

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

import { seasonalPricingService } from '../../src/services/seasonal-pricing.service.js';

// ─────────────────────────────────────────────────────────────────────────────

const baseRule = {
  id: 'rule-1',
  name: 'Summer Peak',
  start_date: '07-01',
  end_date: '08-31',
  price_multiplier: 1.4,
  applicable_to: ['accommodation_units', 'shared_capacity_access'],
  specific_items: null,
  priority: 10,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockChain).forEach((k) => {
    (mockChain as any)[k].mockReturnValue(mockChain);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getSeasonalRules', () => {
  it('maps snake_case DB rows to camelCase', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [baseRule], error: null });

    const rules = await seasonalPricingService.getSeasonalRules();

    expect(rules).toHaveLength(1);
    expect(rules[0].startDate).toBe('07-01');
    expect(rules[0].endDate).toBe('08-31');
    expect(rules[0].priceMultiplier).toBe(1.4);
    expect(rules[0].isActive).toBe(true);
    expect(mockChain.from).toHaveBeenCalledWith('seasonal_pricing_rules');
  });

  it('returns empty array when no rules exist', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });

    const rules = await seasonalPricingService.getSeasonalRules();
    expect(rules).toEqual([]);
  });

  it('throws when DB returns an error', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    await expect(seasonalPricingService.getSeasonalRules()).rejects.toThrow(
      'Failed to fetch seasonal pricing rules'
    );
  });
});

describe('createSeasonalRule', () => {
  it('inserts a rule and returns it camelCased', async () => {
    const returned = { ...baseRule, id: 'rule-new' };
    mockChain.single.mockResolvedValueOnce({ data: returned, error: null });

    const rule = await seasonalPricingService.createSeasonalRule({
      name: 'Summer Peak',
      startDate: '07-01',
      endDate: '08-31',
      priceMultiplier: 1.4,
      applicableTo: ['accommodation_units', 'shared_capacity_access'],
      priority: 10,
      isActive: true,
    });

    expect(rule.id).toBe('rule-new');
    expect(rule.startDate).toBe('07-01');
    expect(mockChain.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '07-01', price_multiplier: 1.4 })
    );
  });

  it('throws when insertion fails', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    await expect(
      seasonalPricingService.createSeasonalRule({
        name: 'Test',
        startDate: '01-01',
        endDate: '12-31',
        priceMultiplier: 1.2,
        applicableTo: ['shared_capacity_access'],
        priority: 1,
        isActive: true,
      })
    ).rejects.toThrow('Failed to create seasonal pricing rule');
  });
});

describe('updateSeasonalRule', () => {
  it('calls update on the correct table and rule ID', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null });

    await seasonalPricingService.updateSeasonalRule('rule-1', { isActive: false });

    expect(mockChain.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'rule-1');
  });

  it('throws when update fails', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    await expect(
      seasonalPricingService.updateSeasonalRule('rule-1', { isActive: false })
    ).rejects.toThrow('Failed to update seasonal pricing rule');
  });
});

describe('deleteSeasonalRule', () => {
  it('calls delete on the correct rule', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null });

    await seasonalPricingService.deleteSeasonalRule('rule-1');

    expect(mockChain.from).toHaveBeenCalledWith('seasonal_pricing_rules');
    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'rule-1');
  });

  it('throws when delete fails', async () => {
    mockChain.eq.mockResolvedValueOnce({ error: { message: 'delete failed' } });

    await expect(seasonalPricingService.deleteSeasonalRule('rule-1')).rejects.toThrow(
      'Failed to delete seasonal pricing rule'
    );
  });
});

describe('getDynamicPricingConfig', () => {
  it('returns defaults when no config is set (PGRST116)', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });

    const config = await seasonalPricingService.getDynamicPricingConfig();

    expect(config.enabled).toBe(false);
    expect(config.minOccupancyThreshold).toBe(30);
    expect(config.maxOccupancyThreshold).toBe(80);
  });

  it('returns stored config when it exists', async () => {
    const stored = {
      enabled: true,
      minOccupancyThreshold: 25,
      maxOccupancyThreshold: 75,
      minPriceMultiplier: 0.9,
      maxPriceMultiplier: 1.3,
      advanceBookingDays: 14,
      earlyBirdDiscount: 0.05,
      lastMinuteDays: 2,
      lastMinutePremium: 0.1,
    };
    mockChain.single.mockResolvedValueOnce({ data: { value: stored }, error: null });

    const config = await seasonalPricingService.getDynamicPricingConfig();

    expect(config.enabled).toBe(true);
    expect(config.minOccupancyThreshold).toBe(25);
  });

  it('throws on non-PGRST116 DB errors', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'OTHER_ERROR', message: 'db failure' },
    });

    await expect(seasonalPricingService.getDynamicPricingConfig()).rejects.toThrow(
      'Failed to fetch dynamic pricing config'
    );
  });
});

describe('calculatePrice', () => {
  it('returns base price when no active rules match', async () => {
    // getSeasonalRules returns empty
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });
    // weekend_pricing settings
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    // getDynamicPricingConfig (disabled)
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    // Tuesday → not weekend
    const tuesday = new Date('2026-06-16'); // a Tuesday
    const result = await seasonalPricingService.calculatePrice('shared_capacity_access', 'item-1', 100, tuesday);

    expect(result.basePrice).toBe(100);
    expect(result.finalPrice).toBe(100);
    expect(result.appliedRules).toHaveLength(0);
  });

  it('applies a matching seasonal rule', async () => {
    // July 15 matches the summer peak rule (07-01 to 08-31)
    const julyRule = { ...baseRule };
    mockChain.order.mockResolvedValueOnce({ data: [julyRule], error: null });
    // weekend settings (disabled)
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    // dynamic config (disabled)
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    const july15 = new Date('2026-07-15');
    const result = await seasonalPricingService.calculatePrice('shared_capacity_access', 'item-1', 100, july15);

    expect(result.appliedRules).toHaveLength(1);
    expect(result.appliedRules[0].name).toBe('Summer Peak');
    expect(result.appliedRules[0].multiplier).toBe(1.4);
    // 100 base + 40 seasonal adjustment = 140
    expect(result.finalPrice).toBeCloseTo(140, 1);
  });

  it('does not apply rule when item type does not match', async () => {
    // Rule only applies to accommodation_units and pool — test with menu service
    const restrictedRule = { ...baseRule, applicable_to: ['accommodation_units'] };
    mockChain.order.mockResolvedValueOnce({ data: [restrictedRule], error: null });
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    const july15 = new Date('2026-07-15');
    const result = await seasonalPricingService.calculatePrice(
      'instant_transaction',
      'item-1',
      100,
      july15
    );

    expect(result.appliedRules).toHaveLength(0);
    expect(result.finalPrice).toBe(100);
  });

  it('does not apply inactive rule', async () => {
    const inactiveRule = { ...baseRule, is_active: false };
    mockChain.order.mockResolvedValueOnce({ data: [inactiveRule], error: null });
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    const july15 = new Date('2026-07-15');
    const result = await seasonalPricingService.calculatePrice('shared_capacity_access', 'item-1', 100, july15);

    expect(result.appliedRules).toHaveLength(0);
    expect(result.finalPrice).toBe(100);
  });
});
