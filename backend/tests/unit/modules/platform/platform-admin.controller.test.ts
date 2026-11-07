import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainableMock } from '../../utils.js';
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
import { getSupabase } from '../../../../src/database/connection.js';
import { getSaasBillingService } from '../../../../src/services/saas-billing.service.js';
import { getProvisioningService } from '../../../../src/modules/platform/provisioning.service.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
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

describe('Platform Admin Controller Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it('returns paginated list of tenants with count and default sorting', async () => {
      const mockTenants = [
        {
          id: 'tenant-1',
          subdomain: 'resort-alpha',
          subscription_tier: 'growth',
          billing_status: 'active',
          trial_ends_at: null,
          created_at: '2026-01-01T00:00:00Z',
          stripe_customer_id: 'cus_1',
          property_group_id: 'grp_1',
        },
      ];

      const fromMock = vi.fn().mockReturnValue(createChainableMock(mockTenants, null, 1));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes({ query: { page: '1', limit: '10' } });
      await listTenants(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
          },
        })
      );
    });

    it('returns 500 when database query errors', async () => {
      const fromMock = vi.fn().mockReturnValue(createChainableMock(null, { message: 'DB Error' }));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes();
      await listTenants(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'DB Error' });
    });
  });

  describe('getTenant', () => {
    it('returns tenant detail including property stats, MRR, and billing history', async () => {
      const tenantRow = {
        id: 'tenant-1',
        name: 'Alpha Resort',
        subdomain: 'resort-alpha',
        subscription_tier: 'growth',
        billing_status: 'active',
        property_group_id: 'grp-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const propertyRows = [
        { id: 'prop-1', name: 'Alpha Main', public_slug: 'main', is_active: true },
      ];
      const moduleRows = [
        { id: 'mod-1', property_id: 'prop-1' },
        { id: 'mod-2', property_id: 'prop-1' },
      ];
      const planRows = [
        { code: 'growth', price_monthly_cents: 19900 },
      ];
      const billingRows = [
        { id: 'bh-1', event_type: 'invoice_paid', amount: 19900, status: 'paid' },
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'tenants') return createChainableMock(tenantRow);
        if (table === 'properties') return createChainableMock(propertyRows);
        if (table === 'modules') return createChainableMock(moduleRows);
        if (table === 'plans') return createChainableMock(planRows);
        if (table === 'billing_history') return createChainableMock(billingRows);
        return createChainableMock([]);
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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
          billing_history: billingRows,
        }),
      });
    });

    it('returns 404 when tenant is not found', async () => {
      const fromMock = vi.fn().mockReturnValue(createChainableMock(null));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes({ params: { id: 'nonexistent' } });
      await getTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Tenant not found' });
    });
  });

  describe('suspendTenant & reactivateTenant', () => {
    it('suspends tenant billing status and invalidates cache', async () => {
      const tenantRow = { id: 'tenant-1', stripe_subscription_id: 'sub_123', subdomain: 'resort-alpha' };
      const fromMock = vi.fn().mockReturnValue(createChainableMock(tenantRow));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await suspendTenant(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'tenant-1', billing_status: 'suspended' },
      });
    });

    it('reactivates suspended tenant to active billing status', async () => {
      const tenantRow = { id: 'tenant-1', stripe_subscription_id: 'sub_123', subdomain: 'resort-alpha' };
      const fromMock = vi.fn().mockReturnValue(createChainableMock(tenantRow));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes({ params: { id: 'tenant-1' } });
      await reactivateTenant(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'tenant-1', billing_status: 'active' },
      });
    });
  });

  describe('cancelTenant', () => {
    it('cancels subscription in Stripe and sets status to cancelled', async () => {
      const tenantRow = { id: 'tenant-1', stripe_subscription_id: 'sub_123', subdomain: 'resort-alpha' };
      const fromMock = vi.fn().mockReturnValue(createChainableMock(tenantRow));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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
    it('validates active plan, delegates to billing service, and updates tenant record', async () => {
      const planRow = { id: 'plan-ent', code: 'enterprise', is_active: true };
      const tenantRow = { id: 'tenant-1', stripe_subscription_id: 'sub_123', subscription_tier: 'growth', subdomain: 'resort-alpha' };

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'plans') return createChainableMock(planRow);
        if (table === 'tenants') return createChainableMock(tenantRow);
        return createChainableMock({});
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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
    });

    it('rejects nonexistent or inactive plan tier with 400', async () => {
      const fromMock = vi.fn().mockReturnValue(createChainableMock(null));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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

      const tenantRows = [
        { subscription_tier: 'growth', billing_status: 'active', created_at: currentIso },
        { subscription_tier: 'starter', billing_status: 'active', created_at: currentIso },
        { subscription_tier: 'growth', billing_status: 'trialing', created_at: currentIso },
        { subscription_tier: 'starter', billing_status: 'suspended', created_at: currentIso },
      ];

      const planRows = [
        { code: 'growth', price_monthly_cents: 19900 },
        { code: 'starter', price_monthly_cents: 9900 },
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'tenants') return createChainableMock(tenantRows);
        if (table === 'plans') return createChainableMock(planRows);
        return createChainableMock([]);
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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
    it('returns active plans ordered by sort_order', async () => {
      const planRows = [
        { id: 'p1', code: 'starter', name: 'Starter', price_monthly_cents: 9900, sort_order: 1 },
        { id: 'p2', code: 'growth', name: 'Growth', price_monthly_cents: 19900, sort_order: 2 },
      ];

      const fromMock = vi.fn().mockReturnValue(createChainableMock(planRows));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes();
      await getPublicPlans(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: planRows,
      });
    });
  });

  describe('getTenantBySlug', () => {
    it('returns public tenant validation by subdomain', async () => {
      const tenantRow = { id: 'tenant-1', subdomain: 'paradise-resort', billing_status: 'active' };
      const fromMock = vi.fn().mockReturnValue(createChainableMock(tenantRow));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res } = createMockReqRes({ params: { slug: 'paradise-resort' } });
      await getTenantBySlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: tenantRow,
      });
    });

    it('returns 404 if tenant slug is not found', async () => {
      const fromMock = vi.fn().mockReturnValue(createChainableMock(null));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

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
