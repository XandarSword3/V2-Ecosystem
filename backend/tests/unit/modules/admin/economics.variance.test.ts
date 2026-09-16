/**
 * Ingredient variance controller tests (F13 actual vs theoretical).
 *
 * Verifies:
 * 1. RPC invoked with property scope + JWT tenant (never headers), window
 *    derived from clamped days
 * 2. Variance-cost ranking: rows sorted by |variance × cost_per_unit| desc
 * 3. Flagging: |variancePct| >= 10% flagged, null variancePct (zero theory)
 *    never flagged
 * 4. Shrinkage total sums only positive variance costs; totals + windowDays
 * 5. Fail-closed 400 without property context; 500 mapped on RPC error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockFrom, mockRpc } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockRpc: vi.fn() }));

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => ({ from: mockFrom, rpc: mockRpc }),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockTenantId = vi.fn().mockReturnValue('tenant-1');
vi.mock('../../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: (...args: unknown[]) => mockTenantId(...args),
}));

import { getIngredientVariance } from '../../../../src/modules/admin/controllers/economics.controller.js';

const ITEM_A = 'inv-aaaa';
const ITEM_B = 'inv-bbbb';

/** RPC rows: A over-consumed 12.5%, B no theory (null pct), C under 5%. */
const RPC_ROWS = [
  {
    inventory_item_id: ITEM_A,
    item_name: 'Patties',
    unit: 'kg',
    units_sold: 40,
    theoretical_consumption: 8,
    actual_consumption: 9,
    variance: 1,
    variance_pct: 12.5,
  },
  {
    inventory_item_id: ITEM_B,
    item_name: 'Truffle Oil',
    unit: 'ml',
    units_sold: 0,
    theoretical_consumption: 0,
    actual_consumption: 250,
    variance: 250,
    variance_pct: null,
  },
  {
    inventory_item_id: 'inv-cccc',
    item_name: 'Greens',
    unit: 'kg',
    units_sold: 10,
    theoretical_consumption: 4,
    actual_consumption: 3.8,
    variance: -0.2,
    variance_pct: -5,
  },
];

const COSTS = [
  { id: ITEM_A, cost_per_unit: 20 },
  { id: ITEM_B, cost_per_unit: 0.5 },
  { id: 'inv-cccc', cost_per_unit: 3 },
];

function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'in', 'neq', 'gte', 'order', 'range', 'limit']) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
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

describe('getIngredientVariance (F13 variance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
  });

  it('fails closed with 400 when property context is missing', async () => {
    const req = mockReq({ propertyId: undefined, headers: {} });
    const res = mockRes();

    await getIngredientVariance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls the RPC with property + JWT tenant scope and clamped window', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chainable([]));

    const req = mockReq({ propertyId: 'prop-1', query: { days: '99999' }, headers: { 'x-tenant-id': 'evil' } });
    const res = mockRes();
    await getIngredientVariance(req, res);

    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(mockRpc.mock.calls[0][0]).toBe('get_ingredient_variance');
    expect(params.p_property_id).toBe('prop-1');
    expect(params.p_tenant_id).toBe('tenant-1'); // from JWT, not the header
    const since = new Date(params.p_since as string).getTime();
    expect(new Date(params.p_until as string).getTime()).toBeLessThanOrEqual(Date.now());
    // 365-day clamp: since ≈ now − 365d
    expect(Date.now() - since).toBeGreaterThanOrEqual(364.9 * 24 * 3600 * 1000);
    expect(res.statusCode).toBe(200);
  });

  it('ranks by variance cost, flags ≥10% variance, skips null pct', async () => {
    mockRpc.mockResolvedValue({ data: RPC_ROWS, error: null });
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('inventory_items');
      return chainable(COSTS);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getIngredientVariance(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);

    const [first, second, third] = body.data.ingredients;

    // Costs: A = 1 × 20 = 20; B = 250 × 0.5 = 125; C = -0.2 × 3 = -0.6
    // Ranked by |cost| desc → B(125), A(20), C(0.6)
    expect(first.name).toBe('Truffle Oil');
    expect(first.varianceCost).toBe(125);
    expect(first.flagged).toBe(false); // null variancePct never flagged
    expect(second.name).toBe('Patties');
    expect(second.varianceCost).toBe(20);
    expect(second.flagged).toBe(true); // 12.5% ≥ 10%
    expect(third.name).toBe('Greens');
    expect(third.varianceCost).toBe(-0.6);
    expect(third.flagged).toBe(false); // -5% < 10%

    // Shrinkage = only positive variance costs: 125 + 20
    expect(body.data.totals.shrinkageCost).toBe(145);
    expect(body.data.totals.flaggedCount).toBe(1);
    expect(body.data.totals.trackedCount).toBe(3);
    expect(body.data.windowDays).toBe(30);
  });

  it('maps an RPC error to a 500 without leaking details', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getIngredientVariance(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Failed to compute ingredient variance' });
  });

  it('returns an empty payload when nothing was sold or consumed', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getIngredientVariance(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.ingredients).toEqual([]);
    expect(body.data.totals).toEqual({ shrinkageCost: 0, flaggedCount: 0, trackedCount: 0 });
  });
});
