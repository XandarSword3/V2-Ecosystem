/**
 * Cross-module admin catalog controller tests (F11 Products + Phase 8
 * catalog lifecycle).
 *
 * Verifies:
 * 1. Property-scoped + tenant defense-in-depth module resolution
 * 2. Whitelisted lifecycle_status filter (invalid values ignored)
 * 3. Module slug filter resolution
 * 4. Engine-agnostic projection with independent Phase 8 dimensions
 *    (lifecycleStatus / isAvailable / isSellable)
 * 5. Fail-closed without property context; empty property shortcut
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockTenantId = vi.fn().mockReturnValue('tenant-1');
vi.mock('../../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: () => mockTenantId(),
}));

import { getCrossModuleCatalog } from '../../../../src/modules/admin/controllers/catalog.controller.js';

const MODULE_ID = 'mod-cat-0001';

const MODULES = [
  { id: MODULE_ID, slug: 'bistro', name: 'Bistro', engine_type: 'instant_transaction', tenant_id: 'tenant-1' },
];

const ITEMS = [
  {
    id: 'ci-1', module_id: MODULE_ID, name: 'Club Sandwich', description: 'Turkey and bacon',
    price: 12.5, currency: 'USD', is_available: true, lifecycle_status: 'active',
    category_id: 'cat-1', metadata: { source: 'menu' },
  },
  {
    id: 'ci-2', module_id: MODULE_ID, name: 'Seafood Paella', description: null,
    price: 24, currency: 'USD', is_available: false, lifecycle_status: 'active',
    category_id: 'cat-1', metadata: null,
  },
  {
    id: 'ci-3', module_id: MODULE_ID, name: 'Winter Special', description: 'Seasonal',
    price: 18, currency: 'USD', is_available: false, lifecycle_status: 'temporarily_unavailable',
    category_id: 'cat-2', metadata: null,
  },
];

function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in', 'neq', 'order', 'range', 'limit'];
  for (const m of chain) obj[m] = vi.fn().mockReturnValue(obj);
  obj.then = (resolve: (v: unknown) => void) => {
    resolve({ data: terminalData, error: terminalError, count: null });
    return Promise.resolve({ data: terminalData, error: terminalError, count: null });
  };
  return obj;
}

function mockReq(query: Record<string, string> = {}, propertyId: string | undefined = 'prop-1'): Request {
  return {
    query,
    headers: {},
    propertyId,
    user: { userId: 'admin-1', roles: ['manager'], tenantId: 'tenant-1' },
  } as unknown as Request;
}

function mockRes() {
  const res: Record<string, unknown> = { statusCode: 200 };
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn().mockImplementation((b: unknown) => b);
  return res as unknown as Response & { statusCode: number; json: ReturnType<typeof vi.fn> };
}

describe('getCrossModuleCatalog (F11 Products)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
  });

  it('fails closed with 400 when property context is missing', async () => {
    // No propertyId on req, no x-property-id header → must 400, not 500
    const req = {
      query: {},
      headers: {},
      user: { userId: 'admin-1', roles: ['manager'], tenantId: 'tenant-1' },
    } as unknown as Request;
    const res = mockRes();
    await getCrossModuleCatalog(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('scopes modules to property AND caller tenant', async () => {
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'catalog_items') return chainable(ITEMS);
      return chainable([]);
    });

    const res = mockRes();
    await getCrossModuleCatalog(mockReq(), res);

    expect(modulesQuery.eq).toHaveBeenCalledWith('property_id', 'prop-1');
    expect(modulesQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('applies whitelisted lifecycle filter and ignores invalid values', async () => {
    const itemsQuery = chainable(ITEMS.filter((i) => i.lifecycle_status === 'active'));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return itemsQuery;
      return chainable([]);
    });

    // Valid filter reaches the query
    await getCrossModuleCatalog(mockReq({ lifecycle_status: 'active' }), mockRes());
    expect(itemsQuery.eq).toHaveBeenCalledWith('lifecycle_status', 'active');

    // Injection attempt is ignored entirely
    const itemsQuery2 = chainable(ITEMS);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return itemsQuery2;
      return chainable([]);
    });
    await getCrossModuleCatalog(mockReq({ lifecycle_status: "active'; drop table catalog_items; --" }), mockRes());
    const lifecycleCalls = (itemsQuery2.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'lifecycle_status',
    );
    expect(lifecycleCalls).toHaveLength(0);
  });

  it('resolves module slug filter to the module id', async () => {
    const itemsQuery = chainable(ITEMS);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return itemsQuery;
      return chainable([]);
    });

    await getCrossModuleCatalog(mockReq({ module: 'bistro' }), mockRes());
    expect(itemsQuery.eq).toHaveBeenCalledWith('module_id', MODULE_ID);
  });

  it('projects independent Phase 8 dimensions and sellability rule', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return chainable(ITEMS);
      return chainable([]);
    });

    const res = mockRes();
    await getCrossModuleCatalog(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    const [sandwich, paella, special] = body.data.items;

    // active + available → sellable
    expect(sandwich.lifecycleStatus).toBe('active');
    expect(sandwich.isAvailable).toBe(true);
    expect(sandwich.isSellable).toBe(true);

    // active + availability off → NOT sellable (the "86" toggle)
    expect(paella.lifecycleStatus).toBe('active');
    expect(paella.isAvailable).toBe(false);
    expect(paella.isSellable).toBe(false);

    // temporarily_unavailable → never sellable regardless of toggle
    expect(special.lifecycleStatus).toBe('temporarily_unavailable');
    expect(special.isSellable).toBe(false);

    // Module label attached
    expect(sandwich.module).toEqual({ slug: 'bistro', name: 'Bistro' });
  });

  it('returns empty payload when the property has no modules', async () => {
    mockFrom.mockImplementation(() => chainable([]));

    const res = mockRes();
    await getCrossModuleCatalog(mockReq({}, 'prop-empty'), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.modules).toEqual([]);
  });

  it('filters by search term across name and description', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return chainable(ITEMS);
      return chainable([]);
    });

    const res = mockRes();
    await getCrossModuleCatalog(mockReq({ search: 'seafood' }), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe('Seafood Paella');
  });
});
