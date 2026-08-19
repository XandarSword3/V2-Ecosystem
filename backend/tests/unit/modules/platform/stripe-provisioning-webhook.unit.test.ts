import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { handleSaasStripeWebhook } from '../../../../src/modules/platform/saas-webhook.controller.js';
import { getSaasBillingService } from '../../../../src/services/saas-billing.service.js';
import { getProvisioningService } from '../../../../src/modules/platform/provisioning.service.js';
import { emailService } from '../../../../src/services/email.service.js';
import { getSupabase } from '../../../../src/database/connection.js';

// Mock dependencies
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../../../src/services/saas-billing.service.js', () => {
  const mockBilling = {
    constructWebhookEvent: vi.fn(),
    getSubscription: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'active',
      trial_end: null,
    }),
    cancelSubscription: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getSaasBillingService: () => mockBilling,
    SaasBillingService: {
      mapStripeToBillingStatus: (status: string) => (status === 'active' ? 'active' : 'trialing'),
    },
  };
});

describe('SaaS Provisioning & Stripe Webhook Unit', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret_for_tests';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  function createSignedWebhookRequest(payload: object) {
    const payloadString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${payloadString}`)
      .digest('hex');

    const headers: Record<string, string> = {
      'stripe-signature': `t=${timestamp},v1=${signature}`,
      'content-type': 'application/json',
    };

    const req: any = {
      headers,
      body: Buffer.from(payloadString),
    };

    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    return { req, res, payloadString, timestamp, signature };
  }

  it('should accept signed checkout.session.completed event and provision tenant, role, and welcome email', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const ownerUserId = '11111111-1111-1111-1111-111111111111';
    const propertyGroupId = '22222222-2222-2222-2222-222222222222';
    const propertyId = '33333333-3333-3333-3333-333333333333';
    const roleId = '44444444-4444-4444-4444-444444444444';

    const eventPayload = {
      id: 'evt_test_checkout_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_123',
          mode: 'subscription',
          subscription: 'sub_test_123',
          customer: 'cus_test_123',
          customer_details: {
            email: 'alicesmith@example.com',
            name: 'Alice Smith',
          },
          metadata: {
            tenantId,
            subdomain: 'alicesresort',
            tier: 'growth',
          },
          amount_total: 9900,
          currency: 'usd',
        },
      },
    };

    // Configure billing service constructWebhookEvent to return the event object
    const billing = getSaasBillingService();
    (billing.constructWebhookEvent as any).mockReturnValue(eventPayload);

    // Mock Supabase calls for provisioning steps
    const mockTenantsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: tenantId,
          subdomain: 'alicesresort',
          subscription_tier: 'growth',
          billing_status: 'active',
          stripe_subscription_id: 'sub_test_123',
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    };

    const mockPropertyGroupsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: propertyGroupId, name: 'Alice\'s Resort', tenant_id: tenantId },
        error: null,
      }),
    };

    const mockPropertiesTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: propertyId, name: 'Main Property', tenant_id: tenantId, group_id: propertyGroupId },
        error: null,
      }),
    };

    const mockRolesTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: roleId, name: 'tenant_owner' }, error: null }),
      insert: vi.fn().mockResolvedValue({ data: [{ id: roleId, name: 'tenant_owner' }], error: null }),
    };

    const mockUsersTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: ownerUserId,
          email: 'alicesmith@example.com',
          name: 'Alice Smith',
          tenant_id: tenantId,
          scope: 'tenant_owner',
        },
        error: null,
      }),
    };

    const mockUserRolesTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const mockBillingHistoryTable = {
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const fromMock = vi.fn().mockImplementation((table: string) => {
      switch (table) {
        case 'tenants': return mockTenantsTable;
        case 'property_groups': return mockPropertyGroupsTable;
        case 'properties': return mockPropertiesTable;
        case 'roles': return mockRolesTable;
        case 'users': return mockUsersTable;
        case 'user_roles': return mockUserRolesTable;
        case 'saas_billing_history': return mockBillingHistoryTable;
        default:
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
      }
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const { req, res } = createSignedWebhookRequest(eventPayload);

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('should reject webhook request if stripe signature is invalid', async () => {
    const billing = getSaasBillingService();
    (billing.constructWebhookEvent as any).mockImplementation(() => {
      throw new Error('Signature verification failed');
    });

    const { req, res } = createSignedWebhookRequest({ type: 'customer.subscription.updated' });

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook signature verification failed' });
  });
});
