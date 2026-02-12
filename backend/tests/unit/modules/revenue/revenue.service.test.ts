import { describe, it, expect, vi, beforeEach } from 'vitest';

// Storage for mock data
let mockRoomTypes: Array<Record<string, unknown>> = [];
let mockForecasts: Array<Record<string, unknown>> = [];
let mockPricingRules: Array<Record<string, unknown>> = [];
let mockMarketEvents: Array<Record<string, unknown>> = [];
let mockPricingCalendar: Array<Record<string, unknown>> = [];
let mockRecommendations: Array<Record<string, unknown>> = [];
let mockCompetitorRates: Array<Record<string, unknown>> = [];
let mockBookings: Array<Record<string, unknown>> = [];

// Create a chainable query mock
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  
  // All chainable methods return the same object
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'range', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'like'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  
  // Make the object thenable (awaitable)
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  
  // single() returns the first item
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ 
      data: firstItem, 
      error: firstItem ? null : { code: 'PGRST116' }
    });
  });
  
  // maybeSingle() returns the first item or null (no error)
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  
  // insert returns an object that can be chained
  mockObj.insert = vi.fn().mockImplementation((insertData) => {
    const insertResult = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: Array.isArray(insertData) 
            ? insertData.map((d: unknown, i: number) => ({ id: `new-item-${i}`, ...(d as object) }))
            : { id: 'new-item-1', ...insertData }, 
          error: null 
        })
      }),
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: insertData, error: null });
        return Promise.resolve({ data: insertData, error: null });
      }
    };
    return insertResult;
  });
  
  // upsert returns a promise directly
  mockObj.upsert = vi.fn().mockImplementation((upsertData) => {
    return Promise.resolve({ data: upsertData, error: null });
  });
  
  // update returns a chainable object with eq() methods
  mockObj.update = vi.fn().mockImplementation((updateData) => {
    const updateChain: Record<string, unknown> = {};
    const chainUpdateMethods = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or'];
    chainUpdateMethods.forEach(method => {
      updateChain[method] = vi.fn().mockReturnValue(updateChain);
    });
    updateChain.select = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ 
        data: { id: 'item-1', ...updateData }, 
        error: null 
      })
    });
    updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    return updateChain;
  });
  
  // delete returns an object with eq() method
  mockObj.delete = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockImplementation(() => ({
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      }
    }))
  }));
  
  return mockObj;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'room_types':
        return createQueryMock(() => mockRoomTypes);
      case 'demand_forecasts':
        return createQueryMock(() => mockForecasts);
      case 'pricing_rules':
        return createQueryMock(() => mockPricingRules);
      case 'market_events':
        return createQueryMock(() => mockMarketEvents);
      case 'pricing_calendar':
        return createQueryMock(() => mockPricingCalendar);
      case 'rate_recommendations':
        return createQueryMock(() => mockRecommendations);
      case 'competitor_rates':
        return createQueryMock(() => mockCompetitorRates);
      case 'bookings':
        return createQueryMock(() => mockBookings);
      default:
        return createQueryMock(() => []);
    }
  })
};

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { RevenueManagementService } from '../../../../src/modules/revenue/revenue.service';

describe('RevenueManagementService', () => {
  let service: RevenueManagementService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomTypes = [];
    mockForecasts = [];
    mockPricingRules = [];
    mockMarketEvents = [];
    mockPricingCalendar = [];
    mockRecommendations = [];
    mockCompetitorRates = [];
    mockBookings = [];
    service = new RevenueManagementService();
  });

  // ============================================
  // DEMAND FORECASTING
  // ============================================

  describe('generateForecasts', () => {
    it('should generate forecasts for each room type and day', async () => {
      mockRoomTypes = [
        { id: 'room-1', base_rate: 100 },
        { id: 'room-2', base_rate: 150 }
      ];
      mockBookings = [];

      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-02');
      
      const count = await service.generateForecasts('property-1', startDate, endDate);
      
      expect(count).toBeGreaterThan(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('room_types');
    });

    it('should return 0 when no room types exist', async () => {
      mockRoomTypes = [];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-02');
      
      const count = await service.generateForecasts('property-1', startDate, endDate);
      
      expect(count).toBe(0);
    });
  });

  describe('getForecasts', () => {
    it('should return empty array when no forecasts exist', async () => {
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-07');
      
      const forecasts = await service.getForecasts('property-1', startDate, endDate);
      
      expect(forecasts).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith('demand_forecasts');
    });

    it('should return forecasts for date range', async () => {
      mockForecasts = [
        {
          forecast_date: '2026-03-01',
          room_type_id: 'room-1',
          forecasted_demand: 10,
          forecasted_occupancy: 80,
          forecasted_adr: 120,
          forecasted_revenue: 12000,
          demand_low: 8,
          demand_high: 12,
          factors: {}
        }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-07');
      
      const forecasts = await service.getForecasts('property-1', startDate, endDate);
      
      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].forecastedDemand).toBe(10);
    });

    it('should filter by room type if provided', async () => {
      mockForecasts = [
        { forecast_date: '2026-03-01', room_type_id: 'room-1', forecasted_demand: 10, forecasted_occupancy: 80, demand_low: 8, demand_high: 12, factors: {} }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-07');
      
      const forecasts = await service.getForecasts('property-1', startDate, endDate, 'room-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('demand_forecasts');
    });
  });

  describe('updateForecastActuals', () => {
    it('should update forecast with actual data', async () => {
      mockForecasts = [
        { id: 'forecast-1', forecast_date: '2026-03-01', room_type_id: 'room-1', forecasted_demand: 10 }
      ];
      mockBookings = [];
      
      await service.updateForecastActuals('property-1', new Date('2026-03-01'));
      
      expect(mockSupabase.from).toHaveBeenCalledWith('demand_forecasts');
    });
  });

  // ============================================
  // PRICING RULES
  // ============================================

  describe('getPricingRules', () => {
    it('should return empty array when no rules exist', async () => {
      const rules = await service.getPricingRules('property-1');
      
      expect(rules).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });

    it('should return pricing rules for property', async () => {
      mockPricingRules = [
        {
          id: 'rule-1',
          name: 'Weekend Surge',
          rule_type: 'day_of_week',
          adjustment_type: 'percentage',
          adjustment_value: 20,
          priority: 1,
          is_active: true,
          conditions: { days: [5, 6] }
        }
      ];
      
      const rules = await service.getPricingRules('property-1');
      
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('Weekend Surge');
    });

    it('should filter by active status', async () => {
      mockPricingRules = [
        { id: 'rule-1', name: 'Active Rule', is_active: true },
        { id: 'rule-2', name: 'Inactive Rule', is_active: false }
      ];
      
      // Get only active rules (default)
      await service.getPricingRules('property-1', true);
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
      
      // Get all rules
      await service.getPricingRules('property-1', false);
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });
  });

  describe('createPricingRule', () => {
    it('should create a new pricing rule', async () => {
      const newRule = {
        name: 'Holiday Pricing',
        ruleType: 'event',
        adjustmentType: 'percentage' as const,
        adjustmentValue: 30,
        conditions: { eventType: 'holiday' }
      };
      
      const result = await service.createPricingRule('property-1', newRule, 'user-1');
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });

    it('should create rule with all optional fields', async () => {
      const newRule = {
        name: 'Complex Rule',
        description: 'A complex pricing rule',
        ruleType: 'occupancy',
        roomTypeIds: ['room-1', 'room-2'],
        ratePlanIds: ['plan-1'],
        conditions: { minOccupancy: 80 },
        adjustmentType: 'multiplier' as const,
        adjustmentValue: 1.5,
        minRate: 50,
        maxRate: 500,
        priority: 5,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-12-31'),
        isActive: true
      };
      
      const result = await service.createPricingRule('property-1', newRule, 'user-1');
      
      expect(result).toBeDefined();
    });
  });

  describe('updatePricingRule', () => {
    it('should update an existing pricing rule', async () => {
      mockPricingRules = [{ id: 'rule-1', name: 'Old Name', adjustment_value: 10 }];
      
      await service.updatePricingRule('rule-1', { name: 'New Name', adjustmentValue: 25 });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });
  });

  describe('deletePricingRule', () => {
    it('should delete a pricing rule', async () => {
      await service.deletePricingRule('rule-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules');
    });
  });

  // ============================================
  // DYNAMIC PRICING
  // ============================================

  describe('calculateDynamicRate', () => {
    it('should calculate dynamic rate for a room type', async () => {
      mockRoomTypes = [{ id: 'room-1', base_rate: 100 }];
      mockForecasts = [{ forecast_date: '2026-03-15', forecasted_occupancy: 75, demand_low: 8, demand_high: 12, factors: {} }];
      mockPricingRules = [];
      mockMarketEvents = [];
      
      const result = await service.calculateDynamicRate(
        'property-1',
        'room-1',
        new Date('2026-03-15')
      );
      
      expect(result).toBeDefined();
      expect(result.baseRate).toBeDefined();
      expect(result.finalRate).toBeDefined();
    });

    it('should apply pricing rules', async () => {
      mockRoomTypes = [{ id: 'room-1', base_rate: 100 }];
      mockForecasts = [];
      mockPricingRules = [
        {
          id: 'rule-1',
          name: 'Test Rule',
          rule_type: 'occupancy',
          adjustment_type: 'percentage',
          adjustment_value: 20,
          is_active: true,
          conditions: { minOccupancy: 0, maxOccupancy: 100 }
        }
      ];
      mockMarketEvents = [];
      
      const result = await service.calculateDynamicRate(
        'property-1',
        'room-1',
        new Date('2026-03-15')
      );
      
      expect(result).toBeDefined();
    });
  });

  describe('calculateRatesForRange', () => {
    it('should calculate rates for a date range', async () => {
      mockRoomTypes = [{ id: 'room-1', base_rate: 100 }];
      mockForecasts = [];
      mockPricingRules = [];
      mockMarketEvents = [];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-03');
      
      const results = await service.calculateRatesForRange(
        'property-1',
        'room-1',
        startDate,
        endDate
      );
      
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================
  // PRICING CALENDAR
  // ============================================

  describe('getPricingCalendar', () => {
    it('should return pricing calendar for date range', async () => {
      mockPricingCalendar = [
        { calendar_date: '2026-03-01', room_type_id: 'room-1', rate: 120 }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-07');
      
      const calendar = await service.getPricingCalendar('property-1', startDate, endDate);
      
      expect(calendar).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_calendar');
    });
  });

  describe('updatePricingCalendar', () => {
    it('should update pricing calendar entry', async () => {
      await service.updatePricingCalendar(
        'property-1',
        'room-1',
        new Date('2026-03-15'),
        {
          rate: 150,
          isManualOverride: true
        },
        'user-1'
      );
      
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_calendar');
    });
  });

  describe('bulkUpdatePricingCalendar', () => {
    it('should update multiple calendar entries', async () => {
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-03');
      
      const count = await service.bulkUpdatePricingCalendar(
        'property-1',
        'room-1',
        startDate,
        endDate,
        { overrideRate: 150, overrideReason: 'Bulk update' },
        'user-1'
      );
      
      expect(count).toBe(3); // 3 days
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_calendar');
    });
  });

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  describe('generateRecommendations', () => {
    it('should generate rate recommendations', async () => {
      mockRoomTypes = [{ id: 'room-1', base_rate: 100 }];
      mockForecasts = [
        { forecast_date: '2026-03-15', room_type_id: 'room-1', forecasted_occupancy: 90, demand_low: 8, demand_high: 12, factors: {} }
      ];
      mockPricingCalendar = [];
      mockCompetitorRates = [];
      
      const recommendations = await service.generateRecommendations('property-1', new Date('2026-03-15'));
      
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getRecommendations', () => {
    it('should return pending recommendations', async () => {
      mockRecommendations = [
        {
          id: 'rec-1',
          recommendation_date: '2026-03-15',
          room_type_id: 'room-1',
          current_rate: 100,
          recommended_rate: 120,
          reason_code: 'high_demand',
          reasoning: 'High occupancy forecasted',
          status: 'pending'
        }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-31');
      
      const recommendations = await service.getRecommendations('property-1', startDate, endDate);
      
      expect(recommendations).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('rate_recommendations');
    });
  });

  describe('respondToRecommendation', () => {
    it('should accept a recommendation', async () => {
      mockRecommendations = [
        { 
          id: 'rec-1', 
          recommended_rate: 120, 
          room_type_id: 'room-1', 
          property_id: 'property-1',
          date: '2026-03-15',
          current_rate: 100,
          reasoning: 'High demand',
          reason_code: 'high_demand'
        }
      ];
      
      await service.respondToRecommendation('rec-1', 'accepted', 'user-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('rate_recommendations');
    });

    it('should reject a recommendation', async () => {
      mockRecommendations = [
        { 
          id: 'rec-1', 
          recommended_rate: 120, 
          room_type_id: 'room-1', 
          property_id: 'property-1',
          date: '2026-03-15',
          current_rate: 100,
          reasoning: 'High demand',
          reason_code: 'high_demand'
        }
      ];
      
      await service.respondToRecommendation('rec-1', 'rejected', 'user-1', 'Too aggressive');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('rate_recommendations');
    });

    it('should handle reject action correctly', async () => {
      mockRecommendations = [
        { 
          id: 'rec-2', 
          recommended_rate: 150, 
          room_type_id: 'room-2', 
          property_id: 'property-1',
          date: '2026-03-20',
          current_rate: 120,
          reasoning: 'Weekend demand',
          reason_code: 'weekend_surge'
        }
      ];
      
      // This should work without error
      await service.respondToRecommendation('rec-2', 'rejected', 'user-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('rate_recommendations');
    });
  });

  // ============================================
  // MARKET EVENTS
  // ============================================

  describe('getMarketEvents', () => {
    it('should return market events for date range', async () => {
      mockMarketEvents = [
        {
          id: 'event-1',
          name: 'Music Festival',
          event_type: 'concert',
          start_date: '2026-03-15',
          end_date: '2026-03-17',
          expected_demand_impact: 50,
          expected_rate_impact: 30
        }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-31');
      
      const events = await service.getMarketEvents('property-1', startDate, endDate);
      
      expect(events).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('market_events');
    });
  });

  describe('createMarketEvent', () => {
    it('should create a new market event', async () => {
      const newEvent = {
        name: 'Tech Conference',
        eventType: 'conference',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-03'),
        expectedDemandImpact: 40,
        expectedRateImpact: 25,
        description: 'Annual technology conference',
        location: 'Convention Center',
        expectedAttendance: 5000
      };
      
      const result = await service.createMarketEvent('property-1', newEvent);
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('market_events');
    });
  });

  describe('updateMarketEvent', () => {
    it('should update an existing market event', async () => {
      await service.updateMarketEvent('event-1', {
        name: 'Updated Event Name',
        expectedDemandImpact: 60
      });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('market_events');
    });
  });

  describe('deleteMarketEvent', () => {
    it('should delete a market event', async () => {
      await service.deleteMarketEvent('event-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('market_events');
    });
  });

  // ============================================
  // COMPETITOR RATES
  // ============================================

  describe('recordCompetitorRate', () => {
    it('should record a competitor rate', async () => {
      await service.recordCompetitorRate(
        'property-1',
        'Rival Hotel',
        new Date('2026-03-15'),
        140,
        { competitorSource: 'OTA', roomTypeName: 'Standard' }
      );
      
      expect(mockSupabase.from).toHaveBeenCalledWith('competitor_rates');
    });
  });

  describe('getCompetitorRates', () => {
    it('should return competitor rates for date range', async () => {
      mockCompetitorRates = [
        {
          id: 'comp-1',
          competitor_name: 'Rival Hotel',
          rate: 140,
          room_type: 'Standard',
          rate_date: '2026-03-15',
          source: 'OTA'
        }
      ];
      
      const startDate = new Date('2026-03-01');
      const endDate = new Date('2026-03-31');
      
      const rates = await service.getCompetitorRates('property-1', startDate, endDate);
      
      expect(rates).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('competitor_rates');
    });
  });
});
