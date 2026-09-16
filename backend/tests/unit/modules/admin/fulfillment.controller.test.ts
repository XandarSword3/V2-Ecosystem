/**
 * Unified fulfillment queue controller tests (F11 Fulfillment capability).
 *
 * Verifies:
 * 1. Property-scoped + tenant defense-in-depth module resolution
 * 2. Cross-engine join through canonical fulfillments → transactions
 * 3. Engine-computed available actions per row (never hardcoded states)
 * 4. Two-layer projection (fulfillmentStatus vs transactionStatus)
 * 5. Fail-closed without property context; empty property shortcut
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
const { mockGetAvailableActions } = vi.hoisted(() => ({ mockGetAvailableActions: vi.fn() }));

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

vi.mock('../../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({
    getAvailableActions: (...args: unknown[]) => mockGetAvailableActions(...args),
  }),
}));

vi.mock('../../../../src/modules/fulfillment/index.js', () => ({
  getFulfillmentService: () => ({}),
}));

import { getFulfillmentQueue } from '../../../../src/modules/admin/controllers/fulfillment.controller.js';

const MODULES = [
  { id: 'mod-1', slug: 'bistro', name: 'Bistro', engine_type: 'instant_transaction', tenant_id: 'tenant-1' },
  { id: 'mod-2', slug: 'pool', name: 'Pool', engine_type: 'shared_capacity_access', tenant_id: 'tenant-1' },
];

const QUEUE_ROWS = [
  {
    id: 'fm-1',
    transaction_id: 'tx-1',
    engine_type: 'instant_transaction',
    status: 'in_progress',
    mode: 'on_premise',
    destination_type: 'on_premise_location',
    destination_ref: 'Table 4',
    tracking_ref: null,
    queued_at: '2026-09-16T09:00:00Z',
    in_progress_at: '2026-09-16T09:05:00Z',
    ready_at: null,
    handed_off_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: '2026-09-16T09:00:00Z',
    updated_at: '2026-09-16T09:05:00Z',
    transactions: {
      id: 'tx-1',
      module_id: 'mod-1',
      status: 'confirmed',
      amount: 24.5,
      currency: 'USD',
      customer_id: 'u-1',
      metadata: { order_number: 'ORD-1001', customer_name: 'Amelia Stone' },
      created_at: '2026-09-16T09:00:00Z',
    },
  },
  {
    id: 'fm-2',
    transaction_id: 'tx-2',
    engine_type: 'shared_capacity_access',
    status: 'queued',
    mode: 'digital_delivery',
    destination_type: 'digital_account',
    destination_ref: null,
    tracking_ref: null,
    queued_at: '2026-09-16T09:10:00Z',
    in_progress_at: null,
    ready_at: null,
    handed_off_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: '2026-09-16T09:10:00Z',
    updated_at: '2026-09-16T09:10:00Z',
    transactions: {
      id: 'tx-2',
      module_id: 'mod-2',
      status: 'confirmed',
      amount: 60,
      currency: 'USD',
      customer_id: null,
      metadata: { ticket_number: 'TCK-7' },
      created_at: '2026-09-16T09:10:00Z',
    },
  },
];

function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in', 'neq', 'order', 'range', 'limit', 'maybeSingle'];
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

function setupDb(opts: { modules?: unknown; rows?: unknown; users?: unknown } = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'modules') return chainable(opts.modules ?? MODULES);
    if (table === 'fulfillments') return chainable(opts.rows ?? QUEUE_ROWS);
    if (table === 'users') return chainable(opts.users ?? [{ id: 'u-1', full_name: 'Amelia S.' }]);
    return chainable([]);
  });
}

describe('getFulfillmentQueue (F11 Fulfillment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
    mockGetAvailableActions.mockReturnValue([{ action: 'mark_ready', targetState: 'ready' }]);
  });

  it('fails closed with 400 when property context is missing', async () => {
    const req = {
      query: {},
      headers: {},
      user: { userId: 'admin-1', roles: ['manager'], tenantId: 'tenant-1' },
    } as unknown as Request;
    const res = mockRes();
    await getFulfillmentQueue(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('scopes modules to property AND caller tenant', async () => {
    setupDb();
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'fulfillments') return chainable(QUEUE_ROWS);
      if (table === 'users') return chainable([]);
      return chainable([]);
    });

    await getFulfillmentQueue(mockReq(), mockRes());

    expect(modulesQuery.eq).toHaveBeenCalledWith('property_id', 'prop-1');
    expect(modulesQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('projects two-layer states with engine-computed actions', async () => {
    setupDb();

    const res = mockRes();
    await getFulfillmentQueue(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);

    const [bistro, pool] = body.data.items;
    // Two-layer rule: fulfillment state and transaction state both exposed.
    expect(bistro.fulfillmentStatus).toBe('in_progress');
    expect(bistro.transactionStatus).toBe('confirmed');
    expect(bistro.fulfillmentMode).toBe('on_premise');
    // Actions come from the engine, bound to the row's mode.
    expect(mockGetAvailableActions).toHaveBeenCalledWith(
      'instant_transaction', 'in_progress', 'staff', 'on_premise',
    );
    expect(bistro.availableActions).toEqual([{ action: 'mark_ready', targetState: 'ready' }]);

    // Cross-engine: pool row carries its own engine type and metadata ref.
    expect(pool.engineType).toBe('shared_capacity_access');
    expect(pool.reference).toBe('TCK-7');
    // Guest fallback for missing customer.
    expect(pool.customerName).toBe('Guest');
  });

  it('prefers the metadata snapshot for customer names (historical immutability)', async () => {
    setupDb();

    const res = mockRes();
    await getFulfillmentQueue(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data.items[0].customerName).toBe('Amelia Stone');
  });

  it('survives an engine action computation failure (fail-soft per row)', async () => {
    setupDb();
    mockGetAvailableActions.mockImplementation(() => {
      throw new Error('unknown state');
    });

    const res = mockRes();
    await getFulfillmentQueue(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.items[0].availableActions).toEqual([]);
  });

  it('returns empty payload when property has no modules', async () => {
    setupDb({ modules: [] });

    const res = mockRes();
    await getFulfillmentQueue(mockReq(), res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.modules).toEqual([]);
  });
});
