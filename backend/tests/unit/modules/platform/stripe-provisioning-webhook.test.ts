import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createChainableMock } from '../../utils.js';
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

describe('SaaS Provisioning & Stripe Webhook Handler', () => {
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

    const billing = getSaasBillingService();
    (billing.constructWebhookEvent as any).mockReturnValue(eventPayload);

    const mockTenantsTable = createChainableMock({
      id: tenantId,
      subdomain: 'alicesresort',
      subscription_tier: 'growth',
      billing_status: 'active',
      stripe_subscription_id: 'sub_test_123',
    });
    mockTenantsTable.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockPropertyGroupsTable = createChainableMock({
      id: propertyGroupId,
      name: "Alice's Resort",
      tenant_id: tenantId,
    });
    mockPropertyGroupsTable.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockPropertiesTable = createChainableMock({
      id: propertyId,
      name: 'Main Property',
      tenant_id: tenantId,
      group_id: propertyGroupId,
    });
    mockPropertiesTable.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockRolesTable = createChainableMock([{ id: roleId, name: 'tenant_owner' }]);
    mockRolesTable.maybeSingle = vi.fn().mockResolvedValue({ data: { id: roleId, name: 'tenant_owner' }, error: null });

    const mockUsersTable = createChainableMock({
      id: ownerUserId,
      email: 'alicesmith@example.com',
      name: 'Alice Smith',
      tenant_id: tenantId,
      scope: 'tenant_owner',
    });
    mockUsersTable.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockUserRolesTable = createChainableMock([]);
    const mockBillingHistoryTable = createChainableMock([]);

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
          return createChainableMock({});
      }
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const { req, res } = createSignedWebhookRequest(eventPayload);

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });

    const provisioning = getProvisioningService();
    const result = await provisioning.provision({
      stripeSubscriptionId: 'sub_test_123',
      stripeCustomerId: 'cus_test_123',
      tier: 'growth',
      billingStatus: 'active',
      operatorEmail: 'alicesmith@example.com',
      operatorName: 'Alice Smith',
      subdomain: 'alicesresort',
      trialEndsAt: null,
    });

    expect(result).toBeDefined();
    expect(result.created).toBe(true);
    expect(result.ownerUserId).toBe(ownerUserId);

    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alicesmith@example.com',
        subject: expect.stringContaining('ready'),
      })
    );
  });

  it('should be idempotent and not create duplicate tenant or send duplicate email on replay', async () => {
    const existingTenantId = '00000000-0000-0000-0000-000000000099';
    const mockTenantsTable = createChainableMock({
      id: existingTenantId,
      subdomain: 'existingresort',
      subscription_tier: 'starter',
      billing_status: 'active',
      property_group_id: 'pg-123',
    });
    mockTenantsTable.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: existingTenantId,
        property_group_id: 'pg-123',
      },
      error: null,
    });

    const mockPropertyGroupsTable = createChainableMock({});
    const mockPropertiesTable = createChainableMock({ id: 'prop-123' });
    mockPropertiesTable.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'prop-123' }, error: null });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'tenants') return mockTenantsTable;
      if (table === 'property_groups') return mockPropertyGroupsTable;
      if (table === 'properties') return mockPropertiesTable;
      return createChainableMock({});
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const provisioning = getProvisioningService();
    const result = await provisioning.provision({
      stripeSubscriptionId: 'sub_already_provisioned',
      stripeCustomerId: 'cus_test_123',
      tier: 'growth',
      billingStatus: 'active',
      operatorEmail: 'alicesmith@example.com',
      operatorName: 'Alice Smith',
      subdomain: 'existingresort',
      trialEndsAt: null,
    });

    // Idempotency assertions:
    expect(result.created).toBe(false);
    expect(result.tenantId).toBe(existingTenantId);
    // Welcome email must NOT be re-sent on replay:
    expect(emailService.sendEmail).not.toHaveBeenCalled();
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

  it('should skip processing if event was already processed (idempotency)', async () => {
    const existingTenantId = '00000000-0000-0000-0000-000000000099';
    const mockBillingHistoryTable = createChainableMock({
      id: 'bh-123',
      tenant_id: existingTenantId,
      stripe_event_id: 'evt_already_processed',
    });
    mockBillingHistoryTable.select = vi.fn().mockReturnThis();
    mockBillingHistoryTable.eq = vi.fn().mockReturnThis();
    mockBillingHistoryTable.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'bh-123' },
      error: null,
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'billing_history') return mockBillingHistoryTable;
      return createChainableMock({});
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const eventPayload = {
      id: 'evt_already_processed',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'active',
          metadata: { tier: 'growth' },
        },
      },
    };

    const billing = getSaasBillingService();
    (billing.constructWebhookEvent as any).mockReturnValue(eventPayload);

    const { req, res } = createSignedWebhookRequest(eventPayload);

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    
    // Verify that the billing history check was called with the correct event ID
    expect(mockBillingHistoryTable.select).toHaveBeenCalledWith('id');
    expect(mockBillingHistoryTable.eq).toHaveBeenCalledWith('stripe_event_id', 'evt_already_processed');
    expect(mockBillingHistoryTable.maybeSingle).toHaveBeenCalled();
  });

  it('should return 500 and cancel the subscription when checkout provisioning fails', async () => {
    const eventPayload = {
      id: 'evt_checkout_fail_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_fail_123',
          mode: 'subscription',
          subscription: 'sub_test_123',
          customer: 'cus_test_123',
          customer_details: {
            email: 'alicesmith@example.com',
            name: 'Alice Smith',
          },
          metadata: {
            tenantId: '00000000-0000-0000-0000-000000000001',
            subdomain: 'alicesresort',
            tier: 'growth',
          },
          amount_total: 9900,
          currency: 'usd',
        },
      },
    };

    const billing = getSaasBillingService() as any;
    billing.constructWebhookEvent.mockReturnValue(eventPayload);
    billing.getSubscription.mockResolvedValue({
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'active',
      trial_end: null,
    });

    // The tenants insert resolving to an error makes provisioning.provision()
    // throw, which should trigger the compensating cancel + a 500 response.
    const failingTenantsTable = createChainableMock(null, { message: 'boom' });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'tenants') return failingTenantsTable;
      if (table === 'billing_history') return createChainableMock();
      return createChainableMock({});
    });
    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const { req, res } = createSignedWebhookRequest(eventPayload);

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook processing failed' });
    expect(billing.cancelSubscription).toHaveBeenCalledWith('sub_test_123', { atPeriodEnd: false });
  });

  it('should skip provisioning and ack 200 when the subscription is already cancelled', async () => {
    const eventPayload = {
      id: 'evt_checkout_cancelled_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_cancelled_123',
          mode: 'subscription',
          subscription: 'sub_test_123',
          customer: 'cus_test_123',
          customer_details: {
            email: 'alicesmith@example.com',
            name: 'Alice Smith',
          },
          metadata: {
            tenantId: '00000000-0000-0000-0000-000000000001',
            subdomain: 'alicesresort',
            tier: 'growth',
          },
          amount_total: 9900,
          currency: 'usd',
        },
      },
    };

    const billing = getSaasBillingService() as any;
    billing.constructWebhookEvent.mockReturnValue(eventPayload);
    billing.getSubscription.mockResolvedValue({
      id: 'sub_test_123',
      customer: 'cus_test_123',
      status: 'canceled',
      trial_end: null,
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'billing_history') return createChainableMock();
      return createChainableMock({});
    });
    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    const provisioning = getProvisioningService();
    const provisionSpy = vi.spyOn(provisioning, 'provision');

    const { req, res } = createSignedWebhookRequest(eventPayload);

    await handleSaasStripeWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(provisionSpy).not.toHaveBeenCalled();

    provisionSpy.mockRestore();
  });
});
