/**
 * Cross-engine admin transactions controller tests (F11 unified Orders).
 *
 * Verifies:
 * 1. Property-scoped query over the canonical transactions table
 * 2. Tenant defense-in-depth (modules filtered by JWT tenant)
 * 3. Engine whitelisting on the engine_type filter
 * 4. Engine-agnostic projection: two-layer states, module label,
 *    unified reference number, batch-loaded customer names
 * 5. Fail-closed when property context is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockTenantId = vi.fn().mockReturnValue('tenant-1');
vi.mock('../../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: (...args: unknown[]) => mockTenantId(...args),
}));

import { getCrossEngineTransactions } from '../../../../src/modules/admin/controllers/transactions.controller.js';

const MODULE_ID_A = 'mod-aaaa-1111';
const MODULE_ID_B = 'mod-bbbb-2222';

const MODULES = [
  { id: MODULE_ID_A, slug: 'bistro', name: 'Bistro', engine_type: 'instant_transaction', tenant_id: 'tenant-1' },
  { id: MODULE_ID_B, slug: 'chalets', name: 'Chalets', engine_type: 'time_exclusive_reservation', tenant_id: 'tenant-1' },
];

const TXS = [
  {
    id: 'tx-1',
    engine_type: 'instant_transaction',
    module_id: MODULE_ID_A,
    status: 'confirmed',
    fulfillment_status: 'in_progress',
    amount: 42.5,
    currency: 'USD',
    customer_id: 'usr-1',
    metadata: { order_number: 'ORD-100' },
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-15T10:05:00Z',
  },
  {
    id: 'tx-2',
    engine_type: 'time_exclusive_reservation',
    module_id: MODULE_ID_B,
    status: 'confirmed',
    fulfillment_status: null,
    amount: 450,
    currency: 'USD',
    customer_id: 'usr-2',
    metadata: { booking_number: 'BKG-7', customer_name: 'Meta Guest' },
    created_at: '2026-09-15T09:00:00Z',
    updated_at: '2026-09-15T09:01:00Z',
  },
];

/** Chainable query builder whose terminal result is configurable. */
function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in', 'neq', 'or', 'order', 'range', 'limit'];
  for (const m of chain) obj[m] = vi.fn().mockReturnValue(obj);
  obj.then = (resolve: (v: unknown) => void) => {
    resolve({ data: terminalData, error: terminalError, count: Array.isArray(terminalData) ? terminalData.length : null });
    return Promise.resolve({ data: terminalData, error: terminalError, count: null });
  };
  return obj;
}

function mockReq(overrides: {
  propertyId?: string;
  headers?: Record<string, string>;
  user?: Record<string, unknown>;
  query?: Record<string, string>;
}): Request {
  // Query-string style overrides (engine_type, status, limit, offset) go in
  // req.query; propertyId/headers/user stay top-level.
  return {
    query: overrides.query ?? {},
    headers: overrides.headers ?? {},
    propertyId: overrides.propertyId,
    user: overrides.user ?? { userId: 'admin-1', roles: ['manager'], tenantId: 'tenant-1' },
  } as unknown as Request;
}

function mockRes() {
  const res: Record<string, unknown> = { statusCode: 200 };
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn().mockImplementation((b: unknown) => ({ body: b }));
  return res as unknown as Response & { statusCode: number; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
}

describe('getCrossEngineTransactions (F11 unified Orders)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
  });

  it('fails closed with 400 when property context is missing', async () => {
    const req = mockReq({ propertyId: undefined, headers: {} });
    const res = mockRes();

    await getCrossEngineTransactions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('scopes modules to property AND caller tenant (defense-in-depth)', async () => {
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'transactions') return chainable(TXS);
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    // modules query: property filter and tenant filter both applied
    expect(modulesQuery.eq).toHaveBeenCalledWith('property_id', 'prop-1');
    expect(modulesQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('unscoped platform operator (null tenant) skips tenant filter but keeps property scope', async () => {
    mockTenantId.mockReturnValue(null);
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'transactions') return chainable(TXS);
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    expect(modulesQuery.eq).toHaveBeenCalledWith('property_id', 'prop-1');
    const tenantCalls = (modulesQuery.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'tenant_id',
    );
    expect(tenantCalls).toHaveLength(0);
  });

  it('whitelists engine_type filter values', async () => {
    const txQuery = chainable(TXS.filter((t) => t.engine_type === 'instant_transaction'));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'transactions') return txQuery;
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1', query: { engine_type: 'instant_transaction' } });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    expect(txQuery.eq).toHaveBeenCalledWith('engine_type', 'instant_transaction');
    expect(res.statusCode).toBe(200);
  });

  it('ignores non-whitelisted engine_type filter values', async () => {
    const txQuery = chainable(TXS);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'transactions') return txQuery;
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1', query: { engine_type: "'; drop table users; --" } });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    const engineCalls = (txQuery.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'engine_type',
    );
    expect(engineCalls).toHaveLength(0);
  });

  it('projects engine-agnostic shape: two-layer states, module label, unified reference', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'users') return chainable([
        { id: 'usr-1', full_name: 'Alice' },
        { id: 'usr-2', full_name: 'Bob' },
      ]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);

    const [first, second] = body.data.transactions;

    // Two-layer rule: transaction state and fulfillment state separate
    expect(first.transactionState).toBe('confirmed');
    expect(first.fulfillmentStatus).toBe('in_progress');
    expect(second.transactionState).toBe('confirmed');
    expect(second.fulfillmentStatus).toBeNull();

    // Module label attached
    expect(first.module).toEqual({ slug: 'bistro', name: 'Bistro' });
    expect(second.module).toEqual({ slug: 'chalets', name: 'Chalets' });

    // Unified reference: order_number or booking_number fallback
    expect(first.reference).toBe('ORD-100');
    expect(second.reference).toBe('BKG-7');

    // Customer names resolved via single batch query
    expect(first.customerName).toBe('Alice');
    expect(second.customerName).toBe('Meta Guest'); // metadata wins over users row
  });

  it('returns empty payload when the property has no modules', async () => {
    mockFrom.mockImplementation(() => chainable([]));

    const req = mockReq({ propertyId: 'prop-empty' });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.transactions).toEqual([]);
    expect(body.data.modules).toEqual([]);
  });

  it('clamps pagination to sane bounds', async () => {
    const txQuery = chainable(TXS);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'transactions') return txQuery;
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    const req = mockReq({ propertyId: 'prop-1', query: { limit: '99999', offset: '-5' } });
    const res = mockRes();
    await getCrossEngineTransactions(req, res);

    // range called with clamped offset 0 and offset+limit-1 <= 500
    const rangeCall = (txQuery.range as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rangeCall[0]).toBe(0);
    expect(rangeCall[1]).toBeLessThanOrEqual(499);
  });
});
