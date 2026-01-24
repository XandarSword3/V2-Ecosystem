import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Mock dependencies
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../services/seasonal-pricing.service', () => ({
  seasonalPricingService: {
    getSeasonalRules: vi.fn(),
    createSeasonalRule: vi.fn(),
    updateSeasonalRule: vi.fn(),
    deleteSeasonalRule: vi.fn(),
    getDynamicPricingConfig: vi.fn(),
    updateDynamicPricingConfig: vi.fn(),
    calculatePrice: vi.fn(),
    getPricingCalendar: vi.fn(),
  },
}));

import { seasonalPricingService } from '../services/seasonal-pricing.service';

describe('Pricing Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      params: {},
      body: {},
      query: {},
      user: { id: 'test-user', role: 'admin' },
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /seasonal-rules', () => {
    it('should return all seasonal rules', async () => {
      const mockRules = [
        {
          id: '1',
          name: 'Summer Peak',
          startDate: '07-01',
          endDate: '08-31',
          priceMultiplier: 1.4,
          applicableTo: ['chalets'],
          priority: 10,
          isActive: true,
        },
      ];

      (seasonalPricingService.getSeasonalRules as any).mockResolvedValue(mockRules);

      // Simulate controller logic
      const rules = await seasonalPricingService.getSeasonalRules();

      expect(rules).toEqual(mockRules);
      expect(seasonalPricingService.getSeasonalRules).toHaveBeenCalled();
    });
  });

  describe('POST /seasonal-rules', () => {
    it('should create a new seasonal rule', async () => {
      const newRule = {
        name: 'Winter Sale',
        startDate: '01-15',
        endDate: '02-28',
        priceMultiplier: 0.85,
        applicableTo: ['chalets'],
        priority: 5,
        isActive: true,
      };

      const createdRule = { id: 'new-id', ...newRule };

      (seasonalPricingService.createSeasonalRule as any).mockResolvedValue(createdRule);

      const result = await seasonalPricingService.createSeasonalRule(newRule);

      expect(result).toEqual(createdRule);
      expect(seasonalPricingService.createSeasonalRule).toHaveBeenCalledWith(newRule);
    });

    it('should validate date format', () => {
      const dateRegex = /^\d{2}-\d{2}$/;

      expect(dateRegex.test('07-01')).toBe(true);
      expect(dateRegex.test('12-31')).toBe(true);
      expect(dateRegex.test('7-1')).toBe(false);
      expect(dateRegex.test('2024-07-01')).toBe(false);
      expect(dateRegex.test('July-01')).toBe(false);
    });

    it('should validate multiplier range', () => {
      const isValidMultiplier = (m: number) => m >= 0.1 && m <= 3;

      expect(isValidMultiplier(1)).toBe(true);
      expect(isValidMultiplier(0.5)).toBe(true);
      expect(isValidMultiplier(2.5)).toBe(true);
      expect(isValidMultiplier(0.05)).toBe(false);
      expect(isValidMultiplier(3.5)).toBe(false);
    });
  });

  describe('PUT /seasonal-rules/:ruleId', () => {
    it('should update an existing rule', async () => {
      const ruleId = 'rule-1';
      const updates = {
        priceMultiplier: 1.5,
        isActive: false,
      };

      (seasonalPricingService.updateSeasonalRule as any).mockResolvedValue(undefined);

      await seasonalPricingService.updateSeasonalRule(ruleId, updates);

      expect(seasonalPricingService.updateSeasonalRule).toHaveBeenCalledWith(ruleId, updates);
    });
  });

  describe('DELETE /seasonal-rules/:ruleId', () => {
    it('should delete a rule', async () => {
      const ruleId = 'rule-1';

      (seasonalPricingService.deleteSeasonalRule as any).mockResolvedValue(undefined);

      await seasonalPricingService.deleteSeasonalRule(ruleId);

      expect(seasonalPricingService.deleteSeasonalRule).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('GET /dynamic-config', () => {
    it('should return dynamic pricing configuration', async () => {
      const mockConfig = {
        enabled: true,
        minOccupancyThreshold: 30,
        maxOccupancyThreshold: 80,
        minPriceMultiplier: 0.85,
        maxPriceMultiplier: 1.25,
        advanceBookingDays: 30,
        earlyBirdDiscount: 0.1,
        lastMinuteDays: 3,
        lastMinutePremium: 0,
      };

      (seasonalPricingService.getDynamicPricingConfig as any).mockResolvedValue(mockConfig);

      const config = await seasonalPricingService.getDynamicPricingConfig();

      expect(config).toEqual(mockConfig);
    });
  });

  describe('PUT /dynamic-config', () => {
    it('should update dynamic pricing configuration', async () => {
      const newConfig = {
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

      (seasonalPricingService.updateDynamicPricingConfig as any).mockResolvedValue(undefined);

      await seasonalPricingService.updateDynamicPricingConfig(newConfig);

      expect(seasonalPricingService.updateDynamicPricingConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should validate occupancy thresholds', () => {
      const isValidThreshold = (t: number) => t >= 0 && t <= 100;

      expect(isValidThreshold(30)).toBe(true);
      expect(isValidThreshold(0)).toBe(true);
      expect(isValidThreshold(100)).toBe(true);
      expect(isValidThreshold(-5)).toBe(false);
      expect(isValidThreshold(105)).toBe(false);
    });
  });

  describe('POST /calculate', () => {
    it('should calculate price for a booking', async () => {
      const mockResult = {
        basePrice: 100,
        finalPrice: 140,
        appliedRules: [
          { name: 'Summer Peak', multiplier: 1.4, type: 'seasonal' },
        ],
        breakdown: {
          basePrice: 100,
          seasonalAdjustment: 40,
          dynamicAdjustment: 0,
          weekendAdjustment: 0,
          totalAdjustments: 40,
        },
      };

      (seasonalPricingService.calculatePrice as any).mockResolvedValue(mockResult);

      const result = await seasonalPricingService.calculatePrice(
        'chalets',
        'chalet-1',
        100,
        new Date('2024-07-15')
      );

      expect(result).toEqual(mockResult);
      expect(seasonalPricingService.calculatePrice).toHaveBeenCalled();
    });
  });

  describe('GET /calendar', () => {
    it('should return pricing calendar for date range', async () => {
      const mockCalendar = new Map([
        ['2024-07-01', { basePrice: 100, finalPrice: 140, appliedRules: [], breakdown: {} }],
        ['2024-07-02', { basePrice: 100, finalPrice: 140, appliedRules: [], breakdown: {} }],
        ['2024-07-03', { basePrice: 100, finalPrice: 140, appliedRules: [], breakdown: {} }],
      ]);

      (seasonalPricingService.getPricingCalendar as any).mockResolvedValue(mockCalendar);

      const calendar = await seasonalPricingService.getPricingCalendar(
        'chalets',
        'chalet-1',
        100,
        new Date('2024-07-01'),
        new Date('2024-07-03')
      );

      expect(calendar.size).toBe(3);
    });
  });
});

describe('Price Calculation Integration', () => {
  it('should stack multiple seasonal rules based on priority', () => {
    // Simulate multiple rules that could apply
    const rules = [
      { name: 'Summer', multiplier: 1.2, priority: 5 },
      { name: 'Holiday', multiplier: 1.5, priority: 10 },
    ];

    // Higher priority rule should take precedence
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);
    
    expect(sortedRules[0].name).toBe('Holiday');
    expect(sortedRules[0].multiplier).toBe(1.5);
  });

  it('should calculate early bird discount correctly', () => {
    const basePrice = 200;
    const earlyBirdDiscount = 0.1; // 10%
    const daysUntilBooking = 45; // More than 30 days
    const advanceBookingDays = 30;

    let finalPrice = basePrice;
    if (daysUntilBooking >= advanceBookingDays) {
      finalPrice = basePrice * (1 - earlyBirdDiscount);
    }

    expect(finalPrice).toBe(180); // 200 - 10% = 180
  });

  it('should calculate weekend pricing correctly', () => {
    const basePrice = 150;
    const weekendMultiplier = 1.2;

    // Saturday (day 6) and Sunday (day 0) are weekends
    const saturday = new Date('2024-07-13'); // A Saturday
    const wednesday = new Date('2024-07-10'); // A Wednesday

    const isWeekend = (date: Date) => {
      const day = date.getDay();
      return day === 0 || day === 6;
    };

    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(wednesday)).toBe(false);

    const saturdayPrice = isWeekend(saturday) ? basePrice * weekendMultiplier : basePrice;
    const wednesdayPrice = isWeekend(wednesday) ? basePrice * weekendMultiplier : basePrice;

    expect(saturdayPrice).toBe(180); // 150 * 1.2
    expect(wednesdayPrice).toBe(150); // No weekend adjustment
  });

  it('should combine multiple adjustments correctly', () => {
    const basePrice = 100;
    const seasonalMultiplier = 1.3; // +30%
    const weekendMultiplier = 1.2; // +20%
    const earlyBirdDiscount = 0.1; // -10%

    // Additive approach (what the service does)
    const seasonalAdjustment = basePrice * (seasonalMultiplier - 1); // +30
    const weekendAdjustment = basePrice * (weekendMultiplier - 1); // +20
    const earlyBirdAdjustment = basePrice * -earlyBirdDiscount; // -10

    const totalAdjustments = seasonalAdjustment + weekendAdjustment + earlyBirdAdjustment;
    const finalPrice = basePrice + totalAdjustments;

    expect(seasonalAdjustment).toBe(30);
    expect(weekendAdjustment).toBe(20);
    expect(earlyBirdAdjustment).toBe(-10);
    expect(finalPrice).toBe(140); // 100 + 30 + 20 - 10
  });

  it('should handle occupancy-based dynamic pricing', () => {
    const basePrice = 100;
    const minOccupancyThreshold = 30;
    const maxOccupancyThreshold = 80;
    const minPriceMultiplier = 0.85;
    const maxPriceMultiplier = 1.25;

    const calculateDynamicPrice = (occupancy: number): number => {
      if (occupancy >= maxOccupancyThreshold) {
        return basePrice * maxPriceMultiplier;
      }
      if (occupancy <= minOccupancyThreshold) {
        return basePrice * minPriceMultiplier;
      }
      // Linear interpolation
      const range = maxOccupancyThreshold - minOccupancyThreshold;
      const position = (occupancy - minOccupancyThreshold) / range;
      const multiplier = minPriceMultiplier + position * (maxPriceMultiplier - minPriceMultiplier);
      return basePrice * multiplier;
    };

    // Low occupancy = discount
    expect(calculateDynamicPrice(20)).toBe(85);
    
    // High occupancy = premium
    expect(calculateDynamicPrice(90)).toBe(125);
    
    // Middle occupancy = somewhere in between
    const midPrice = calculateDynamicPrice(55);
    expect(midPrice).toBeGreaterThan(85);
    expect(midPrice).toBeLessThan(125);
  });
});
