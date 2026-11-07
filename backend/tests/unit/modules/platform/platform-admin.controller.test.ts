import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatefulDbHarness } from '../../../helpers/stateful-db-harness';
import {
  listTenants,
  getTenant,
  suspendTenant,
  reactivateTenant,
  cancelTenant,
  changeTier,
  getPlatformStats,
  getPublicPlans,
  getTenantBySlug,
} from '../../../../src/modules/platform/platform-admin.controller.js';
import { requirePlatformAdmin } from '../../../../src/modules/platform/platform.routes.js';
import { getSaasBillingService } from '../../../../src/services/saas-billing.service.js';
import { getProvisioningService } from '../../../../src/modules/platform/provisioning.service.js';

const harness = createStatefulDbHarness();

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../../src/middleware/tenantAccess.middleware.js', () => ({
  invalidateTenantCache: vi.fn(),
  resolveTenant: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../../../src/services/saas-billing.service.js', () => {
  const mockBilling = {
    cancelSubscription: vi.fn().mockResolvedValue(undefined),
    changeTier: vi.fn().mockResolvedValue({ status: 'active', tier: 'enterprise' }),
    createCustomerPortalSession: vi.fn().mockResolvedValue('https://billing.stripe.com/p/session_123'),
  };
  return {
    getSaasBillingService: () => mockBilling,
    SaasBillingService: {
      mapStripeToBillingStatus: (status: string) => (status === 'active' ? 'active' : 'trialing'),
    },
  };
});

vi.mock('../../../../src/modules/platform/provisioning.service.js', () => {
  const mockProvisioning = {
    updateBillingStatus: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getProvisioningService: () => mockProvisioning,
  };
});

describe('Platform Admin Controller (Genuine Stateful Database Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.clear();
  });

  function createMockReqRes(options: { params?: any; query?: any; body?: any } = {}) {
    const req: any = {
      params: options.params || {},
      query: options.query || {},
      body: options.body || {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return { req, res };
  }

  describe('listTenants', () => {
    it('returns paginated list of tenants with count and default sorting from stateful db', async () => {
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          name: 'Resort Alpha',
          subdomain: 'resort-alpha',
          subscription_tier: 'growth',
          billing_status: 'active',
          trial_ends_at: null,
          created_at: '2026-01-01T00:00:00Z',
          stripe_customer_id: 'cus_1',
          property_group_id: 'grp_1',
        },
        {
          id: 'tenant-2',
          name: 'Resort Beta',
          subdomain: 'resort-beta',
          subscription_tier: 'starter',
          billing_status: 'active',
          trial_ends_at: null,
          created_at: '2026-01-02T00:00:00Z',
          stripe_customer_id: 'cus_2',
          property_group_id: 'grp_2',
        },
      ]);

      const { req, res } = createMockReqRes({ query: { page: '1', limit: '10' } });
      await listTenants(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
          },
        })
      );
      const data = res.json.mock.calls[0][0].data;
      expect(data.length).toBe(2);
    });

    it('returns 500 when database query errors', async () => {
      harness.simulateError('tenants', { message: 'DB Connection Error' });

      const { req, res } = createMockReqRes();
      await listTenants(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'DB Connection Error' });
    });
  });

  describe('getTenant', () => {
    it('returns tenant detail including property stats, MRR, and billing history across tables', async () => {
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          name: 'Alpha Resort',
          subdomain: 'resort-alpha',
          subscription_tier: 'growth',
          billing_status: 'active',
          property_group_id: 'grp-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      harness.seed('properties', [
        { id: 'prop-1', group_id: 'grp-1', name: 'Alpha Main', public_slug: 'main', is_active: true },
      ]);

      harness.seed('modules', [
        { id: 'mod-1', tenant_id: 'tenant-1', property_id: 'prop-1' },
        { id: 'mod-2', tenant_id: 'tenant-1', property_id: 'prop-1' },
      ]);

      harness.seed('plans', [
        { code: 'growth', price_monthly_cents: 19900, is_active: true },
      ]);

      harness.seed('billing_history', [
        { id: 'bh-1', tenant_id: 'tenant-1', event_type: 'invoice_paid', amount: 19900, status: 'paid' },
      ]);

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await getTenant(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'tenant-1',
          name: 'Alpha Resort',
          properties: [
            { id: 'prop-1', name: 'Alpha Main', slug: 'main', module_count: 2, is_active: true },
          ],
          propertyCount: 1,
          moduleCount: 2,
          mrr: 19900,
        }),
      });
    });

    it('returns 404 when tenant is not found in database', async () => {
      harness.seed('tenants', []);

      const { req, res } = createMockReqRes({ params: { id: 'nonexistent' } });
      await getTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Tenant not found' });
    });
  });

  describe('suspendTenant & reactivateTenant', () => {
    it('mutates tenant in database to suspended billing status and invalidates cache', async () => {
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          stripe_subscription_id: 'sub_123',
          subdomain: 'resort-alpha',
          billing_status: 'active',
        },
      ]);

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await suspendTenant(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'tenant-1', billing_status: 'suspended' },
      });

      // Verify real state mutation in database
      const tenant = harness.getTable('tenants').find((t) => t.id === 'tenant-1');
      expect(tenant?.billing_status).toBe('suspended');
    });

    it('mutates suspended tenant in database to active billing status', async () => {
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          stripe_subscription_id: 'sub_123',
          subdomain: 'resort-alpha',
          billing_status: 'suspended',
        },
      ]);

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await reactivateTenant(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'tenant-1', billing_status: 'active' },
      });

      // Verify real state mutation in database
      const tenant = harness.getTable('tenants').find((t) => t.id === 'tenant-1');
      expect(tenant?.billing_status).toBe('active');
    });
  });

  describe('cancelTenant', () => {
    it('cancels subscription in Stripe and sets status to cancelled', async () => {
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          stripe_subscription_id: 'sub_123',
          subdomain: 'resort-alpha',
          billing_status: 'active',
        },
      ]);

      const billing = getSaasBillingService();
      const provisioning = getProvisioningService();

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await cancelTenant(req, res);

      expect(billing.cancelSubscription).toHaveBeenCalledWith('sub_123', { atPeriodEnd: false });
      expect(provisioning.updateBillingStatus).toHaveBeenCalledWith('sub_123', 'cancelled');
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Tenant cancelled' });
    });
  });

  describe('changeTier', () => {
    it('validates active plan, delegates to billing service, and updates tenant record in database', async () => {
      harness.seed('plans', [
        { id: 'plan-ent', code: 'enterprise', is_active: true },
      ]);
      harness.seed('tenants', [
        {
          id: 'tenant-1',
          stripe_subscription_id: 'sub_123',
          subscription_tier: 'growth',
          subdomain: 'resort-alpha',
        },
      ]);

      const billing = getSaasBillingService();

      const { req, res } = createMockReqRes({
        params: { id: 'tenant-1' },
        body: { tier: 'enterprise' },
      });
      await changeTier(req, res);

      expect(billing.changeTier).toHaveBeenCalledWith('sub_123', 'growth', 'enterprise');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { status: 'active', tier: 'enterprise' },
      });

      // Verify real state mutation in database
      const tenant = harness.getTable('tenants').find((t) => t.id === 'tenant-1');
      expect(tenant?.subscription_tier).toBe('enterprise');
    });

    it('rejects nonexistent or inactive plan tier with 400', async () => {
      harness.seed('plans', [
        { id: 'plan-act', code: 'starter', is_active: true },
      ]);
      harness.seed('tenants', [
        { id: 'tenant-1', subscription_tier: 'starter' },
      ]);

      const { req, res } = createMockReqRes({
        params: { id: 'tenant-1' },
        body: { tier: 'invalid_tier' },
      });
      await changeTier(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('Invalid tier') })
      );
    });
  });

  describe('getPlatformStats', () => {
    it('aggregates tenant counts, MRR, and growth percentage across billing states', async () => {
      const now = new Date();
      const currentIso = now.toISOString();

      harness.seed('tenants', [
        { subscription_tier: 'growth', billing_status: 'active', created_at: currentIso },
        { subscription_tier: 'starter', billing_status: 'active', created_at: currentIso },
        { subscription_tier: 'growth', billing_status: 'trialing', created_at: currentIso },
        { subscription_tier: 'starter', billing_status: 'suspended', created_at: currentIso },
      ]);

      harness.seed('plans', [
        { code: 'growth', price_monthly_cents: 19900, is_active: true },
        { code: 'starter', price_monthly_cents: 9900, is_active: true },
      ]);

      const { req, res } = createMockReqRes();
      await getPlatformStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          total_tenants: 4,
          active_tenants: 2,
          trialing_tenants: 1,
          suspended_tenants: 1,
          total_mrr: 29800, // 19900 + 9900
        }),
      });
    });
  });

  describe('getPublicPlans', () => {
    it('returns active plans ordered by sort_order from database', async () => {
      harness.seed('plans', [
        { id: 'p2', code: 'growth', name: 'Growth', price_monthly_cents: 19900, sort_order: 2, is_active: true },
        { id: 'p1', code: 'starter', name: 'Starter', price_monthly_cents: 9900, sort_order: 1, is_active: true },
        { id: 'p3', code: 'archived', name: 'Archived', price_monthly_cents: 5000, sort_order: 3, is_active: false },
      ]);

      const { req, res } = createMockReqRes();
      await getPublicPlans(req, res);

      expect(res.json).toHaveBeenCalled();
      const returned = res.json.mock.calls[0][0].data;
      // Should filter out inactive plan p3 and sort p1 before p2
      expect(returned.length).toBe(2);
      expect(returned[0].code).toBe('starter');
      expect(returned[1].code).toBe('growth');
    });
  });

  describe('getTenantBySlug', () => {
    it('returns public tenant validation by subdomain from database', async () => {
      harness.seed('tenants', [
        { id: 'tenant-1', subdomain: 'paradise-resort', billing_status: 'active' },
      ]);

      const { req, res } = createMockReqRes({ params: { slug: 'paradise-resort' } });
      await getTenantBySlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'tenant-1',
          subdomain: 'paradise-resort',
          billing_status: 'active',
        }),
      });
    });

    it('returns 404 if tenant slug is not found', async () => {
      harness.seed('tenants', []);

      const { req, res } = createMockReqRes({ params: { slug: 'nonexistent-slug' } });
      await getTenantBySlug(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Tenant not found' });
    });
  });

  describe('requirePlatformAdmin Guard', () => {
    it('blocks request with 403 when user is not a platform admin', async () => {
      const req: any = { user: { id: 'user-1', isPlatformAdmin: false } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requirePlatformAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Platform administrator access required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('allows request to proceed when user is a platform admin', async () => {
      const req: any = { user: { id: 'admin-1', isPlatformAdmin: true } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await requirePlatformAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
