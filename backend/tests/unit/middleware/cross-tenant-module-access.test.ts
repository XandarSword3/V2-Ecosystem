import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';
import { requireModulePropertyAccess } from '../../../src/middleware/propertyAccess.middleware';

// Mock getSupabase
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../../src/database/connection';

describe('Regression Bug #2: Cross-Tenant Module Access Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects staff from Tenant A attempting to access module belonging to Tenant B (property_id present)', async () => {
    const middleware = requireModulePropertyAccess('restaurant-b');
    const { req, res, next } = createMockReqRes({
      user: {
        id: 'staff-a',
        role: 'staff',
        userId: 'staff-a',
        tenantId: 'tenant-a-uuid',
      },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({
          id: 'module-b-uuid',
          property_id: 'property-b-uuid',
          tenant_id: 'tenant-b-uuid',
        });
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('cross-tenant'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects staff from Tenant A attempting to access module belonging to Tenant B (property_id NULL)', async () => {
    const middleware = requireModulePropertyAccess('unscoped-module-b');
    const { req, res, next } = createMockReqRes({
      user: {
        id: 'staff-a',
        role: 'staff',
        userId: 'staff-a',
        tenantId: 'tenant-a-uuid',
      },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({
          id: 'module-unscoped-b-uuid',
          property_id: null,
          tenant_id: 'tenant-b-uuid',
        });
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('cross-tenant'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows staff from Tenant A to access module belonging to Tenant A with valid property assignment', async () => {
    const middleware = requireModulePropertyAccess('restaurant-a');
    const propertyId = 'property-a-uuid';
    const { req, res, next } = createMockReqRes({
      user: {
        id: 'staff-a',
        role: 'staff',
        userId: 'staff-a',
        tenantId: 'tenant-a-uuid',
      },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({
          id: 'module-a-uuid',
          property_id: propertyId,
          tenant_id: 'tenant-a-uuid',
        });
      }
      if (table === 'user_property_access') {
        return createChainableMock([{ id: 'access-row-1' }], null, 1);
      }
      return createChainableMock([]);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).propertyId).toBe(propertyId);
  });

  it('allows tenant admin from Tenant A to access unscoped module belonging to Tenant A', async () => {
    const middleware = requireModulePropertyAccess('unscoped-module-a');
    const { req, res, next } = createMockReqRes({
      user: {
        id: 'admin-a',
        role: 'admin',
        userId: 'admin-a',
        tenantId: 'tenant-a-uuid',
        scope: 'tenant_admin',
      },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({
          id: 'module-unscoped-a-uuid',
          property_id: null,
          tenant_id: 'tenant-a-uuid',
        });
      }
      return createChainableMock([]);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
