import { createMockReqRes } from '../utils';

// Mock the revenue service
vi.mock('../../../src/modules/revenue/revenue.service', () => ({
  revenueManagementService: {
    generateForecasts: vi.fn(),
    getForecasts: vi.fn(),
    getPricingRules: vi.fn(),
    createPricingRule: vi.fn(),
    updatePricingRule: vi.fn(),
    deletePricingRule: vi.fn(),
    getCompetitorRates: vi.fn(),
    addCompetitorRate: vi.fn(),
    getOccupancyForecast: vi.fn(),
    getDemandAnalysis: vi.fn(),
    getRevenuePerformance: vi.fn(),
    getPriceRecommendations: vi.fn(),
    applyPriceRecommendation: vi.fn(),
    getSeasonalPatterns: vi.fn(),
    createSeason: vi.fn(),
    updateSeason: vi.fn(),
    calculateDynamicRate: vi.fn(),
    calculateRatesForRange: vi.fn(),
    getPricingCalendar: vi.fn(),
    updatePricingCalendar: vi.fn(),
    bulkUpdatePricingCalendar: vi.fn(),
    generateRecommendations: vi.fn(),
    getRecommendations: vi.fn(),
    respondToRecommendation: vi.fn(),
    getMarketEvents: vi.fn(),
    createMarketEvent: vi.fn(),
    updateMarketEvent: vi.fn(),
    deleteMarketEvent: vi.fn(),
    recordCompetitorRate: vi.fn(),
    getSeasonalityPatterns: vi.fn(),
    createSeasonalityPattern: vi.fn(),
    updateSeasonalityPattern: vi.fn(),
    getYieldManagementLog: vi.fn(),
    getRevenueSummary: vi.fn(),
    getRevenueByRoomType: vi.fn(),
  }
}));

import { RevenueController } from '../../../src/modules/revenue/revenue.controller';
import { revenueManagementService } from '../../../src/modules/revenue/revenue.service';

describe('Revenue Controller', () => {
  let controller: RevenueController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new RevenueController();
  });

  describe('generateForecasts', () => {
    it('should generate forecasts', async () => {
      vi.mocked(revenueManagementService.generateForecasts).mockResolvedValue(30);

      const { req, res, next } = createMockReqRes({
        body: { startDate: '2024-01-01', endDate: '2024-01-31' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.generateForecasts(req, res, next);

      expect(revenueManagementService.generateForecasts).toHaveBeenCalledWith(
        'prop-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'Forecasts generated', count: 30 });
    });

    it('should return 400 if property ID is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { startDate: '2024-01-01', endDate: '2024-01-31' }
      });

      await controller.generateForecasts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property ID required' });
    });

    it('should call next on error', async () => {
      const error = new Error('Service error');
      vi.mocked(revenueManagementService.generateForecasts).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        body: { startDate: '2024-01-01', endDate: '2024-01-31' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.generateForecasts(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getForecasts', () => {
    it('should return forecasts', async () => {
      const mockForecasts = [
        { date: '2024-01-01', demand: 85, price: 199 },
        { date: '2024-01-02', demand: 90, price: 219 }
      ];
      vi.mocked(revenueManagementService.getForecasts).mockResolvedValue(mockForecasts);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-01-01', endDate: '2024-01-07', roomTypeId: 'rt-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getForecasts(req, res, next);

      expect(revenueManagementService.getForecasts).toHaveBeenCalledWith(
        'prop-1',
        new Date('2024-01-01'),
        new Date('2024-01-07'),
        'rt-1'
      );
      expect(res.json).toHaveBeenCalledWith({ forecasts: mockForecasts });
    });

    it('should use default dates when not provided', async () => {
      vi.mocked(revenueManagementService.getForecasts).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({
        query: {}
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getForecasts(req, res, next);

      expect(revenueManagementService.getForecasts).toHaveBeenCalled();
    });
  });

  describe('getPricingRules', () => {
    it('should return pricing rules', async () => {
      const mockRules = [
        { id: 'rule-1', name: 'Weekend Premium', multiplier: 1.2 },
        { id: 'rule-2', name: 'Low Occupancy', multiplier: 0.9 }
      ];
      vi.mocked(revenueManagementService.getPricingRules).mockResolvedValue(mockRules);

      const { req, res, next } = createMockReqRes({
        query: { activeOnly: 'true' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getPricingRules(req, res, next);

      expect(revenueManagementService.getPricingRules).toHaveBeenCalledWith('prop-1', true);
      expect(res.json).toHaveBeenCalledWith({ rules: mockRules });
    });

    it('should include inactive rules when requested', async () => {
      vi.mocked(revenueManagementService.getPricingRules).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({
        query: { activeOnly: 'false' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getPricingRules(req, res, next);

      expect(revenueManagementService.getPricingRules).toHaveBeenCalledWith('prop-1', false);
    });
  });

  describe('createPricingRule', () => {
    it('should create a pricing rule', async () => {
      const mockRule = { id: 'rule-new', name: 'Holiday Surge', multiplier: 1.5 };
      vi.mocked(revenueManagementService.createPricingRule).mockResolvedValue(mockRule);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Holiday Surge', multiplier: 1.5, conditions: [] },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.createPricingRule(req, res, next);

      expect(revenueManagementService.createPricingRule).toHaveBeenCalledWith(
        'prop-1',
        req.body,
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ rule: mockRule });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Test Rule' }
      });

      await controller.createPricingRule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property ID required' });
    });
  });

  describe('updatePricingRule', () => {
    it('should update a pricing rule', async () => {
      vi.mocked(revenueManagementService.updatePricingRule).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rule-1' },
        body: { multiplier: 1.3 }
      });

      await controller.updatePricingRule(req, res, next);

      expect(revenueManagementService.updatePricingRule).toHaveBeenCalledWith('rule-1', { multiplier: 1.3 });
      expect(res.json).toHaveBeenCalledWith({ message: 'Rule updated' });
    });

    it('should call next on error', async () => {
      const error = new Error('Update failed');
      vi.mocked(revenueManagementService.updatePricingRule).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rule-1' },
        body: {}
      });

      await controller.updatePricingRule(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deletePricingRule', () => {
    it('should delete a pricing rule', async () => {
      vi.mocked(revenueManagementService.deletePricingRule).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rule-1' }
      });

      await controller.deletePricingRule(req, res, next);

      expect(revenueManagementService.deletePricingRule).toHaveBeenCalledWith('rule-1');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should call next on error', async () => {
      const error = new Error('Delete failed');
      vi.mocked(revenueManagementService.deletePricingRule).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rule-1' }
      });

      await controller.deletePricingRule(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('calculateRate', () => {
    it('should calculate dynamic rate', async () => {
      const mockResult = { baseRate: 100, finalRate: 120, adjustments: [{ name: 'Weekend', multiplier: 1.2 }] };
      vi.mocked(revenueManagementService.calculateDynamicRate).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        query: { roomTypeId: 'rt-1', date: '2024-06-15' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.calculateRate(req, res, next);

      expect(revenueManagementService.calculateDynamicRate).toHaveBeenCalledWith(
        'prop-1',
        'rt-1',
        new Date('2024-06-15')
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 if missing required params', async () => {
      const { req, res, next } = createMockReqRes({
        query: { roomTypeId: 'rt-1' } // Missing date
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.calculateRate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('calculateRatesForRange', () => {
    it('should calculate rates for a date range', async () => {
      const mockRates = [
        { date: '2024-06-15', rate: 120 },
        { date: '2024-06-16', rate: 130 }
      ];
      vi.mocked(revenueManagementService.calculateRatesForRange).mockResolvedValue(mockRates);

      const { req, res, next } = createMockReqRes({
        query: { roomTypeId: 'rt-1', startDate: '2024-06-15', endDate: '2024-06-16' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.calculateRatesForRange(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ rates: mockRates });
    });

    it('should return 400 if missing required params', async () => {
      const { req, res, next } = createMockReqRes({
        query: { roomTypeId: 'rt-1' } // Missing dates
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.calculateRatesForRange(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPricingCalendar', () => {
    it('should return pricing calendar', async () => {
      const mockCalendar = [{ date: '2024-06-15', baseRate: 100, finalRate: 120 }];
      vi.mocked(revenueManagementService.getPricingCalendar).mockResolvedValue(mockCalendar);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30', roomTypeId: 'rt-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getPricingCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ calendar: mockCalendar });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getPricingCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updatePricingCalendar', () => {
    it('should update pricing calendar entry', async () => {
      vi.mocked(revenueManagementService.updatePricingCalendar).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { roomTypeId: 'rt-1', date: '2024-06-15' },
        body: { overrideRate: 150 },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.updatePricingCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Calendar updated' });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        params: { roomTypeId: 'rt-1', date: '2024-06-15' },
        body: {}
      });

      await controller.updatePricingCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bulkUpdatePricingCalendar', () => {
    it('should bulk update pricing calendar', async () => {
      vi.mocked(revenueManagementService.bulkUpdatePricingCalendar).mockResolvedValue(7);

      const { req, res, next } = createMockReqRes({
        body: { roomTypeId: 'rt-1', startDate: '2024-06-15', endDate: '2024-06-21', overrideRate: 150 },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.bulkUpdatePricingCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Calendar updated', daysUpdated: 7 });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await controller.bulkUpdatePricingCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate price recommendations', async () => {
      const mockRecommendations = [{ roomTypeId: 'rt-1', suggestedRate: 150 }];
      vi.mocked(revenueManagementService.generateRecommendations).mockResolvedValue(mockRecommendations);

      const { req, res, next } = createMockReqRes({
        body: { date: '2024-06-15' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.generateRecommendations(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ recommendations: mockRecommendations });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await controller.generateRecommendations(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getRecommendations', () => {
    it('should return pending recommendations', async () => {
      const mockRecommendations = [{ id: 'rec-1', status: 'pending' }];
      vi.mocked(revenueManagementService.getRecommendations).mockResolvedValue(mockRecommendations);

      const { req, res, next } = createMockReqRes({
        query: { status: 'pending' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getRecommendations(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ recommendations: mockRecommendations });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getRecommendations(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('respondToRecommendation', () => {
    it('should accept a recommendation', async () => {
      vi.mocked(revenueManagementService.respondToRecommendation).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rec-1' },
        body: { status: 'accepted', notes: 'Approved' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await controller.respondToRecommendation(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Recommendation processed' });
    });

    it('should reject a recommendation', async () => {
      vi.mocked(revenueManagementService.respondToRecommendation).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'rec-1' },
        body: { status: 'rejected', notes: 'Too aggressive' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await controller.respondToRecommendation(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Recommendation processed' });
    });

    it('should return 400 for invalid status', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'rec-1' },
        body: { status: 'maybe' }
      });

      await controller.respondToRecommendation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMarketEvents', () => {
    it('should return market events', async () => {
      const mockEvents = [{ id: 'ev-1', name: 'Festival', startDate: '2024-06-15' }];
      vi.mocked(revenueManagementService.getMarketEvents).mockResolvedValue(mockEvents);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getMarketEvents(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ events: mockEvents });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getMarketEvents(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createMarketEvent', () => {
    it('should create a market event', async () => {
      const mockEvent = { id: 'ev-new', name: 'Conference' };
      vi.mocked(revenueManagementService.createMarketEvent).mockResolvedValue(mockEvent);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Conference', startDate: '2024-06-15', impact: 'high' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.createMarketEvent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ event: mockEvent });
    });

    it('should create a global market event', async () => {
      const mockEvent = { id: 'ev-new', name: 'Holiday', isGlobal: true };
      vi.mocked(revenueManagementService.createMarketEvent).mockResolvedValue(mockEvent);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Holiday', isGlobal: true },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.createMarketEvent(req, res, next);

      // Should pass null for propertyId when isGlobal is true
      expect(revenueManagementService.createMarketEvent).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        'user-1'
      );
    });
  });

  describe('updateMarketEvent', () => {
    it('should update a market event', async () => {
      vi.mocked(revenueManagementService.updateMarketEvent).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ev-1' },
        body: { name: 'Updated Conference' }
      });

      await controller.updateMarketEvent(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Event updated' });
    });
  });

  describe('deleteMarketEvent', () => {
    it('should delete a market event', async () => {
      vi.mocked(revenueManagementService.deleteMarketEvent).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'ev-1' }
      });

      await controller.deleteMarketEvent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('recordCompetitorRate', () => {
    it('should record a competitor rate', async () => {
      vi.mocked(revenueManagementService.recordCompetitorRate).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: { competitorName: 'Rival Hotel', date: '2024-06-15', rate: 199 }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.recordCompetitorRate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Competitor rate recorded' });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await controller.recordCompetitorRate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCompetitorRates', () => {
    it('should return competitor rates', async () => {
      const mockRates = [{ competitor: 'Rival Hotel', date: '2024-06-15', rate: 199 }];
      vi.mocked(revenueManagementService.getCompetitorRates).mockResolvedValue(mockRates);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getCompetitorRates(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ rates: mockRates });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getCompetitorRates(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSeasonalityPatterns', () => {
    it('should return seasonality patterns', async () => {
      const mockPatterns = [{ id: 'pat-1', name: 'Summer', multiplier: 1.3 }];
      vi.mocked(revenueManagementService.getSeasonalityPatterns).mockResolvedValue(mockPatterns);

      const { req, res, next } = createMockReqRes({});
      req.headers['x-property-id'] = 'prop-1';

      await controller.getSeasonalityPatterns(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ patterns: mockPatterns });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({});

      await controller.getSeasonalityPatterns(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createSeasonalityPattern', () => {
    it('should create a seasonality pattern', async () => {
      const mockPattern = { id: 'pat-new', name: 'Autumn', multiplier: 0.9 };
      vi.mocked(revenueManagementService.createSeasonalityPattern).mockResolvedValue(mockPattern);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Autumn', multiplier: 0.9 }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.createSeasonalityPattern(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ pattern: mockPattern });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await controller.createSeasonalityPattern(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateSeasonalityPattern', () => {
    it('should update a seasonality pattern', async () => {
      vi.mocked(revenueManagementService.updateSeasonalityPattern).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'pat-1' },
        body: { multiplier: 1.1 }
      });

      await controller.updateSeasonalityPattern(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Pattern updated' });
    });
  });

  describe('getYieldLog', () => {
    it('should return yield management log', async () => {
      const mockLog = [{ id: 'log-1', actionType: 'rate_change', diff: 20 }];
      vi.mocked(revenueManagementService.getYieldManagementLog).mockResolvedValue(mockLog);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30', actionType: 'rate_change' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getYieldLog(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ log: mockLog });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getYieldLog(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getRevenueSummary', () => {
    it('should return revenue summary', async () => {
      const mockSummary = { totalRevenue: 50000, avgDailyRate: 150, occupancy: 0.75 };
      vi.mocked(revenueManagementService.getRevenueSummary).mockResolvedValue(mockSummary);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getRevenueSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockSummary);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getRevenueSummary(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getRevenueByRoomType', () => {
    it('should return revenue breakdown by room type', async () => {
      const mockBreakdown = [{ roomType: 'Deluxe', revenue: 20000 }];
      vi.mocked(revenueManagementService.getRevenueByRoomType).mockResolvedValue(mockBreakdown);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-06-01', endDate: '2024-06-30' }
      });
      req.headers['x-property-id'] = 'prop-1';

      await controller.getRevenueByRoomType(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ breakdown: mockBreakdown });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await controller.getRevenueByRoomType(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
