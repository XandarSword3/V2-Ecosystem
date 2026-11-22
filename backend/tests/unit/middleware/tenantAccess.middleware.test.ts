import { vi } from 'vitest';
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

// Mock the cache util out entirely — lookupTenant caches tenant rows with a
// 5-minute TTL, which would leak a tenant resolved in one test into later
// tests that swap the supabase mock for different billing_status data. With
// cache.get resolving null, every lookup goes straight to the supabase mock.
vi.mock('../../../src/utils/cache.js', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  }
}));

import { getSupabase } from '../../../src/database/connection';
import { resolveTenant, validateTenantBilling, tenantGate } from '../../../src/middleware/tenantAccess.middleware';

describe('TenantAccess Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip tenant gate if req.skipTenantGate is true', async () => {
    const { req, res, next } = createMockReqRes({});
    req.skipTenantGate = true;

    await resolveTenant(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it('should resolve tenant via X-Tenant-ID header', async () => {
    const mockTenant = {
      id: 'tenant-123',
      subdomain: 'acme',
      billing_status: 'active',
      subscription_tier: 'growth'
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(mockTenant))
    } as any);

    const { req, res, next } = createMockReqRes({
      headers: {
        'x-tenant-id': 'tenant-123'
      }
    });

    await resolveTenant(req, res, next);

    expect(req.tenant).toEqual(mockTenant);
    expect(next).toHaveBeenCalled();
  });

  it('should resolve tenant via X-Tenant-Slug header', async () => {
    const mockTenant = {
      id: 'tenant-123',
      subdomain: 'acme',
      billing_status: 'active',
      subscription_tier: 'growth'
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(mockTenant))
    } as any);

    const { req, res, next } = createMockReqRes({
      headers: {
        'x-tenant-slug': 'acme'
      }
    });

    await resolveTenant(req, res, next);

    expect(req.tenant).toEqual(mockTenant);
    expect(next).toHaveBeenCalled();
  });

  it('should resolve tenant via valid host subdomain', async () => {
    const mockTenant = {
      id: 'tenant-123',
      subdomain: 'acme',
      billing_status: 'active',
      subscription_tier: 'growth'
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(mockTenant))
    } as any);

    const { req, res, next } = createMockReqRes({
      headers: {
        host: 'acme.v2platform.local:3005'
      }
    });

    await resolveTenant(req, res, next);

    expect(req.tenant).toEqual(mockTenant);
    expect(next).toHaveBeenCalled();
  });

  it('should return 404 if host subdomain is specified but tenant is not found', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(null))
    } as any);

    const { req, res, next } = createMockReqRes({
      headers: {
        host: 'nonexistent.v2platform.local:3005'
      }
    });

    await resolveTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Tenant not found'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should NOT resolve tenant and should call next for reserved subdomains', async () => {
    const { req, res, next } = createMockReqRes({
      headers: {
        host: 'api.v2platform.local:3005'
      }
    });

    // Reserved subdomains never resolve as a tenant themselves; the flow
    // falls through to the platform-root lookup (unseeded here → null).
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(null))
    } as any);

    await resolveTenant(req, res, next);

    expect(req.tenant).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should NOT resolve tenant and should call next for admin reserved subdomain', async () => {
    const { req, res, next } = createMockReqRes({
      headers: {
        host: 'admin.v2platform.local:3005'
      }
    });

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(null))
    } as any);

    await resolveTenant(req, res, next);

    expect(req.tenant).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  describe('Two-tier billing gate (validateTenantBilling)', () => {
    /** Builds req/res mocks with an explicit request path context. */
    function gateMocks(path: string, method = 'GET') {
      const { req, res, next } = createMockReqRes({
        headers: { 'x-tenant-slug': 'billing-co' },
      });
      (req as any).originalUrl = path;
      (req as any).path = path;
      req.method = method as any;
      return { req, res, next };
    }

    const suspendedTenant = {
      id: 'tenant-suspended-999',
      subdomain: 'billing-co',
      billing_status: 'suspended',
      subscription_tier: 'growth',
    };
    const pastDueTenant = {
      id: 'tenant-pastdue-123',
      subdomain: 'billing-co',
      billing_status: 'past_due',
      subscription_tier: 'growth',
    };

    beforeEach(() => {
      withTenant(suspendedTenant);
    });

    function withTenant(tenant: unknown) {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(tenant)),
      } as any);
    }

    it('ambiguous (no path context) — treated as public: sanitized 503, billing payload fail-closed', async () => {
      // Regression guard for the fail-safe default: unit mocks without
      // originalUrl/path must NOT receive the operator-grade 402 payload.
      const { req, res, next } = createMockReqRes({
        headers: { 'x-tenant-slug': 'billing-co' },
      });
      req.method = 'GET' as any;

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SERVICE_UNAVAILABLE', success: false })
      );
      // No billing internals leak
      expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ billing_status: 'suspended' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('suspended + operator path — actionable 402 with billing_status + portal flag', async () => {
      const { req, res, next } = gateMocks('/api/v1/admin/modules', 'GET');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          billing_status: 'suspended',
          billing_portal_available: true,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('suspended + public storefront path — sanitized 503, no billing vocabulary', async () => {
      const { req, res, next } = gateMocks('/api/v1/restaurant/items', 'GET');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('suspended + GET billing portal — self-service exemption passes through', async () => {
      const { req, res, next } = gateMocks('/api/v1/platform/billing/portal', 'GET');

      await tenantGate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('suspended + WRITE billing portal — exemption is GET-only, still blocked', async () => {
      const { req, res, next } = gateMocks('/api/v1/platform/billing/portal', 'POST');

      await tenantGate(req, res, next);

      // Operator surface → actionable 402 (not the sanitized public 503)
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ billing_status: 'suspended' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('active tenant — every surface passes with no billing warning', async () => {
      withTenant({
        id: 'tenant-active-000',
        subdomain: 'billing-co',
        billing_status: 'active',
        subscription_tier: 'growth',
      });
      const { req, res, next } = gateMocks('/api/v1/admin/modules', 'POST');

      await tenantGate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-Billing-Warning', 'payment_overdue');
    });

    const cancelledTenant = {
      id: 'tenant-cancelled-456',
      subdomain: 'billing-co',
      billing_status: 'cancelled',
      subscription_tier: 'growth',
    };

    it('cancelled + operator path — 402 with billing_status cancelled and no portal lifeline', async () => {
      withTenant(cancelledTenant);
      const { req, res, next } = gateMocks('/api/v1/admin/modules', 'GET');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          billing_status: 'cancelled',
          billing_portal_available: false,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('cancelled + public storefront path — sanitized 503, no billing vocabulary', async () => {
      withTenant(cancelledTenant);
      const { req, res, next } = gateMocks('/api/v1/restaurant/items', 'GET');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' })
      );
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ billing_status: 'cancelled' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('cancelled + GET billing portal — self-service exemption does NOT apply', async () => {
      withTenant(cancelledTenant);
      const { req, res, next } = gateMocks('/api/v1/platform/billing/portal', 'GET');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ billing_status: 'cancelled' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('past_due + operator GET — reads pass, X-Billing-Warning header set', async () => {
      withTenant(pastDueTenant);
      const { req, res, next } = gateMocks('/api/v1/staff/modules/restaurant/orders', 'GET');

      await tenantGate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Billing-Warning', 'payment_overdue');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('past_due + public GET — reads pass, NO billing header (no leakage to guests)', async () => {
      withTenant(pastDueTenant);
      const { req, res, next } = gateMocks('/api/v1/restaurant/items', 'GET');

      await tenantGate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-Billing-Warning', 'payment_overdue');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('past_due + operator write — 402 read-only grace message + portal flag', async () => {
      withTenant(pastDueTenant);
      const { req, res, next } = gateMocks('/api/v1/admin/modules', 'POST');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_status: 'past_due',
          billing_portal_available: true,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('past_due + public write — sanitized 503', async () => {
      withTenant(pastDueTenant);
      const { req, res, next } = gateMocks('/api/v1/restaurant/orders', 'POST');

      await tenantGate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
