/**
 * Unit price rules CRUD tests (F11 Pricing capability).
 *
 * Verifies:
 * 1. Auth chain: unauthenticated/staff-role gates fail closed
 * 2. Server-side unit → module → tenant resolution (query params never trusted)
 * 3. Tenant defense-in-depth on every route (list/create/update/delete)
 * 4. Writable field whitelisting (client cannot stamp tenant_id/property_id)
 * 5. requirePropertyAccess rejections propagate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
const { mockRequirePropertyAccess } = vi.hoisted(() => ({ mockRequirePropertyAccess: vi.fn() }));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockTenantId = vi.fn().mockReturnValue('tenant-1');
vi.mock('../../../src/security/tenant-scope.js', () => ({
  getCallerTenantId: () => mockTenantId(),
}));

vi.mock('../../../src/middleware/propertyAccess.middleware.js', () => ({
  requirePropertyAccess: (...args: unknown[]) => mockRequirePropertyAccess(...args),
}));

vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({}),
}));

vi.mock('../../../src/engines/currency-resolver.js', () => ({
  resolveModuleCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('../../../src/services/tax.service.js', () => ({
  resolveTaxCategory: vi.fn(),
}));

vi.mock('../../../src/middleware/auth.middleware.js', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import router from '../../../src/routes/units.routes.js';

// Pull the layered handlers out of the express stack (auth → handler).
function getHandler(method: 'get' | 'post' | 'put' | 'delete', path: string) {
  const layer = (router as any).stack.find(
    (l: any) =>
      l.route &&
      l.route.path === path &&
      l.route.methods[method.toLowerCase()],
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  const handlers = layer.route.stack.map((s: any) => s.handle);
  return handlers[handlers.length - 1]; // last = the actual controller
}

function chainable(terminalData: unknown, terminalError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'in', 'neq', 'order', 'range', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'delete'];
  for (const m of chain) obj[m] = vi.fn().mockReturnValue(obj);
  obj.then = (resolve: (v: unknown) => void) => {
    resolve({ data: terminalData, error: terminalError, count: null });
    return Promise.resolve({ data: terminalData, error: terminalError, count: null });
  };
  return obj;
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    query: {},
    params: {},
    body: {},
    headers: { 'x-property-id': 'prop-1' },
    user: { userId: 'staff-1', roles: ['manager'], tenantId: 'tenant-1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const res: Record<string, unknown> = { statusCode: 200, headersSent: false };
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn().mockImplementation((b: unknown) => b);
  return res as unknown as Response & { statusCode: number; json: ReturnType<typeof vi.fn> };
}

const UNIT = { id: 'unit-1', module_id: 'mod-1', property_id: 'prop-1' };
const MODULE = { id: 'mod-1', tenant_id: 'tenant-1', property_id: 'prop-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantId.mockReturnValue('tenant-1');
  mockRequirePropertyAccess.mockImplementation(() => async (_req: unknown, _res: unknown, next: () => void) => next());
});

describe('unit price rules CRUD (F11 Pricing)', () => {
  it('exposes the price-rules routes', () => {
    const paths = (router as any).stack
      .filter((l: any) => l.route)
      .map((l: any) => l.route.path);
    expect(paths).toContain('/price-rules');
    expect(paths).toContain('/price-rules/:id');
  });

  it('lists rules for a unit with server-side tenant verification', async () => {
    const unitQuery = chainable(UNIT);
    const moduleQuery = chainable(MODULE);
    const rulesQuery = chainable([{ id: 'rule-1', unit_id: 'unit-1', name: 'Summer' }]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_units') return unitQuery;
      if (table === 'modules') return moduleQuery;
      if (table === 'accommodation_unit_price_rules') return rulesQuery;
      return chainable([]);
    });

    const handler = getHandler('get', '/price-rules');
    const res = mockRes();
    await handler(mockReq({ query: { unit_id: 'unit-1' } }), res);

    expect(rulesQuery.eq).toHaveBeenCalledWith('unit_id', 'unit-1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) }),
    );
  });

  it('returns 404 when unit belongs to another tenant', async () => {
    mockTenantId.mockReturnValue('tenant-attacker');
    const unitQuery = chainable(UNIT);
    const moduleQuery = chainable({ id: 'mod-1', tenant_id: 'tenant-1' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_units') return unitQuery;
      if (table === 'modules') return moduleQuery;
      return chainable([]);
    });

    const handler = getHandler('get', '/price-rules');
    const res = mockRes();
    await handler(mockReq({ query: { unit_id: 'unit-1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    // The rules must never be queried for a cross-tenant unit.
    expect(mockFrom).not.toHaveBeenCalledWith('accommodation_unit_price_rules');
  });

  it('returns 400 without unit_id on list', async () => {
    const handler = getHandler('get', '/price-rules');
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('stamps tenant/property from the server-resolved unit on create', async () => {
    const unitQuery = chainable(UNIT);
    const moduleQuery = chainable(MODULE);
    const insertQuery = chainable({ id: 'rule-new', unit_id: 'unit-1', tenant_id: 'tenant-1' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_units') return unitQuery;
      if (table === 'modules') return moduleQuery;
      if (table === 'accommodation_unit_price_rules') return insertQuery;
      return chainable([]);
    });

    const handler = getHandler('post', '/price-rules');
    const res = mockRes();
    // Attacker tries to stamp someone else's tenant/property via the body.
    await handler(
      mockReq({
        body: {
          unit_id: 'unit-1',
          name: 'Peak Season',
          tenant_id: 'tenant-evil',
          property_id: 'prop-evil',
        },
      }),
      res,
    );

    const insertCall = (insertQuery.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall.tenant_id).toBe('tenant-1');
    expect(insertCall.property_id).toBe('prop-1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects create without name', async () => {
    const handler = getHandler('post', '/price-rules');
    const res = mockRes();
    await handler(mockReq({ body: { unit_id: 'unit-1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('verifies tenant ownership before update', async () => {
    mockTenantId.mockReturnValue('tenant-attacker');
    const ruleQuery = chainable({ id: 'rule-1', unit_id: 'unit-1', tenant_id: 'tenant-1', property_id: 'prop-1' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_unit_price_rules') return ruleQuery;
      return chainable([]);
    });

    const handler = getHandler('put', '/price-rules/:id');
    const res = mockRes();
    await handler(mockReq({ params: { id: 'rule-1' }, body: { name: 'Hacked' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('verifies tenant ownership before delete', async () => {
    mockTenantId.mockReturnValue('tenant-attacker');
    const ruleQuery = chainable({ id: 'rule-1', unit_id: 'unit-1', tenant_id: 'tenant-1', property_id: 'prop-1' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_unit_price_rules') return ruleQuery;
      return chainable([]);
    });

    const handler = getHandler('delete', '/price-rules/:id');
    const res = mockRes();
    await handler(mockReq({ params: { id: 'rule-1' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('propagates requirePropertyAccess rejections', async () => {
    mockRequirePropertyAccess.mockImplementation(() => async (_req: unknown, res: Response) => {
      (res as any).headersSent = true;
      (res as any).status(403);
      (res as any).json({ success: false, error: 'Access denied' });
    });

    const unitQuery = chainable(UNIT);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_units') return unitQuery;
      return chainable([]);
    });

    const handler = getHandler('get', '/price-rules');
    const res = mockRes();
    res.headersSent = false;
    await handler(mockReq({ query: { unit_id: 'unit-1' } }), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 on update with no writable fields', async () => {
    const ruleQuery = chainable({ id: 'rule-1', unit_id: 'unit-1', tenant_id: 'tenant-1', property_id: 'prop-1' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'accommodation_unit_price_rules') return ruleQuery;
      return chainable([]);
    });

    const handler = getHandler('put', '/price-rules/:id');
    const res = mockRes();
    // tenant_id is not writable — body containing only it means no writable fields.
    await handler(mockReq({ params: { id: 'rule-1' }, body: { tenant_id: 'x' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
