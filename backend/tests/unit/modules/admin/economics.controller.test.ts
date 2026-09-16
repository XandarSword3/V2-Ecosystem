/**
 * Product economics controller tests (F13 business economics).
 *
 * Verifies:
 * 1. Property-scoped queries with tenant defense-in-depth
 * 2. Revenue gating: order_items on cancelled/void/refunded transactions
 *    contribute no revenue
 * 3. COGS = BOM quantity_required × inventory cost_per_unit × units sold
 * 4. Margin + margin percentage projection; hasBom=false products carry
 *    null COGS/margin (no fake numbers)
 * 5. Waste aggregation from inventory_transactions (total_cost fallback
 *    quantity × unit_cost), sorted by cost desc
 * 6. Fail-closed when property context is missing
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

import { getProductEconomics } from '../../../../src/modules/admin/controllers/economics.controller.js';

const MODULE_ID = 'mod-1';
const ITEM_A = 'cat-aaaa';
const ITEM_B = 'cat-bbbb';
const ING_X = 'inv-xxxx';
const ING_Y = 'inv-yyyy';

const MODULES = [{ id: MODULE_ID, name: 'Bistro' }];
const CATALOG = [
  { id: ITEM_A, module_id: MODULE_ID, name: 'Burger', price: 10 },
  { id: ITEM_B, module_id: MODULE_ID, name: 'Salad', price: 8 },
];
const BOM = [
  { catalog_item_id: ITEM_A, inventory_item_id: ING_X, quantity_required: 0.2 },
  { catalog_item_id: ITEM_A, inventory_item_id: ING_Y, quantity_required: 1 },
];
const INVENTORY = [
  { id: ING_X, cost_per_unit: 10 },
  { id: ING_Y, cost_per_unit: 0.5 },
];
// Burger: 2 sold (tx-1 revenue-eligible) + 1 sold (tx-2 cancelled → excluded)
const SALES = [
  { transaction_id: 'tx-1', catalog_item_id: ITEM_A, quantity: 2, subtotal: 20 },
  { transaction_id: 'tx-2', catalog_item_id: ITEM_A, quantity: 1, subtotal: 10 },
  { transaction_id: 'tx-3', catalog_item_id: ITEM_B, quantity: 1, subtotal: 8 },
];
const TXS = [
  { id: 'tx-1', status: 'completed' },
  { id: 'tx-2', status: 'cancelled' },
  { id: 'tx-3', status: 'confirmed' },
];
const WASTE = [
  { item_id: ING_X, quantity: 2, unit_cost: 10, total_cost: 20 },
  { item_id: ING_Y, quantity: 4, unit_cost: 0.5, total_cost: null },
];

/** Chainable query builder whose terminal result is configurable. */
function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'is', 'in', 'neq', 'or', 'gte', 'order', 'range', 'limit'];
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

describe('getProductEconomics (F13 product economics)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId.mockReturnValue('tenant-1');
  });

  it('fails closed with 400 when property context is missing', async () => {
    const req = mockReq({ propertyId: undefined, headers: {} });
    const res = mockRes();

    await getProductEconomics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('scopes every query to the property and caller tenant', async () => {
    const queries: Record<string, ReturnType<typeof chainable>> = {
      modules: chainable(MODULES),
      catalog_items: chainable(CATALOG),
      order_items: chainable(SALES),
      transactions: chainable(TXS),
      menu_item_ingredients: chainable(BOM),
      inventory_items: chainable(INVENTORY),
      inventory_transactions: chainable(WASTE),
    };
    mockFrom.mockImplementation((table: string) => {
      if (!queries[table]) throw new Error(`unexpected table: ${table}`);
      return queries[table];
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getProductEconomics(req, res);

    for (const [table, q] of Object.entries(queries)) {
      // By-id lookups (transactions status gate, inventory cost/name
      // resolution) inherit their scope from the property- and tenant-scoped
      // rows that produced the id lists.
      if (table === 'transactions' || table === 'inventory_items') continue;
      expect(q.eq, table).toHaveBeenCalledWith('property_id', 'prop-1');
      const tenantCalls = (q.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) => c[0] === 'tenant_id',
      );
      expect(tenantCalls, table).toHaveLength(1);
    }
    // By-id lookups get their id filters
    expect(queries.transactions.in).toHaveBeenCalledWith('id', expect.any(Array));
    expect(queries.inventory_items.in).toHaveBeenCalledWith('id', expect.any(Array));
    expect(res.statusCode).toBe(200);
  });

  it('computes revenue, COGS, and margin with revenue gating', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return chainable(CATALOG);
      if (table === 'order_items') return chainable(SALES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable(INVENTORY);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getProductEconomics(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);

    const burger = body.data.products.find((p: { catalogItemId: string }) => p.catalogItemId === ITEM_A);
    const salad = body.data.products.find((p: { catalogItemId: string }) => p.catalogItemId === ITEM_B);

    // Burger: 2 units × $10 = $20 revenue (cancelled tx excluded)
    expect(burger.unitsSold).toBe(2);
    expect(burger.revenue).toBe(20);
    // BOM: 0.2 × $10 + 1 × $0.5 = $2.50/unit → $5 COGS for 2 units
    expect(burger.cogsPerUnit).toBe(2.5);
    expect(burger.cogs).toBe(5);
    expect(burger.margin).toBe(15);
    expect(burger.marginPct).toBe(75);

    // Salad: sold but no BOM → COGS/margin null, hasBom false
    expect(salad.unitsSold).toBe(1);
    expect(salad.revenue).toBe(8);
    expect(salad.hasBom).toBe(false);
    expect(salad.cogs).toBeNull();
    expect(salad.margin).toBeNull();

    // Totals: revenue $28, COGS $5 (salad contributes no COGS), waste $22
    expect(body.data.totals.revenue).toBe(28);
    expect(body.data.totals.cogs).toBe(5);
    expect(body.data.totals.margin).toBe(23);
    expect(body.data.totals.wasteCost).toBe(22);
  });

  it('ignores a client-supplied tenant_id header (JWT only)', async () => {
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'catalog_items') return chainable(CATALOG);
      if (table === 'order_items') return chainable(SALES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable(INVENTORY);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1', headers: { 'x-tenant-id': 'evil-tenant' } });
    const res = mockRes();
    await getProductEconomics(req, res);

    const tenantCalls = (modulesQuery.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'tenant_id',
    );
    expect(tenantCalls).toHaveLength(1);
    expect(tenantCalls[0][1]).toBe('tenant-1');
  });

  it('applies tenant defense-in-depth from the JWT', async () => {
    const catalogQuery = chainable(CATALOG);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return catalogQuery;
      if (table === 'order_items') return chainable(SALES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable(INVENTORY);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getProductEconomics(req, res);

    expect(catalogQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('unscoped platform operator (null tenant) skips tenant filters', async () => {
    mockTenantId.mockReturnValue(null);
    const modulesQuery = chainable(MODULES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return modulesQuery;
      if (table === 'catalog_items') return chainable(CATALOG);
      if (table === 'order_items') return chainable(SALES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable(INVENTORY);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getProductEconomics(req, res);

    const tenantCalls = (modulesQuery.eq as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'tenant_id',
    );
    expect(tenantCalls).toHaveLength(0);
  });

  it('clamps the days window to sane bounds', async () => {
    const salesQuery = chainable(SALES);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return chainable(CATALOG);
      if (table === 'order_items') return salesQuery;
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable(INVENTORY);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1', query: { days: '99999' } });
    const res = mockRes();
    await getProductEconomics(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data.windowDays).toBe(365);
    const gteCall = (salesQuery.gte as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(gteCall[0]).toBe('created_at');
    expect(new Date(gteCall[1] as string).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('returns an empty payload when the property has no modules', async () => {
    mockFrom.mockImplementation(() => chainable([]));

    const req = mockReq({ propertyId: 'prop-empty' });
    const res = mockRes();
    await getProductEconomics(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.products).toEqual([]);
    expect(body.data.totals.revenue).toBe(0);
    expect(body.data.totals.marginPct).toBeNull();
  });

  it('sorts waste by cost descending with name resolution', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'modules') return chainable(MODULES);
      if (table === 'catalog_items') return chainable(CATALOG);
      if (table === 'order_items') return chainable(SALES);
      if (table === 'transactions') return chainable(TXS);
      if (table === 'menu_item_ingredients') return chainable(BOM);
      if (table === 'inventory_items') return chainable([
        { id: ING_X, cost_per_unit: 10, name: 'Patties' },
        { id: ING_Y, cost_per_unit: 0.5, name: 'Greens' },
      ]);
      if (table === 'inventory_transactions') return chainable(WASTE);
      throw new Error(`unexpected table: ${table}`);
    });

    const req = mockReq({ propertyId: 'prop-1' });
    const res = mockRes();
    await getProductEconomics(req, res);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const waste = body.data.waste as Array<{ itemId: string; cost: number; name: string }>;
    expect(waste[0].cost).toBeGreaterThanOrEqual(waste[1].cost);
    expect(waste.map((w) => w.name)).toEqual(['Patties', 'Greens']);
    // total_cost null fallback: quantity × unit_cost = 4 × 0.5 = 2
    expect(waste[1].cost).toBe(2);
  });
});
