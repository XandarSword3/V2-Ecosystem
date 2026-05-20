import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue({})
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    accounts = {
      retrieve: vi.fn().mockResolvedValue({
        id: 'acct_123',
        business_profile: { name: 'Test Resort' },
        charges_enabled: true,
        details_submitted: true,
        email: 'billing@testresort.com'
      })
    };
  }
}));

vi.mock('nodemailer', () => {
  const verifyMock = vi.fn().mockResolvedValue(true);
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg_123' });
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        verify: verifyMock,
        sendMail: sendMailMock,
      })
    }
  };
});

import { getSupabase } from '../../../src/database/connection';
import {
  getOnboardingState,
  updateOnboardingState,
  verifyStripe,
  testEmail,
  finalizeOnboarding,
  getOperationsManual
} from '../../../src/modules/admin/controllers/onboarding.controller';

describe('OnboardingController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnboardingState', () => {
    it('should return onboarding state if it exists in settings', async () => {
      const mockState = { completed: false, current_step: 'resort_details', steps: {} };
      const fromMock = vi.fn().mockImplementation(() => createChainableMock({ value: mockState }));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getOnboardingState(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockState
      });
    });

    it('should return default state if it does not exist', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock(null));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getOnboardingState(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          completed: false,
          current_step: 'welcome'
        })
      });
    });
  });

  describe('updateOnboardingState', () => {
    it('should update and return onboarding state', async () => {
      const oldState = { completed: false, started_at: null, current_step: 'welcome', steps: {} };
      const newState = { current_step: 'resort_details' };

      const fromMock = vi.fn().mockImplementation(() => {
        return createChainableMock({ value: oldState });
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: newState,
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      await updateOnboardingState(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          current_step: 'resort_details',
          started_at: expect.any(String)
        })
      }));
    });

    it('should return 400 for invalid body payload', async () => {
      const { req, res, next } = createMockReqRes();
      req.body = null as any;
      await updateOnboardingState(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid onboarding state payload'
      });
    });
  });

  describe('verifyStripe', () => {
    it('should retrieve Stripe account successfully', async () => {
      const { req, res, next } = createMockReqRes({
        body: { secretKey: 'sk_test_mock' }
      });

      await verifyStripe(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stripe connection successful',
        data: {
          accountId: 'acct_123',
          businessName: 'Test Resort',
          chargesEnabled: true,
          detailsSubmitted: true
        }
      });
    });

    it('should return 400 if secretKey is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await verifyStripe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Stripe secret key is required'
      });
    });
  });

  describe('testEmail', () => {
    it('should send standard SMTP test email successfully', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          provider: 'smtp',
          host: 'smtp.test.com',
          port: '587',
          toEmail: 'target@test.com',
          fromEmail: 'noreply@test.com'
        }
      });

      await testEmail(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Test email sent successfully'
      });
    });

    it('should return 400 if recipient email is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          provider: 'smtp'
        }
      });

      await testEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Recipient email (toEmail) is required'
      });
    });
  });

  describe('finalizeOnboarding', () => {
    it('should provision property, settings, modules and complete onboarding', async () => {
      const mockState = {
        completed: false,
        steps: {
          brand_identity: { data: { resortName: 'Alpine Chalet', slug: 'alpine-chalet', address: '123 Peak St', phone: '123', email: 'alpine@test.com' } },
          visual_design: { data: { themeColor: '#123456', accentColor: '#abcdef' } },
          modules: { data: { modules: ['restaurant', 'accommodation'] } },
          staff_invitations: { data: { invitations: [{ email: 'staff1@test.com', name: 'John Doe', role: 'staff' }] } }
        }
      };

      // Mock database calls for all entities inserted/selected in finalizeOnboarding
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'site_settings') {
          return createChainableMock({ value: mockState });
        }
        if (table === 'property_groups') {
          return createChainableMock([{ id: 'group-1' }]);
        }
        if (table === 'properties') {
          return createChainableMock({ id: 'prop-123', name: 'Alpine Chalet', slug: 'alpine-chalet' });
        }
        if (table === 'user_property_access') {
          return createChainableMock({});
        }
        if (table === 'property_settings') {
          return createChainableMock({});
        }
        if (table === 'modules') {
          return createChainableMock({});
        }
        if (table === 'users') {
          return createChainableMock({ id: 'user-2', email: 'staff1@test.com' });
        }
        return createChainableMock({});
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await finalizeOnboarding(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Onboarding setup finalized successfully!',
        data: expect.objectContaining({
          propertyId: 'prop-123',
          propertyName: 'Alpine Chalet'
        })
      });
    });
  });

  describe('getOperationsManual', () => {
    it('should return operations manual if it exists', async () => {
      const mockManual = { html: '<html><body>Test Manual</body></html>' };
      const fromMock = vi.fn().mockImplementation(() => createChainableMock({ value: mockManual }));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { property_id: 'prop-123' }
      });

      await getOperationsManual(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith(mockManual.html);
    });

    it('should return 400 if property_id is missing', async () => {
      const { req, res, next } = createMockReqRes({ query: {} });

      await getOperationsManual(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'property_id is required'
      });
    });
  });
});
