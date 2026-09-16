/**
 * Cross-module admin customers controller tests (F11 Customers capability).
 *
 * Verifies:
 * 1. Property-scoped + tenant defense-in-depth (property must belong to
 *    the caller's tenant when homed to one)
 * 2. Customer-role filtering from embedded user_roles
 * 3. Transaction aggregates across ALL engine types (canonical table)
 * 4. Search filtering and LTV sorting
 * 5. Fail-closed without property context; empty-property shortcut
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

import { getCrossModuleCustomers } from '../../../../src/modules/admin/controllers/customers.controller.js';

const ACCESS_ROWS = [
  {
    user_id: 'u-1',
    users: {
      id: 'u-1',
      full_name: 'Amelia Stone',
      email: 'amelia@example.com',
      created_at: '2025-01-01T00:00:00Z',
      user_roles: [{ roles: { name: 'customer' } }],
    },
  },
  {
    user_id: 'u-2',
    users: {
      id: 'u-2',
      full_name: 'Ben Oduya',
      email: 'ben@example.com',
      created_at: '2025-02-01T00:00:00Z',
      user_roles: [{ roles: { name: 'customer' } }],
    },
  },
  {
    user_id: 'u-3',
    users: {
      id: 'u-3',
      full_name: 'Cora Staff',
      email: 'cora@example.com',
      created_at: '2025-03-01T00:00:00Z',
      user_roles: [{ roles: { name: 'property_staff' } }],
    },
  },
];

const TXS = [
  // u-1: two transactions across different engine types → LTV 32.50
  { customer_id: 'u-1', amount: 12.5, created_at: '2026-01-15T10:00:00Z' },
  { customer_id: 'u-1', amount: 20.0, created_at: '2026-02-20T10:00:00Z' },
  // u-2: one transaction → LTV 8.00
  { customer_id: 'u-2', amount: 8.0, created_at: '2026-03-01T10:00:00Z' },
  // u-3 is staff, but their rows must not leak into anyone's aggregates
  { customer_id: 'u-3', amount: 999, created_at: '2026-03-02T10:00:00Z' },
];

function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in', 'neq', 'order', 'range', 'limit', 'not', 'gte', 'lte', 'maybeSingle'];
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

function setupDb(opts: { access?: unknown; txs?: unknown; property?: unknown } = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'user_property_access') return chainable(opts.access ?? ACCESS_ROWS);
    if (table === 'transactions') return chainable(opts.txs ?? TXS);
    if (table === 'properties') return chainable(opts.property ?? { id: 'prop-1', tenant_id: 'tenant-1' });
    return chainable([]);
  });
}

describe('getCrossModuleCustomers (F11 Customers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
  });

  it('fails closed with 400 when property context is missing', async () => {
    const req = {
      query: {},
      headers: {},
      user: { userId: 'admin-1', roles: ['manager'], tenantId: 'tenant-1' },
    } as unknown as Request;
    const res = mockRes();
    await getCrossModuleCustomers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('verifies property belongs to caller tenant (defense-in-depth)', async () => {
    setupDb();
    const propQuery = chainable({ id: 'prop-1', tenant_id: 'tenant-1' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'properties') return propQuery;
      if (table === 'user_property_access') return chainable(ACCESS_ROWS);
      if (table === 'transactions') return chainable(TXS);
      return chainable([]);
    });

    await getCrossModuleCustomers(mockReq(), mockRes());

    expect(propQuery.eq).toHaveBeenCalledWith('id', 'prop-1');
    expect((propQuery as any).maybeSingle).toBeDefined();
  });

  it('returns 404 when property belongs to another tenant', async () => {
    mockTenantId.mockReturnValue('tenant-attacker');
    setupDb({ property: { id: 'prop-1', tenant_id: 'tenant-1' } });

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('skips tenant verification for platform super_admins', async () => {
    mockTenantId.mockReturnValue(null); // super_admin homed to no tenant
    setupDb();

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    expect(mockFrom).not.toHaveBeenCalledWith('properties');
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it('filters to customer role only and aggregates across engine types', async () => {
    setupDb();

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);

    const [amelia, ben] = body.data.customers;
    expect(body.data.total).toBe(2); // staff member excluded

    expect(amelia.name).toBe('Amelia Stone');
    expect(amelia.orderCount).toBe(2);
    expect(amelia.lifetimeValue).toBeCloseTo(32.5);
    expect(amelia.lastOrderAt).toBe('2026-02-20T10:00:00Z');

    expect(ben.orderCount).toBe(1);
    expect(ben.lifetimeValue).toBeCloseTo(8.0);
  });

  it('sorts by lifetime value descending', async () => {
    setupDb();

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const values = body.data.customers.map((c: { lifetimeValue: number }) => c.lifetimeValue);
    expect(values).toEqual([...values].sort((a: number, b: number) => b - a));
  });

  it('filters by search term across name and email', async () => {
    setupDb();

    const res = mockRes();
    await getCrossModuleCustomers(mockReq({ search: 'amelia' }), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data.customers).toHaveLength(1);
    expect(body.data.customers[0].name).toBe('Amelia Stone');
  });

  it('returns empty payload when property has no customers', async () => {
    setupDb({ access: [] });

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.customers).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('handles customers with zero transactions', async () => {
    setupDb({ txs: [] });

    const res = mockRes();
    await getCrossModuleCustomers(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const [amelia] = body.data.customers;
    expect(amelia.orderCount).toBe(0);
    expect(amelia.lifetimeValue).toBe(0);
    expect(amelia.lastOrderAt).toBeNull();
  });
});
