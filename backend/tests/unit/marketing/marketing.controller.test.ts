import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock the marketing service
vi.mock('../../../src/modules/marketing/marketing.service', () => ({
  marketingAutomationService: {
    createSegment: vi.fn(),
    getSegments: vi.fn(),
    getSegmentMembers: vi.fn(),
    calculateSegmentMembers: vi.fn(),
    addToSegment: vi.fn(),
    removeFromSegment: vi.fn(),
    createTemplate: vi.fn(),
    getTemplates: vi.fn(),
    updateTemplate: vi.fn(),
    duplicateTemplate: vi.fn(),
    createJourney: vi.fn(),
    getJourneys: vi.fn(),
    getJourneyWithSteps: vi.fn(),
    activateJourney: vi.fn(),
    pauseJourney: vi.fn(),
    enrollInJourney: vi.fn(),
    createCampaign: vi.fn(),
    getCampaigns: vi.fn(),
    getCampaignAnalytics: vi.fn(),
    sendCampaign: vi.fn(),
    scheduleCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
    createAutomation: vi.fn(),
    getAutomations: vi.fn(),
    triggerAutomation: vi.fn(),
    trackOpen: vi.fn(),
    trackClick: vi.fn(),
    trackUnsubscribe: vi.fn(),
    createPromoCode: vi.fn(),
    validatePromoCode: vi.fn(),
  }
}));

import * as marketingController from '../../../src/modules/marketing/marketing.controller';
import { marketingAutomationService } from '../../../src/modules/marketing/marketing.service';

describe('Marketing Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSegment', () => {
    it('should create a new segment', async () => {
      const mockSegment = {
        id: 'seg-1',
        name: 'VIP Guests',
        property_id: 'prop-1',
        rules: [{ field: 'total_stays', operator: 'gte', value: 10 }]
      };
      vi.mocked(marketingAutomationService.createSegment).mockResolvedValue(mockSegment);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {
          name: 'VIP Guests',
          rules: [{ field: 'total_stays', operator: 'gte', value: 10 }],
          description: 'Frequent guests',
          segmentType: 'dynamic'
        }
      });

      await marketingController.createSegment(req, res, next);

      expect(marketingAutomationService.createSegment).toHaveBeenCalledWith(
        'prop-1',
        'VIP Guests',
        [{ field: 'total_stays', operator: 'gte', value: 10 }],
        'Frequent guests',
        'dynamic'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSegment,
        message: 'Segment created successfully'
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Creation failed');
      vi.mocked(marketingAutomationService.createSegment).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Test' }
      });

      await marketingController.createSegment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSegments', () => {
    it('should return all segments for a property', async () => {
      const mockSegments = [
        { id: 'seg-1', name: 'VIP Guests' },
        { id: 'seg-2', name: 'New Guests' }
      ];
      vi.mocked(marketingAutomationService.getSegments).mockResolvedValue(mockSegments);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await marketingController.getSegments(req, res, next);

      expect(marketingAutomationService.getSegments).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSegments,
        count: 2
      });
    });
  });

  describe('getSegmentMembers', () => {
    it('should return segment members with pagination', async () => {
      const mockMembers = [
        { id: 'guest-1', name: 'John Doe' },
        { id: 'guest-2', name: 'Jane Doe' }
      ];
      vi.mocked(marketingAutomationService.getSegmentMembers).mockResolvedValue(mockMembers);

      const { req, res, next } = createMockReqRes({
        params: { segmentId: 'seg-1' },
        query: { limit: '50', offset: '0' }
      });

      await marketingController.getSegmentMembers(req, res, next);

      expect(marketingAutomationService.getSegmentMembers).toHaveBeenCalledWith('seg-1', 50, 0);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockMembers,
        count: 2
      });
    });

    it('should use default pagination values', async () => {
      vi.mocked(marketingAutomationService.getSegmentMembers).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({
        params: { segmentId: 'seg-1' },
        query: {}
      });

      await marketingController.getSegmentMembers(req, res, next);

      expect(marketingAutomationService.getSegmentMembers).toHaveBeenCalledWith('seg-1', 100, 0);
    });
  });

  describe('calculateSegmentMembers', () => {
    it('should return segment member count', async () => {
      vi.mocked(marketingAutomationService.calculateSegmentMembers).mockResolvedValue(150);

      const { req, res, next } = createMockReqRes({
        params: { segmentId: 'seg-1' }
      });

      await marketingController.calculateSegmentMembers(req, res, next);

      expect(marketingAutomationService.calculateSegmentMembers).toHaveBeenCalledWith('seg-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { memberCount: 150 }
      });
    });
  });

  describe('addToSegment', () => {
    it('should add guests to segment', async () => {
      vi.mocked(marketingAutomationService.addToSegment).mockResolvedValue(5);

      const { req, res, next } = createMockReqRes({
        params: { segmentId: 'seg-1' },
        body: { guestIds: ['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5'] }
      });

      await marketingController.addToSegment(req, res, next);

      expect(marketingAutomationService.addToSegment).toHaveBeenCalledWith(
        'seg-1',
        ['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5'],
        'manual'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { added: 5 },
        message: 'Added 5 guests to segment'
      });
    });
  });

  describe('createCampaign', () => {
    it('should create a new campaign', async () => {
      const mockCampaign = {
        id: 'camp-1',
        name: 'Summer Sale',
        status: 'draft'
      };
      vi.mocked(marketingAutomationService.createCampaign).mockResolvedValue(mockCampaign);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {
          name: 'Summer Sale',
          subject: '50% off summer stays!',
          segmentId: 'seg-1',
          templateId: 'tpl-1'
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await marketingController.createCampaign(req, res, next);

      expect(marketingAutomationService.createCampaign).toHaveBeenCalledWith('prop-1', req.body, 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCampaign,
        message: 'Campaign created successfully'
      });
    });
  });

  describe('getCampaigns', () => {
    it('should return all campaigns with filters', async () => {
      const mockCampaigns = [
        { id: 'camp-1', name: 'Summer Sale', status: 'active' },
        { id: 'camp-2', name: 'Winter Promo', status: 'draft' }
      ];
      vi.mocked(marketingAutomationService.getCampaigns).mockResolvedValue(mockCampaigns);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { status: 'active' }
      });

      await marketingController.getCampaigns(req, res, next);

      expect(marketingAutomationService.getCampaigns).toHaveBeenCalledWith('prop-1', 'active');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCampaigns
      });
    });
  });

  describe('getCampaignAnalytics', () => {
    it('should return campaign analytics', async () => {
      const mockAnalytics = {
        sent: 1000,
        delivered: 980,
        opened: 350,
        clicked: 120,
        unsubscribed: 5
      };
      vi.mocked(marketingAutomationService.getCampaignAnalytics).mockResolvedValue(mockAnalytics);

      const { req, res, next } = createMockReqRes({
        params: { campaignId: 'camp-1' }
      });

      await marketingController.getCampaignAnalytics(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });
  });
});
