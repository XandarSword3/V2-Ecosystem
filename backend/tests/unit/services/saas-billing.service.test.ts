import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createChainableMock } from '../utils.js';

// Hoist mock Stripe implementation
const {
  mockCheckoutSessionsCreate,
  mockBillingPortalSessionsCreate,
  mockSubscriptionsRetrieve,
  mockSubscriptionsUpdate,
  mockSubscriptionsCancel,
  mockCustomersList,
  mockCustomersCreate,
  mockWebhooksConstructEvent,
} = vi.hoisted(() => ({
  mockCheckoutSessionsCreate: vi.fn(),
  mockBillingPortalSessionsCreate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
  mockCustomersList: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: mockBillingPortalSessionsCreate } };
      subscriptions = {
        retrieve: mockSubscriptionsRetrieve,
        update: mockSubscriptionsUpdate,
        cancel: mockSubscriptionsCancel,
      };
      customers = {
        list: mockCustomersList,
        create: mockCustomersCreate,
      };
      webhooks = {
        constructEvent: mockWebhooksConstructEvent,
      };
    },
  };
});

// Mock database connection
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import {
  SaasBillingService,
  getSaasBillingService,
} from '../../../src/services/saas-billing.service.js';

describe('SaasBillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_saas';
    process.env.STRIPE_SAAS_WEBHOOK_SECRET = 'whsec_test_saas';
    process.env.FRONTEND_URL = 'https://v2platform.com';
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_GROWTH;
    delete process.env.STRIPE_PRICE_ENTERPRISE;
  });

  describe('Static status mapping', () => {
    it('maps all Stripe subscription statuses to internal BillingStatus correctly', () => {
      expect(SaasBillingService.mapStripeToBillingStatus('trialing')).toBe('trialing');
      expect(SaasBillingService.mapStripeToBillingStatus('active')).toBe('active');
      expect(SaasBillingService.mapStripeToBillingStatus('past_due')).toBe('past_due');
      expect(SaasBillingService.mapStripeToBillingStatus('unpaid')).toBe('past_due');
      expect(SaasBillingService.mapStripeToBillingStatus('canceled')).toBe('cancelled');
      expect(SaasBillingService.mapStripeToBillingStatus('incomplete')).toBe('trialing');
      expect(SaasBillingService.mapStripeToBillingStatus('incomplete_expired')).toBe('cancelled');
      expect(SaasBillingService.mapStripeToBillingStatus('paused')).toBe('suspended');
      expect(SaasBillingService.mapStripeToBillingStatus('unknown_status' as any)).toBe('suspended');
    });
  });

  describe('Checkout Session creation', () => {
    it('creates checkout session reusing existing Stripe customer', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { stripe_monthly_price_id: 'price_starter_db' },
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      mockCustomersList.mockResolvedValueOnce({
        data: [{ id: 'cus_existing_123' }],
      });

      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      const service = getSaasBillingService();
      const res = await service.createCheckoutSession({
        tenantId: 'tenant-100',
        tier: 'starter',
        operatorEmail: 'operator@resort.com',
        operatorName: 'Alice Operator',
        subdomain: 'grandhotel',
      });

      expect(res.sessionId).toBe('cs_test_123');
      expect(res.url).toContain('https://checkout.stripe.com');
      expect(mockCustomersList).toHaveBeenCalledWith({ email: 'operator@resort.com', limit: 1 });
      expect(mockCustomersCreate).not.toHaveBeenCalled();
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing_123',
          mode: 'subscription',
          line_items: [{ price: 'price_starter_db', quantity: 1 }],
          metadata: expect.objectContaining({ tenantId: 'tenant-100', tier: 'starter' }),
        })
      );
    });

    it('creates new Stripe customer when none found and falls back to env var price if DB query fails', async () => {
      process.env.STRIPE_PRICE_GROWTH = 'price_growth_env';

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Row not found' },
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      mockCustomersList.mockResolvedValueOnce({ data: [] });
      mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_new_456' });
      mockCheckoutSessionsCreate.mockResolvedValueOnce({
        id: 'cs_growth_456',
        url: 'https://checkout.stripe.com/pay/cs_growth_456',
      });

      const service = new SaasBillingService();
      const res = await service.createCheckoutSession({
        tenantId: 'tenant-200',
        tier: 'growth',
        operatorEmail: 'growth@resort.com',
        operatorName: 'Bob Builder',
        subdomain: 'coastal',
        trialDays: 30,
      });

      expect(res.sessionId).toBe('cs_growth_456');
      expect(mockCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'growth@resort.com', name: 'Bob Builder' })
      );
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_new_456',
          line_items: [{ price: 'price_growth_env', quantity: 1 }],
          subscription_data: expect.objectContaining({ trial_period_days: 30 }),
        })
      );
    });

    it('throws error when no price ID can be resolved anywhere', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No row' } }),
        })),
      } as any);

      mockCustomersList.mockResolvedValueOnce({ data: [{ id: 'cus_1' }] });

      const service = new SaasBillingService();
      await expect(
        service.createCheckoutSession({
          tenantId: 'tenant-300',
          tier: 'enterprise',
          operatorEmail: 'ent@resort.com',
          operatorName: 'Ent User',
          subdomain: 'enterprise',
        })
      ).rejects.toThrow('No Stripe Price ID found for tier \'enterprise\'');
    });
  });

  describe('Portal sessions, subscriptions, and cancellations', () => {
    it('createPortalSession returns url with custom return path', async () => {
      mockBillingPortalSessionsCreate.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/session/portal_123',
      });

      const service = getSaasBillingService();
      const res = await service.createPortalSession('cus_123', '/admin/custom-billing');
      expect(res.url).toBe('https://billing.stripe.com/session/portal_123');
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://v2platform.com/admin/custom-billing',
      });
    });

    it('changeTier validates tier difference and updates subscription with proration', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { stripe_monthly_price_id: 'price_growth_upgraded' },
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        id: 'sub_active_1',
        items: { data: [{ id: 'si_item_1' }] },
      });

      mockSubscriptionsUpdate.mockResolvedValueOnce({
        id: 'sub_active_1',
        current_period_start: 1730700000,
      });

      const service = getSaasBillingService();

      // Same tier throws error
      await expect(service.changeTier('sub_active_1', 'growth', 'growth')).rejects.toThrow(
        "Tenant is already on the 'growth' tier"
      );

      // Upgrade tier succeeds
      const updateRes = await service.changeTier('sub_active_1', 'starter', 'growth');
      expect(updateRes.newTier).toBe('growth');
      expect(updateRes.previousTier).toBe('starter');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_active_1', {
        items: [{ id: 'si_item_1', price: 'price_growth_upgraded' }],
        proration_behavior: 'create_prorations',
        metadata: { tier: 'growth' },
      });
    });

    it('getSubscription returns subscription or catches error returning null', async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({ id: 'sub_found' } as any);

      const service = getSaasBillingService();
      const sub = await service.getSubscription('sub_found');
      expect(sub?.id).toBe('sub_found');

      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Subscription not found on Stripe'));
      const missingSub = await service.getSubscription('sub_missing');
      expect(missingSub).toBeNull();
    });

    it('cancelSubscription schedules cancellation at period end or immediately', async () => {
      const service = getSaasBillingService();

      // At period end (default)
      await service.cancelSubscription('sub_cancel_1');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_cancel_1', {
        cancel_at_period_end: true,
      });

      // Immediate
      await service.cancelSubscription('sub_cancel_2', { atPeriodEnd: false });
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_cancel_2');
    });

    it('constructWebhookEvent validates raw webhook payload using signing secret', () => {
      const mockEvent = { id: 'evt_test_1', type: 'invoice.paid' };
      mockWebhooksConstructEvent.mockReturnValueOnce(mockEvent);

      const service = getSaasBillingService();
      const rawBody = Buffer.from('{"test": true}');
      const event = service.constructWebhookEvent(rawBody, 'sig_header_123');

      expect(event).toEqual(mockEvent);
      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        rawBody,
        'sig_header_123',
        'whsec_test_saas'
      );
    });
  });
});
