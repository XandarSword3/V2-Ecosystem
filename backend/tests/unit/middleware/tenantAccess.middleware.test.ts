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

import { getSupabase } from '../../../src/database/connection';
import { resolveTenant, tenantGate } from '../../../src/middleware/tenantAccess.middleware';

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

    await resolveTenant(req, res, next);

    expect(req.tenant).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it('should NOT resolve tenant and should call next for admin reserved subdomain', async () => {
    const { req, res, next } = createMockReqRes({
      headers: {
        host: 'admin.v2platform.local:3005'
      }
    });

    await resolveTenant(req, res, next);

    expect(req.tenant).toBeUndefined();
    expect(next).toHaveBeenCalled();
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it('should block requests with 402 if billing status is suspended', async () => {
    const mockTenant = {
      id: 'tenant-suspended-999',
      subdomain: 'suspended-co',
      billing_status: 'suspended',
      subscription_tier: 'growth'
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(createChainableMock(mockTenant))
    } as any);

    const { req, res, next } = createMockReqRes({
      headers: {
        'x-tenant-id': 'tenant-suspended-999'
      }
    });

    await tenantGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });
});
