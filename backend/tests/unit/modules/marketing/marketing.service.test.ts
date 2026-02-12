import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================
// MOCK FACTORY
// =============================================
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range', 'count', 'head'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data, error: null })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.select = vi.fn().mockReturnValue(Promise.resolve({ data: [{ id: 'deleted-1' }], error: null }));
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: [{ id: 'deleted-1' }], error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// =============================================
// MOCK DATA
// =============================================
const mockSegment = {
  id: 'segment-1',
  property_id: 'prop-1',
  name: 'VIP Guests',
  description: 'High value guests',
  segment_type: 'dynamic',
  rules: [{ field: 'total_stays', operator: '>=', value: 5 }],
  is_active: true,
  member_count: 50,
  created_at: '2024-01-01T00:00:00Z'
};

const mockTemplate = {
  id: 'template-1',
  property_id: 'prop-1',
  name: 'Welcome Email',
  category: 'welcome',
  subject: 'Welcome to our resort!',
  preview_text: 'Thank you for joining',
  html_content: '<h1>Welcome {{guest_name}}</h1>',
  text_content: 'Welcome {{guest_name}}',
  variables: ['guest_name'],
  version: 1,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z'
};

const mockJourney = {
  id: 'journey-1',
  property_id: 'prop-1',
  name: 'Welcome Journey',
  journey_type: 'onboarding',
  trigger_type: 'booking_confirmed',
  trigger_config: {},
  status: 'active',
  entry_segment_id: null,
  allow_reentry: false,
  priority: 5,
  created_at: '2024-01-01T00:00:00Z'
};

const mockJourneyStep = {
  id: 'step-1',
  journey_id: 'journey-1',
  step_order: 1,
  step_type: 'send_email',
  name: 'Welcome Email',
  template_id: 'template-1',
  config: {},
  wait_duration: null,
  sends_count: 100,
  opens_count: 50,
  clicks_count: 25
};

const mockCampaign = {
  id: 'campaign-1',
  property_id: 'prop-1',
  name: 'Summer Promo',
  description: 'Summer promotion campaign',
  campaign_type: 'promotional',
  template_id: 'template-1',
  segment_id: 'segment-1',
  subject_line: 'Summer Special Offer!',
  preview_text: 'Limited time only',
  status: 'draft',
  total_recipients: 0,
  sent_count: 0,
  opened_count: 0,
  clicked_count: 0,
  bounced_count: 0,
  unsubscribed_count: 0,
  created_at: '2024-01-01T00:00:00Z',
  email_templates: { name: 'Welcome Email' },
  guest_segments: { name: 'VIP Guests' }
};

const mockAutomation = {
  id: 'automation-1',
  property_id: 'prop-1',
  name: 'Pre-arrival Email',
  trigger_event: 'booking_confirmed',
  template_id: 'template-1',
  trigger_delay: '2 days',
  conditions: [],
  is_active: true,
  suppress_if_recent_send: true,
  suppress_hours: 24,
  trigger_count: 10,
  send_count: 8,
  email_templates: { name: 'Welcome Email' }
};

const mockGuest = {
  id: 'guest-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  country: 'US',
  vip_status: 'gold'
};

const mockEmailSend = {
  id: 'send-1',
  property_id: 'prop-1',
  guest_id: 'guest-1',
  email_type: 'campaign',
  campaign_id: 'campaign-1',
  journey_id: null,
  journey_step_id: null,
  to_email: 'john.doe@example.com',
  subject: 'Summer Special',
  status: 'queued',
  metadata: { html_content: '<h1>Hello</h1>' },
  created_at: '2024-01-01T00:00:00Z'
};

const mockPromoCode = {
  id: 'promo-1',
  property_id: 'prop-1',
  code: 'SUMMER20',
  name: 'Summer 20% Off',
  discount_type: 'percentage',
  discount_value: 20,
  valid_from: '2024-06-01',
  valid_until: '2024-08-31',
  usage_limit: 100,
  times_used: 10,
  usage_per_guest: 1,
  minimum_nights: 2,
  minimum_amount: 100,
  is_active: true
};

const mockEnrollment = {
  id: 'enrollment-1',
  journey_id: 'journey-1',
  guest_id: 'guest-1',
  booking_id: 'booking-1',
  current_step_id: 'step-1',
  status: 'active',
  steps_completed: 0,
  emails_sent: 0,
  next_action_at: '2024-01-02T00:00:00Z',
  metadata: {}
};

// =============================================
// MOCK SETUP
// =============================================
let mockFromFn: ReturnType<typeof vi.fn>;
let mockRpcFn: ReturnType<typeof vi.fn>;
let currentMockData: unknown[] = [];

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => ({
    from: (table: string) => mockFromFn(table),
    rpc: (fnName: string, params: Record<string, unknown>) => mockRpcFn(fnName, params)
  }))
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-123' })
    }))
  }
}));

vi.mock('node-cron', () => ({
  schedule: vi.fn()
}));

import { marketingAutomationService, MarketingAutomationService } from '../../../../src/modules/marketing/marketing.service';

describe('MarketingAutomationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockData = [];
    mockFromFn = vi.fn().mockImplementation(() => createQueryMock(() => currentMockData));
    mockRpcFn = vi.fn().mockResolvedValue({ data: 0, error: null });
  });

  // =============================================
  // INSTANCE TESTS
  // =============================================
  describe('instance', () => {
    it('should be defined', () => {
      expect(marketingAutomationService).toBeDefined();
    });

    it('should be instance of MarketingAutomationService', () => {
      expect(marketingAutomationService).toBeInstanceOf(MarketingAutomationService);
    });
  });

  // =============================================
  // GUEST SEGMENTS
  // =============================================
  describe('createSegment', () => {
    it('should create a segment with rules', async () => {
      currentMockData = [mockSegment];
      mockRpcFn.mockResolvedValue({ data: 50, error: null });

      const result = await marketingAutomationService.createSegment(
        'prop-1',
        'VIP Guests',
        [{ field: 'total_stays', operator: '>=', value: 5 }],
        'High value guests',
        'dynamic'
      );

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('VIP Guests');
      expect(mockFromFn).toHaveBeenCalledWith('guest_segments');
    });

    it('should default to dynamic segment type', async () => {
      currentMockData = [mockSegment];
      mockRpcFn.mockResolvedValue({ data: 0, error: null });

      await marketingAutomationService.createSegment('prop-1', 'Test', [], undefined, 'dynamic');

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });

    it('should calculate segment members after creation', async () => {
      currentMockData = [mockSegment];
      mockRpcFn.mockResolvedValue({ data: 50, error: null });

      await marketingAutomationService.createSegment('prop-1', 'Test', []);

      expect(mockRpcFn).toHaveBeenCalledWith('calculate_segment_members', expect.objectContaining({ p_segment_id: expect.any(String) }));
    });
  });

  describe('getSegments', () => {
    it('should return active segments for property', async () => {
      currentMockData = [mockSegment, { ...mockSegment, id: 'segment-2', name: 'New Guests' }];

      const result = await marketingAutomationService.getSegments('prop-1');

      expect(result).toHaveLength(2);
      expect(mockFromFn).toHaveBeenCalledWith('guest_segments');
    });

    it('should return empty array when no segments', async () => {
      currentMockData = [];

      const result = await marketingAutomationService.getSegments('prop-1');

      expect(result).toEqual([]);
    });
  });

  describe('calculateSegmentMembers', () => {
    it('should call RPC to calculate members', async () => {
      mockRpcFn.mockResolvedValue({ data: 75, error: null });

      const result = await marketingAutomationService.calculateSegmentMembers('segment-1');

      expect(result).toBe(75);
      expect(mockRpcFn).toHaveBeenCalledWith('calculate_segment_members', { p_segment_id: 'segment-1' });
    });

    it('should return 0 when no members', async () => {
      mockRpcFn.mockResolvedValue({ data: null, error: null });

      const result = await marketingAutomationService.calculateSegmentMembers('segment-1');

      expect(result).toBe(0);
    });
  });

  describe('getSegmentMembers', () => {
    it('should return members for static segment', async () => {
      const staticSegment = { ...mockSegment, segment_type: 'static' };
      currentMockData = [staticSegment];

      await marketingAutomationService.getSegmentMembers('segment-1', 100, 0);

      expect(mockFromFn).toHaveBeenCalledWith('guest_segments');
      expect(mockFromFn).toHaveBeenCalledWith('segment_members');
    });

    it('should query by rules for dynamic segment', async () => {
      currentMockData = [mockSegment];
      mockRpcFn.mockResolvedValue({ data: [mockGuest], error: null });

      const result = await marketingAutomationService.getSegmentMembers('segment-1', 100, 0);

      expect(mockRpcFn).toHaveBeenCalledWith('query_guests_by_rules', expect.any(Object));
    });

    it('should throw error when segment not found', async () => {
      currentMockData = [];
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return mock;
      });

      await expect(marketingAutomationService.getSegmentMembers('invalid-segment')).rejects.toThrow();
    });
  });

  describe('addToSegment', () => {
    it('should add guests to segment', async () => {
      currentMockData = [];
      mockRpcFn.mockResolvedValue({ data: 3, error: null });

      const result = await marketingAutomationService.addToSegment('segment-1', ['guest-1', 'guest-2'], 'manual');

      expect(mockFromFn).toHaveBeenCalledWith('segment_members');
    });

    it('should recalculate segment members after adding', async () => {
      currentMockData = [];
      mockRpcFn.mockResolvedValue({ data: 10, error: null });

      await marketingAutomationService.addToSegment('segment-1', ['guest-1']);

      expect(mockRpcFn).toHaveBeenCalledWith('calculate_segment_members', { p_segment_id: 'segment-1' });
    });
  });

  describe('removeFromSegment', () => {
    it('should remove guests from segment', async () => {
      currentMockData = [{ id: 'deleted-1' }];
      mockRpcFn.mockResolvedValue({ data: 2, error: null });

      const result = await marketingAutomationService.removeFromSegment('segment-1', ['guest-1', 'guest-2']);

      expect(mockFromFn).toHaveBeenCalledWith('segment_members');
    });
  });

  // =============================================
  // EMAIL TEMPLATES
  // =============================================
  describe('createTemplate', () => {
    it('should create email template', async () => {
      currentMockData = [mockTemplate];

      const result = await marketingAutomationService.createTemplate('prop-1', {
        name: 'Welcome Email',
        category: 'welcome',
        subject: 'Welcome!',
        htmlContent: '<h1>Welcome</h1>',
        variables: ['guest_name']
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Welcome Email');
      expect(mockFromFn).toHaveBeenCalledWith('marketing_email_templates');
    });

    it('should handle optional fields', async () => {
      currentMockData = [mockTemplate];

      await marketingAutomationService.createTemplate('prop-1', {
        name: 'Basic',
        category: 'marketing',
        subject: 'Test',
        htmlContent: '<p>Test</p>'
      });

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });
  });

  describe('getTemplates', () => {
    it('should return all templates for property', async () => {
      currentMockData = [mockTemplate, { ...mockTemplate, id: 'template-2', name: 'Promo Email' }];

      const result = await marketingAutomationService.getTemplates('prop-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by category when provided', async () => {
      currentMockData = [mockTemplate];

      const result = await marketingAutomationService.getTemplates('prop-1', 'welcome');

      expect(mockFromFn).toHaveBeenCalledWith('marketing_email_templates');
    });

    it('should return empty array when no templates', async () => {
      currentMockData = [];

      const result = await marketingAutomationService.getTemplates('prop-1');

      expect(result).toEqual([]);
    });
  });

  describe('updateTemplate', () => {
    it('should update template fields', async () => {
      currentMockData = [{ version: 1 }];

      await marketingAutomationService.updateTemplate('template-1', {
        name: 'Updated Template',
        subject: 'New Subject'
      });

      expect(mockFromFn).toHaveBeenCalledWith('marketing_email_templates');
    });

    it('should increment version on update', async () => {
      currentMockData = [{ version: 2 }];

      await marketingAutomationService.updateTemplate('template-1', { subject: 'Updated' });

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.select).toHaveBeenCalled();
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate existing template', async () => {
      currentMockData = [mockTemplate];

      const result = await marketingAutomationService.duplicateTemplate('template-1', 'Template Copy');

      expect(mockFromFn).toHaveBeenCalledWith('marketing_email_templates');
    });

    it('should throw when template not found', async () => {
      currentMockData = [];
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return mock;
      });

      await expect(marketingAutomationService.duplicateTemplate('invalid', 'Copy')).rejects.toThrow();
    });
  });

  // =============================================
  // EMAIL JOURNEYS
  // =============================================
  describe('createJourney', () => {
    it('should create journey with steps', async () => {
      currentMockData = [mockJourney];

      const result = await marketingAutomationService.createJourney(
        'prop-1',
        'Welcome Journey',
        'onboarding',
        'booking_confirmed',
        {},
        [{ stepOrder: 1, stepType: 'send_email', templateId: 'template-1' }],
        { allowReentry: false, priority: 5 }
      );

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Welcome Journey');
      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
      expect(mockFromFn).toHaveBeenCalledWith('journey_steps');
    });

    it('should create multiple steps', async () => {
      currentMockData = [mockJourney];

      await marketingAutomationService.createJourney(
        'prop-1',
        'Multi-step Journey',
        'engagement',
        'booking_confirmed',
        {},
        [
          { stepOrder: 1, stepType: 'send_email', templateId: 'template-1' },
          { stepOrder: 2, stepType: 'wait', waitDuration: '2 days' },
          { stepOrder: 3, stepType: 'send_email', templateId: 'template-2' }
        ]
      );

      // Check journey_steps was called for each step
      const stepsCalls = mockFromFn.mock.calls.filter(call => call[0] === 'journey_steps');
      expect(stepsCalls.length).toBeGreaterThan(0);
    });
  });

  describe('getJourneys', () => {
    it('should return journeys with enrollment counts', async () => {
      currentMockData = [mockJourney];
      mockFromFn.mockImplementation((table) => {
        if (table === 'journey_enrollments') {
          const mock = createQueryMock(() => []);
          mock.select = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, data: null, error: null })
            })
          });
          return mock;
        }
        return createQueryMock(() => currentMockData);
      });

      const result = await marketingAutomationService.getJourneys('prop-1');

      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
    });

    it('should filter by status when provided', async () => {
      currentMockData = [mockJourney];

      await marketingAutomationService.getJourneys('prop-1', 'active');

      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
    });
  });

  describe('getJourneyWithSteps', () => {
    it('should return journey with steps', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'journey_steps') {
          return createQueryMock(() => [mockJourneyStep]);
        }
        return createQueryMock(() => [mockJourney]);
      });

      const result = await marketingAutomationService.getJourneyWithSteps('journey-1');

      expect(result).toHaveProperty('steps');
      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
      expect(mockFromFn).toHaveBeenCalledWith('journey_steps');
    });

    it('should return null when journey not found', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: null });
        return mock;
      });

      const result = await marketingAutomationService.getJourneyWithSteps('invalid');

      expect(result).toBeNull();
    });
  });

  describe('activateJourney', () => {
    it('should update journey status to active', async () => {
      currentMockData = [];

      await marketingAutomationService.activateJourney('journey-1');

      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    });
  });

  describe('pauseJourney', () => {
    it('should update journey status to paused', async () => {
      currentMockData = [];

      await marketingAutomationService.pauseJourney('journey-1');

      expect(mockFromFn).toHaveBeenCalledWith('email_journeys');
      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    });
  });

  describe('enrollInJourney', () => {
    it('should enroll guest in active journey', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'journey_steps') {
          return createQueryMock(() => [mockJourneyStep]);
        }
        if (table === 'journey_enrollments') {
          const mock = createQueryMock(() => [mockEnrollment]);
          mock.single = vi.fn().mockResolvedValue({ data: null, error: null });
          return mock;
        }
        return createQueryMock(() => [mockJourney]);
      });

      const result = await marketingAutomationService.enrollInJourney('journey-1', 'guest-1', 'booking-1');

      expect(mockFromFn).toHaveBeenCalledWith('journey_enrollments');
    });

    it('should throw when journey not active', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [{ ...mockJourney, status: 'draft' }]);
        mock.single = vi.fn().mockResolvedValue({ data: { ...mockJourney, status: 'draft' }, error: null });
        return mock;
      });

      await expect(marketingAutomationService.enrollInJourney('journey-1', 'guest-1')).rejects.toThrow('Journey not active');
    });

    it('should return existing enrollment if reentry not allowed', async () => {
      const existingEnrollment = { ...mockEnrollment, status: 'active' };
      mockFromFn.mockImplementation((table) => {
        if (table === 'journey_enrollments') {
          const mock = createQueryMock(() => [existingEnrollment]);
          mock.single = vi.fn().mockResolvedValue({ data: existingEnrollment, error: null });
          return mock;
        }
        return createQueryMock(() => [{ ...mockJourney, allow_reentry: false }]);
      });

      const result = await marketingAutomationService.enrollInJourney('journey-1', 'guest-1');

      expect(result).toMatchObject({ status: 'active' });
    });
  });

  // =============================================
  // CAMPAIGNS
  // =============================================
  describe('createCampaign', () => {
    it('should create marketing campaign', async () => {
      currentMockData = [mockCampaign];

      const result = await marketingAutomationService.createCampaign('prop-1', {
        name: 'Summer Promo',
        templateId: 'template-1',
        segmentId: 'segment-1',
        subjectLine: 'Summer Special!'
      }, 'user-1');

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Summer Promo');
      expect(mockFromFn).toHaveBeenCalledWith('marketing_campaigns');
    });

    it('should handle custom audience', async () => {
      currentMockData = [mockCampaign];

      await marketingAutomationService.createCampaign('prop-1', {
        name: 'Targeted Campaign',
        templateId: 'template-1',
        subjectLine: 'Just for you!',
        customAudience: ['guest-1', 'guest-2']
      }, 'user-1');

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });

    it('should support scheduled campaigns', async () => {
      currentMockData = [mockCampaign];

      await marketingAutomationService.createCampaign('prop-1', {
        name: 'Scheduled Campaign',
        templateId: 'template-1',
        subjectLine: 'Coming Soon!',
        scheduleType: 'scheduled',
        scheduledAt: new Date('2024-12-01')
      }, 'user-1');

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });
  });

  describe('getCampaigns', () => {
    it('should return campaigns with related data', async () => {
      currentMockData = [mockCampaign];

      const result = await marketingAutomationService.getCampaigns('prop-1');

      expect(result[0]).toHaveProperty('template_name');
      expect(result[0]).toHaveProperty('segment_name');
    });

    it('should filter by status when provided', async () => {
      currentMockData = [mockCampaign];

      await marketingAutomationService.getCampaigns('prop-1', 'draft');

      expect(mockFromFn).toHaveBeenCalledWith('marketing_campaigns');
    });
  });

  describe('sendCampaign', () => {
    it('should send campaign to segment members', async () => {
      const campaignWithTemplate = {
        ...mockCampaign,
        segment_id: 'segment-1',
        custom_audience: null,
        email_templates: { html_content: '<h1>Hello</h1>', text_content: 'Hello', variables: [] }
      };
      mockFromFn.mockImplementation((table) => {
        if (table === 'marketing_campaigns') {
          return createQueryMock(() => [campaignWithTemplate]);
        }
        if (table === 'guest_segments') {
          return createQueryMock(() => [mockSegment]);
        }
        if (table === 'guests') {
          return createQueryMock(() => [mockGuest]);
        }
        if (table === 'email_sends') {
          return createQueryMock(() => [mockEmailSend]);
        }
        return createQueryMock(() => []);
      });
      mockRpcFn.mockImplementation((fnName) => {
        if (fnName === 'query_guests_by_rules') {
          return Promise.resolve({ data: [mockGuest], error: null });
        }
        if (fnName === 'can_send_marketing_email') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await marketingAutomationService.sendCampaign('campaign-1');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('queued');
    });

    it('should throw when campaign already sent', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [{ ...mockCampaign, status: 'sent' }]);
        mock.single = vi.fn().mockResolvedValue({ data: { ...mockCampaign, status: 'sent' }, error: null });
        return mock;
      });

      await expect(marketingAutomationService.sendCampaign('campaign-1')).rejects.toThrow('Campaign already sent');
    });

    it('should throw when no recipients defined', async () => {
      const campaignNoRecipients = {
        ...mockCampaign,
        segment_id: null,
        custom_audience: null,
        email_templates: { html_content: '<h1>Test</h1>' }
      };
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [campaignNoRecipients]);
        mock.single = vi.fn().mockResolvedValue({ data: campaignNoRecipients, error: null });
        return mock;
      });

      await expect(marketingAutomationService.sendCampaign('campaign-1')).rejects.toThrow('No recipients defined');
    });
  });

  describe('scheduleCampaign', () => {
    it('should schedule campaign for future send', async () => {
      currentMockData = [];

      await marketingAutomationService.scheduleCampaign('campaign-1', new Date('2024-12-25'));

      expect(mockFromFn).toHaveBeenCalledWith('marketing_campaigns');
      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
    });
  });

  describe('cancelCampaign', () => {
    it('should cancel campaign', async () => {
      currentMockData = [];

      await marketingAutomationService.cancelCampaign('campaign-1');

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    });
  });

  // =============================================
  // TRIGGERED AUTOMATIONS
  // =============================================
  describe('createAutomation', () => {
    it('should create triggered automation', async () => {
      currentMockData = [mockAutomation];

      const result = await marketingAutomationService.createAutomation(
        'prop-1',
        'Pre-arrival Email',
        'booking_confirmed',
        'template-1',
        { triggerDelay: '2 days', suppressIfRecentSend: true }
      );

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Pre-arrival Email');
      expect(mockFromFn).toHaveBeenCalledWith('triggered_automations');
    });

    it('should set default values for options', async () => {
      currentMockData = [mockAutomation];

      await marketingAutomationService.createAutomation('prop-1', 'Basic', 'checkout', 'template-1');

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });
  });

  describe('getAutomations', () => {
    it('should return automations with template name', async () => {
      currentMockData = [mockAutomation];

      const result = await marketingAutomationService.getAutomations('prop-1');

      expect(result[0]).toHaveProperty('template_name');
      expect(mockFromFn).toHaveBeenCalledWith('triggered_automations');
    });
  });

  describe('triggerAutomation', () => {
    it('should create pending execution', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'triggered_automations') {
          return createQueryMock(() => [mockAutomation]);
        }
        if (table === 'email_sends') {
          const mock = createQueryMock(() => []);
          mock.single = vi.fn().mockResolvedValue({ data: null, error: null });
          return mock;
        }
        return createQueryMock(() => []);
      });

      await marketingAutomationService.triggerAutomation('automation-1', 'guest-1', 'booking-1');

      expect(mockFromFn).toHaveBeenCalledWith('automation_executions');
    });

    it('should suppress if recent send within hours', async () => {
      const recentSend = { ...mockEmailSend, sent_at: new Date().toISOString() };
      mockFromFn.mockImplementation((table) => {
        if (table === 'triggered_automations') {
          return createQueryMock(() => [mockAutomation]);
        }
        if (table === 'email_sends') {
          const mock = createQueryMock(() => [recentSend]);
          mock.single = vi.fn().mockResolvedValue({ data: recentSend, error: null });
          return mock;
        }
        return createQueryMock(() => []);
      });

      await marketingAutomationService.triggerAutomation('automation-1', 'guest-1');

      expect(mockFromFn).toHaveBeenCalledWith('automation_executions');
    });

    it('should not trigger if automation inactive', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [{ ...mockAutomation, is_active: false }]);
        mock.single = vi.fn().mockResolvedValue({ data: { ...mockAutomation, is_active: false }, error: null });
        return mock;
      });

      await marketingAutomationService.triggerAutomation('automation-1', 'guest-1');

      // Should return early without creating execution
      const executionCalls = mockFromFn.mock.calls.filter(call => call[0] === 'automation_executions');
      expect(executionCalls.length).toBe(0);
    });
  });

  // =============================================
  // EMAIL SENDING
  // =============================================
  describe('queueEmail', () => {
    it('should queue email for sending', async () => {
      currentMockData = [mockEmailSend];

      const result = await marketingAutomationService.queueEmail(
        'prop-1',
        'guest-1',
        'test@example.com',
        'Test Subject',
        '<h1>Hello {{first_name}}</h1>',
        'campaign',
        { first_name: 'John' },
        { campaignId: 'campaign-1' }
      );

      expect(result).toHaveProperty('id');
      expect(result.to_email).toBe('test@example.com');
      expect(mockFromFn).toHaveBeenCalledWith('email_sends');
    });

    it('should merge variables into content', async () => {
      currentMockData = [mockEmailSend];

      await marketingAutomationService.queueEmail(
        'prop-1',
        'guest-1',
        'test@example.com',
        'Hello {{guest_name}}',
        '<p>Welcome {{first_name}}</p>',
        'journey',
        { guest_name: 'John Doe', first_name: 'John' }
      );

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });
  });

  describe('sendQueuedEmails', () => {
    it('should send queued emails', async () => {
      currentMockData = [mockEmailSend];

      const result = await marketingAutomationService.sendQueuedEmails(10);

      expect(typeof result).toBe('number');
      expect(mockFromFn).toHaveBeenCalledWith('email_sends');
    });

    it('should update status on success', async () => {
      currentMockData = [mockEmailSend];

      await marketingAutomationService.sendQueuedEmails(5);

      expect(mockFromFn).toHaveBeenCalledWith('email_sends');
    });
  });

  // =============================================
  // EMAIL TRACKING
  // =============================================
  describe('trackOpen', () => {
    it('should record open event', async () => {
      currentMockData = [mockEmailSend];

      await marketingAutomationService.trackOpen('send-1', '192.168.1.1', 'Mozilla/5.0');

      expect(mockFromFn).toHaveBeenCalledWith('email_events');
    });

    it('should update campaign metrics', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'email_sends') {
          return createQueryMock(() => [{ ...mockEmailSend, campaign_id: 'campaign-1' }]);
        }
        if (table === 'marketing_campaigns') {
          return createQueryMock(() => [{ opened_count: 10, clicked_count: 5 }]);
        }
        return createQueryMock(() => []);
      });

      await marketingAutomationService.trackOpen('send-1');

      expect(mockFromFn).toHaveBeenCalledWith('marketing_campaigns');
    });
  });

  describe('trackClick', () => {
    it('should record click event with URL', async () => {
      currentMockData = [mockEmailSend];

      await marketingAutomationService.trackClick('send-1', 'https://example.com/offer', '192.168.1.1');

      expect(mockFromFn).toHaveBeenCalledWith('email_events');
    });
  });

  describe('trackUnsubscribe', () => {
    it('should update guest preferences', async () => {
      currentMockData = [];

      await marketingAutomationService.trackUnsubscribe('guest-1', 'prop-1', 'test@example.com', 'Not interested');

      expect(mockFromFn).toHaveBeenCalledWith('guest_preferences');
      expect(mockFromFn).toHaveBeenCalledWith('unsubscribe_log');
    });

    it('should update campaign unsubscribe count', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'marketing_campaigns') {
          return createQueryMock(() => [{ unsubscribed_count: 5 }]);
        }
        return createQueryMock(() => []);
      });

      await marketingAutomationService.trackUnsubscribe('guest-1', 'prop-1', 'test@example.com', 'Reason', 'campaign-1');

      expect(mockFromFn).toHaveBeenCalledWith('marketing_campaigns');
    });
  });

  // =============================================
  // PROMO CODES
  // =============================================
  describe('createPromoCode', () => {
    it('should create percentage discount promo', async () => {
      currentMockData = [mockPromoCode];

      const result = await marketingAutomationService.createPromoCode(
        'prop-1',
        'SUMMER20',
        'percentage',
        20,
        { validFrom: new Date('2024-06-01'), validUntil: new Date('2024-08-31') }
      );

      expect(result).toHaveProperty('id');
      expect(result.code).toBe('SUMMER20');
      expect(mockFromFn).toHaveBeenCalledWith('promo_codes');
    });

    it('should create fixed discount promo', async () => {
      currentMockData = [{ ...mockPromoCode, discount_type: 'fixed', discount_value: 50 }];

      await marketingAutomationService.createPromoCode('prop-1', 'SAVE50', 'fixed', 50);

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });

    it('should uppercase code', async () => {
      currentMockData = [mockPromoCode];

      await marketingAutomationService.createPromoCode('prop-1', 'summer20', 'percentage', 20);

      const fromCall = mockFromFn.mock.results[0].value;
      expect(fromCall.insert).toHaveBeenCalled();
    });
  });

  describe('validatePromoCode', () => {
    it('should validate valid promo code', async () => {
      const validPromo = {
        ...mockPromoCode,
        valid_from: '2020-01-01',
        valid_until: '2030-12-31',
        times_used: 0,
        usage_limit: 100
      };
      mockFromFn.mockImplementation((table) => {
        if (table === 'promo_codes') {
          const mock = createQueryMock(() => [validPromo]);
          mock.single = vi.fn().mockResolvedValue({ data: validPromo, error: null });
          return mock;
        }
        if (table === 'promo_code_usage') {
          const mock = createQueryMock(() => []);
          (mock as any).select = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, data: null, error: null })
            }),
            count: 'exact',
            head: true
          });
          return mock;
        }
        return createQueryMock(() => []);
      });

      const result = await marketingAutomationService.validatePromoCode('prop-1', 'SUMMER20', 'guest-1', 3, 500);

      expect(result.valid).toBe(true);
      expect(result.discount).toBeDefined();
    });

    it('should return error for invalid code', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: null });
        return mock;
      });

      const result = await marketingAutomationService.validatePromoCode('prop-1', 'INVALID', 'guest-1', 2, 200);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid promo code');
    });

    it('should return error for expired code', async () => {
      const expiredPromo = { ...mockPromoCode, valid_until: '2020-01-01' };
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [expiredPromo]);
        mock.single = vi.fn().mockResolvedValue({ data: expiredPromo, error: null });
        return mock;
      });

      const result = await marketingAutomationService.validatePromoCode('prop-1', 'SUMMER20', 'guest-1', 2, 200);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promo code expired');
    });

    it('should return error when usage limit reached', async () => {
      const exhaustedPromo = { ...mockPromoCode, usage_limit: 10, times_used: 10, valid_until: '2030-12-31' };
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [exhaustedPromo]);
        mock.single = vi.fn().mockResolvedValue({ data: exhaustedPromo, error: null });
        return mock;
      });

      const result = await marketingAutomationService.validatePromoCode('prop-1', 'SUMMER20', 'guest-1', 2, 200);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promo code usage limit reached');
    });

    it('should return error for minimum nights not met', async () => {
      const promoWithMinNights = { ...mockPromoCode, minimum_nights: 5, valid_until: '2030-12-31', times_used: 0 };
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [promoWithMinNights]);
        mock.single = vi.fn().mockResolvedValue({ data: promoWithMinNights, error: null });
        return mock;
      });

      const result = await marketingAutomationService.validatePromoCode('prop-1', 'SUMMER20', 'guest-1', 2, 500);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum');
    });
  });

  describe('redeemPromoCode', () => {
    it('should record promo code usage', async () => {
      currentMockData = [{ times_used: 5 }];

      await marketingAutomationService.redeemPromoCode('promo-1', 'guest-1', 'booking-1', 100);

      expect(mockFromFn).toHaveBeenCalledWith('promo_code_usage');
      expect(mockFromFn).toHaveBeenCalledWith('promo_codes');
    });

    it('should increment times_used', async () => {
      currentMockData = [{ times_used: 10 }];

      await marketingAutomationService.redeemPromoCode('promo-1', 'guest-1', 'booking-1', 50);

      const fromCalls = mockFromFn.mock.calls.filter(call => call[0] === 'promo_codes');
      expect(fromCalls.length).toBeGreaterThan(0);
    });
  });

  // =============================================
  // ANALYTICS
  // =============================================
  describe('getCampaignAnalytics', () => {
    it('should return campaign metrics and rates', async () => {
      const campaignWithStats = {
        ...mockCampaign,
        sent_count: 1000,
        opened_count: 250,
        clicked_count: 50,
        bounced_count: 10,
        unsubscribed_count: 5
      };
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [campaignWithStats]);
        mock.single = vi.fn().mockResolvedValue({ data: campaignWithStats, error: null });
        return mock;
      });
      mockRpcFn.mockResolvedValue({ data: [], error: null });

      const result = await marketingAutomationService.getCampaignAnalytics('campaign-1');

      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('openRate');
      expect(result.metrics).toHaveProperty('clickRate');
    });

    it('should throw when campaign not found', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return mock;
      });

      await expect(marketingAutomationService.getCampaignAnalytics('invalid')).rejects.toThrow();
    });

    it('should call RPC for click breakdown', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => [mockCampaign]);
        mock.single = vi.fn().mockResolvedValue({ data: mockCampaign, error: null });
        return mock;
      });
      mockRpcFn.mockResolvedValue({ data: [], error: null });

      await marketingAutomationService.getCampaignAnalytics('campaign-1');

      expect(mockRpcFn).toHaveBeenCalledWith('get_campaign_click_breakdown', expect.any(Object));
      expect(mockRpcFn).toHaveBeenCalledWith('get_campaign_device_breakdown', expect.any(Object));
    });
  });

  describe('getJourneyAnalytics', () => {
    it('should return journey stats and step performance', async () => {
      mockFromFn.mockImplementation((table) => {
        if (table === 'email_journeys') {
          return createQueryMock(() => [mockJourney]);
        }
        if (table === 'journey_steps') {
          return createQueryMock(() => [mockJourneyStep]);
        }
        if (table === 'journey_enrollments') {
          const mock = createQueryMock(() => []);
          mock.select = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 100, data: null, error: null })
            }),
            count: 'exact',
            head: true
          });
          return mock;
        }
        return createQueryMock(() => []);
      });

      const result = await marketingAutomationService.getJourneyAnalytics('journey-1');

      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('stepPerformance');
    });

    it('should throw when journey not found', async () => {
      mockFromFn.mockImplementation(() => {
        const mock = createQueryMock(() => []);
        mock.single = vi.fn().mockResolvedValue({ data: null, error: null });
        return mock;
      });

      await expect(marketingAutomationService.getJourneyAnalytics('invalid')).rejects.toThrow('Journey not found');
    });
  });

  // =============================================
  // BACKGROUND PROCESSING
  // =============================================
  describe('startBackgroundProcessing', () => {
    it('should schedule cron job', async () => {
      const cron = await import('node-cron');

      marketingAutomationService.startBackgroundProcessing();

      expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));
    });
  });
});