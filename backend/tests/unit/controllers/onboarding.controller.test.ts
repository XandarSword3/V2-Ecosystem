import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/config/secrets.config.js', () => ({
  secretsManager: {
    rotate: vi.fn().mockResolvedValue(undefined)
  }
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
        business_profile: { name: 'Test Property' },
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
import { secretsManager } from '../../../src/config/secrets.config.js';

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
          businessName: 'Test Property',
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
          resort_details: { data: { name: 'Alpine AccommodationUnit', slug: 'alpine-accommodation unit', address: '123 Peak St', phone: '123', email: 'alpine@test.com' } },
          visual_design: { data: { themeColor: '#123456', accentColor: '#abcdef' } },
          modules: { data: { modules: ['menu_service', 'accommodation'] } },
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
          return createChainableMock({ id: 'prop-123', name: 'Alpine AccommodationUnit', slug: 'alpine-accommodation unit' });
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

      const inviteUserByEmailMock = vi.fn().mockResolvedValue({
        data: { user: { id: 'invited-staff-123', email: 'staff1@test.com' } },
        error: null
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock,
        auth: {
          admin: {
            inviteUserByEmail: inviteUserByEmailMock
          }
        }
      } as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await finalizeOnboarding(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Onboarding setup finalized successfully!',
        data: expect.objectContaining({
          propertyId: 'prop-123',
          propertyName: 'Alpine AccommodationUnit'
        })
      });
    });

    it('should return 400 if onboarding is already completed or currently processing (double-finalize protection)', async () => {
      const mockState = {
        completed: false,
        steps: {}
      };

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'site_settings') {
          return createChainableMock([]);
        }
        return createChainableMock({});
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock
      } as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await finalizeOnboarding(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Onboarding is already completed or currently processing'
      });
    });

    it('should rollback completed flag to false and return 500 if provisioning fails', async () => {
      const mockState = {
        completed: false,
        steps: {}
      };

      const updateSpy = vi.fn().mockReturnThis();

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'site_settings') {
          return {
            ...createChainableMock([{ key: 'onboarding_state' }]),
            update: updateSpy
          };
        }
        if (table === 'property_groups') {
          return createChainableMock([{ id: 'group-1' }]);
        }
        if (table === 'properties') {
          return createChainableMock(null, new Error('DB insert failed'));
        }
        return createChainableMock({});
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock
      } as any);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await finalizeOnboarding(req, res, next);

      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        value: expect.objectContaining({
          completed: false,
          completed_at: null
        })
      }));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'DB insert failed'
      }));
    });

    it('should mask sensitive credentials, store in secrets manager, and escape XSS inputs in Operations Manual', async () => {
      const mockState = {
        completed: false,
        steps: {
          resort_details: { data: { name: "<script>alert('xss')</script> Resort", address: "Address \" onload=\"alert(1)" } },
          visual_design: { data: { themeColor: "blue; background: url(javascript:alert(1))" } },
          modules: { data: { modules: ['menu_service'] } }
        }
      };

      const settingsInsertSpy = vi.fn().mockResolvedValue({ error: null });
      const siteSettingsUpsertSpy = vi.fn().mockResolvedValue({ error: null });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'site_settings') {
          return {
            ...createChainableMock({ value: mockState }),
            upsert: siteSettingsUpsertSpy
          };
        }
        if (table === 'property_groups') {
          return createChainableMock([{ id: 'group-1' }]);
        }
        if (table === 'properties') {
          return createChainableMock({ id: 'prop-123', name: 'Resort' });
        }
        if (table === 'property_settings') {
          return {
            ...createChainableMock({}),
            insert: settingsInsertSpy
          };
        }
        return createChainableMock({});
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: fromMock,
        auth: { admin: { inviteUserByEmail: vi.fn() } }
      } as any);

      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.SMTP_PASS;
      delete process.env.SENDGRID_API_KEY;

      const { req, res, next } = createMockReqRes({
        body: {
          stripeSecretKey: 'sk_test_secret123',
          smtpApiKey: 'SG.api_key123',
          smtpPass: 'smtp_password123'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await finalizeOnboarding(req, res, next);

      expect(secretsManager.rotate).toHaveBeenCalledWith('STRIPE_SECRET_KEY', 'sk_test_secret123');
      expect(secretsManager.rotate).toHaveBeenCalledWith('SENDGRID_API_KEY', 'SG.api_key123');

      expect(process.env.STRIPE_SECRET_KEY).toBe('sk_test_secret123');
      expect(process.env.SMTP_PASS).toBe('smtp_password123');
      expect(process.env.SENDGRID_API_KEY).toBe('SG.api_key123');

      expect(settingsInsertSpy).toHaveBeenCalled();
      const insertedSettings = settingsInsertSpy.mock.calls[0][0];
      const gatewaySettings = insertedSettings.find((s: any) => s.setting_key === 'payment_gateway').setting_value;
      const smtpSettings = insertedSettings.find((s: any) => s.setting_key === 'smtp_config').setting_value;

      expect(gatewaySettings.configured).toBe(true);
      expect(gatewaySettings.secretKey).toBeUndefined();
      expect(smtpSettings.configured).toBe(true);
      expect(smtpSettings.pass).toBeUndefined();
      expect(smtpSettings.apiKey).toBeUndefined();

      expect(siteSettingsUpsertSpy).toHaveBeenCalled();
      const upsertedManual = siteSettingsUpsertSpy.mock.calls.find(call => call[0].key.startsWith('operations_manual_'))[0];
      expect(upsertedManual.value.html).toContain('&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt; Resort');
      expect(upsertedManual.value.html).toContain('Address &quot; onload=&quot;alert(1)');
      expect(upsertedManual.value.html).toContain('bluebackgroundurl(javascriptalert(1))');
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
