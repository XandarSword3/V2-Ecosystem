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
    getJourneyAnalytics: vi.fn(),
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

  describe('removeFromSegment', () => {
    it('should remove guests from segment', async () => {
      vi.mocked(marketingAutomationService.removeFromSegment).mockResolvedValue(3);

      const { req, res, next } = createMockReqRes({
        params: { segmentId: 'seg-1' },
        body: { guestIds: ['guest-1', 'guest-2', 'guest-3'] }
      });

      await marketingController.removeFromSegment(req, res, next);

      expect(marketingAutomationService.removeFromSegment).toHaveBeenCalledWith('seg-1', ['guest-1', 'guest-2', 'guest-3']);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { removed: 3 },
        message: 'Removed 3 guests from segment'
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

  describe('Automations', () => {
    it('should create an automation', async () => {
      const mockAutomation = { id: 'auto-1', name: 'Post-stay' };
      vi.mocked(marketingAutomationService.createAutomation).mockResolvedValue(mockAutomation);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Post-stay', triggerEvent: 'CHECK_OUT', templateId: 'tpl-1' }
      });

      await marketingController.createAutomation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAutomation,
        message: 'Automation created successfully'
      });
    });

    it('should trigger an automation', async () => {
      const { req, res, next } = createMockReqRes({
        params: { automationId: 'auto-1' },
        body: { guestId: 'guest-1' }
      });

      await marketingController.triggerAutomation(req, res, next);

      expect(marketingAutomationService.triggerAutomation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Automation triggered' });
    });
  });

  describe('Journeys', () => {
    it('should create a journey', async () => {
      const mockJourney = { id: 'jr-1', name: 'Welcome Journey' };
      vi.mocked(marketingAutomationService.createJourney).mockResolvedValue(mockJourney);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Welcome Journey', journeyType: 'automation' }
      });

      await marketingController.createJourney(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should activate a journey', async () => {
      const { req, res, next } = createMockReqRes({
        params: { journeyId: 'jr-1' }
      });

      await marketingController.activateJourney(req, res, next);

      expect(marketingAutomationService.activateJourney).toHaveBeenCalledWith('jr-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Journey activated' });
    });

    it('should pause a journey', async () => {
      const { req, res, next } = createMockReqRes({
        params: { journeyId: 'jr-1' }
      });

      await marketingController.pauseJourney(req, res, next);

      expect(marketingAutomationService.pauseJourney).toHaveBeenCalledWith('jr-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Journey paused' });
    });

    it('should get journey analytics', async () => {
      vi.mocked(marketingAutomationService.getJourneyAnalytics).mockResolvedValue({ enrolled: 10 });

      const { req, res, next } = createMockReqRes({
        params: { journeyId: 'jr-1' }
      });

      await marketingController.getJourneyAnalytics(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: { enrolled: 10 } });
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

  describe('Campaign Operations', () => {
    it('should send a campaign', async () => {
      vi.mocked(marketingAutomationService.sendCampaign).mockResolvedValue({ queued: 50, failed: 0 });

      const { req, res, next } = createMockReqRes({
        params: { campaignId: 'camp-1' }
      });

      await marketingController.sendCampaign(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { queued: 50, failed: 0 },
        message: 'Queued 50 emails'
      });
    });

    it('should schedule a campaign', async () => {
      const { req, res, next } = createMockReqRes({
        params: { campaignId: 'camp-1' },
        body: { scheduledAt: '2024-12-25T10:00:00Z' }
      });

      await marketingController.scheduleCampaign(req, res, next);

      expect(marketingAutomationService.scheduleCampaign).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Campaign scheduled'
      });
    });

    it('should cancel a campaign', async () => {
      const { req, res, next } = createMockReqRes({
        params: { campaignId: 'camp-1' }
      });

      await marketingController.cancelCampaign(req, res, next);

      expect(marketingAutomationService.cancelCampaign).toHaveBeenCalledWith('camp-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Campaign cancelled'
      });
    });
  });

  describe('Templates', () => {
    it('should create a template', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Welcome' };
      vi.mocked(marketingAutomationService.createTemplate).mockResolvedValue(mockTemplate);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Welcome', content: 'Hello!' }
      });

      await marketingController.createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplate,
        message: 'Template created successfully'
      });
    });

    it('should get templates', async () => {
      const mockTemplates = [{ id: 'tpl-1' }];
      vi.mocked(marketingAutomationService.getTemplates).mockResolvedValue(mockTemplates);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { category: 'welcome' }
      });

      await marketingController.getTemplates(req, res, next);

      expect(marketingAutomationService.getTemplates).toHaveBeenCalledWith('prop-1', 'welcome');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates
      });
    });
  });

  describe('Tracking', () => {
    it('should track email open and return pixel', async () => {
      const { req, res, next } = createMockReqRes({
        params: { sendId: 'send-1' }
      });
      req.ip = '127.0.0.1';
      req.headers['user-agent'] = 'Vitest';

      await marketingController.trackEmailOpen(req, res, next);

      expect(marketingAutomationService.trackOpen).toHaveBeenCalledWith('send-1', '127.0.0.1', 'Vitest');
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/gif');
      expect(res.send).toHaveBeenCalled();
    });

    it('should track email click and redirect', async () => {
      const targetUrl = 'https://example.com/promo';
      const { req, res, next } = createMockReqRes({
        params: { sendId: 'send-1' },
        query: { url: targetUrl }
      });
      req.ip = '127.0.0.1';
      req.headers['user-agent'] = 'Vitest';

      await marketingController.trackEmailClick(req, res, next);

      expect(marketingAutomationService.trackClick).toHaveBeenCalledWith('send-1', targetUrl, '127.0.0.1', 'Vitest');
      expect(res.redirect).toHaveBeenCalledWith(targetUrl);
    });

    it('should return 400 for invalid click URL protocol', async () => {
      const targetUrl = 'javascript:alert(1)';
      const { req, res, next } = createMockReqRes({
        params: { sendId: 'send-1' },
        query: { url: targetUrl }
      });

      await marketingController.trackEmailClick(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Promo Codes', () => {
    it('should create a promo code', async () => {
      const mockPromo = { id: 'promo-1', code: 'SUMMER20' };
      vi.mocked(marketingAutomationService.createPromoCode).mockResolvedValue(mockPromo);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { code: 'SUMMER20', discountType: 'percentage', discountValue: 20 }
      });

      await marketingController.createPromoCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPromo,
        message: 'Promo code created'
      });
    });

    it('should validate a promo code', async () => {
      const mockResult = { valid: true, discount: 10 };
      vi.mocked(marketingAutomationService.validatePromoCode).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { code: 'SUMMER20', guestId: 'guest-1' }
      });

      await marketingController.validatePromoCode(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });
  });

  describe('cancelCampaign', () => {
    it('should cancel campaign successfully', async () => {
      const { cancelCampaign } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ params: { campaignId: 'c1' } });
      
      await cancelCampaign(req, res, next);
      
      expect(marketingAutomationService.cancelCampaign).toHaveBeenCalledWith('c1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Campaign cancelled' }));
    });
  });

  describe('createAutomation', () => {
    it('should create automation successfully', async () => {
      const { createAutomation } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ 
        params: { propertyId: 'p1' },
        body: { name: 'Welcome', triggerEvent: 'guest_checkin', templateId: 't1' }
      });
      
      const mockAutomation = { id: 'a1', name: 'Welcome' };
      vi.mocked(marketingAutomationService.createAutomation).mockResolvedValue(mockAutomation as any);
      
      await createAutomation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: mockAutomation }));
    });
  });

  describe('trackEmailOpen', () => {
    it('should track email open and return pixel', async () => {
      const { trackEmailOpen } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ params: { sendId: 's1' } });
      
      await trackEmailOpen(req, res, next);
      
      expect(marketingAutomationService.trackOpen).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/gif');
      expect(res.send).toHaveBeenCalled();
    });

    it('should return pixel even if tracking fails', async () => {
      const { trackEmailOpen } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ params: { sendId: 's1' } });
      
      vi.mocked(marketingAutomationService.trackOpen).mockRejectedValue(new Error('DB Error'));
      
      await trackEmailOpen(req, res, next);
      
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/gif');
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getAutomations', () => {
    it('should return automations for a property', async () => {
      const { getAutomations } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ params: { propertyId: 'p1' } });
      
      const mockAutomations = [{ id: 'a1', name: 'Welcome' }];
      vi.mocked(marketingAutomationService.getAutomations).mockResolvedValue(mockAutomations as any);
      
      await getAutomations(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: mockAutomations }));
    });
  });

  describe('triggerAutomation', () => {
    it('should trigger automation manually', async () => {
      const { triggerAutomation } = await import('../../../src/modules/marketing/marketing.controller.js');
      const { req, res, next } = createMockReqRes({ 
        params: { automationId: 'a1' },
        body: { guestId: 'g1', triggerData: { x: 1 } }
      });
      
      await triggerAutomation(req, res, next);
      
      expect(marketingAutomationService.triggerAutomation).toHaveBeenCalledWith('a1', 'g1', undefined, { x: 1 });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Automation triggered' }));
    });
  });
});
