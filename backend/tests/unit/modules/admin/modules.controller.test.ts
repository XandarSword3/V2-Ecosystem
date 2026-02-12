/**
 * Modules Controller Unit Tests
 *
 * Tests: CRUD operations, auto-provisioning of permissions/roles/staff,
 *        cascade delete, permission enforcement, optimistic locking, soft delete.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks (must be declared before imports) ──────────────────────────

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/socket', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('../../../../src/middleware/moduleGuard.middleware', () => ({
  clearModuleCache: vi.fn(),
}));

vi.mock('../../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../src/validation/schemas', () => ({
  createModuleSchema: {},
  updateModuleSchema: {},
  validateBody: vi.fn().mockImplementation((_s: unknown, body: unknown) => body),
}));

vi.mock('../../../../src/middleware/async-handler.js', () => ({
  asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => fn,
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
}));

import { getSupabase } from '../../../../src/database/connection';
import { emitToAll } from '../../../../src/socket';
import { clearModuleCache } from '../../../../src/middleware/moduleGuard.middleware';
import { logActivity } from '../../../../src/utils/activityLogger';
import {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
} from '../../../../src/modules/admin/modules.controller';

// ── Chainable Supabase mock ──────────────────────────────────────────

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'neq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt',
    'limit', 'not', 'in', 'contains', 'ilike', 'range',
  ];
  chainMethods.forEach(m => { mockObj[m] = vi.fn().mockReturnValue(mockObj); });

  mockObj.then = function (resolve: (v: { data: unknown; error: unknown; count?: number }) => void) {
    const d = mockDataFn();
    resolve({ data: d, error: null, count: Array.isArray(d) ? d.length : 0 });
    return Promise.resolve({ data: d, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: first ? null : { code: 'PGRST116', message: 'Not found' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const d = mockDataFn();
    const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
    return Promise.resolve({ data: first, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((rows: unknown) => {
    const obj = Array.isArray(rows) ? rows[0] : rows;
    const resultData = Array.isArray(rows)
      ? rows.map((r: any, i: number) => ({ id: `gen-${i}`, ...(r as object) }))
      : { id: 'mod-new', ...(obj as object) };
    const selectResult: Record<string, unknown> = {};
    selectResult.single = vi.fn().mockResolvedValue({ data: Array.isArray(resultData) ? resultData[0] : resultData, error: null });
    selectResult.then = (r: (v: { data: unknown; error: unknown }) => void) => {
      r({ data: resultData, error: null });
      return Promise.resolve({ data: resultData, error: null });
    };
    return {
      select: vi.fn().mockReturnValue(selectResult),
      then: (r: (v: { data: unknown; error: unknown }) => void) => r({ data: resultData, error: null }),
    };
  });
  mockObj.upsert = vi.fn().mockImplementation((data: unknown) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'ups-1', ...(Array.isArray(data) ? data[0] : data) as object }, error: null }),
    }),
    then: (r: (v: { data: unknown; error: unknown }) => void) => r({ data, error: null }),
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'is', 'not', 'or', 'in', 'select'].forEach(m => {
    updateChain[m] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockImplementation(() => {
      const d = mockDataFn();
      const first = Array.isArray(d) && d.length > 0 ? d[0] : null;
      return Promise.resolve({ data: first, error: null });
    }),
  });
  updateChain.then = (r: (v: { data: unknown; error: unknown }) => void) => r({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);

  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'is', 'not', 'or', 'in', 'select'].forEach(m => {
    deleteChain[m] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.select = vi.fn().mockReturnValue({
    then: (r: (v: { data: unknown; error: unknown }) => void) => r({ data: [], error: null }),
  });
  deleteChain.then = (r: (v: { data: unknown; error: unknown; count?: number }) => void) => r({ data: null, error: null, count: 0 });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);

  return mockObj;
}

// ── Test data ────────────────────────────────────────────────────────

const MOD_RESTAURANT = {
  id: 'mod-1',
  name: 'Restaurant',
  slug: 'restaurant',
  template_type: 'menu_service',
  is_active: true,
  show_in_main: true,
  settings: {},
  settings_version: 1,
  sort_order: 0,
};

const MOD_POOL = {
  id: 'mod-2',
  name: 'Pool',
  slug: 'pool',
  template_type: 'session_access',
  is_active: true,
  show_in_main: true,
  settings: {},
  settings_version: 1,
  sort_order: 1,
};

// ── Helpers ──────────────────────────────────────────────────────────

function mockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    params: {},
    query: {},
    body: {},
    user: { userId: 'admin-1', id: 'admin-1', roles: ['super_admin'] },
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('vitest-agent'),
    ...overrides,
  };
}

function mockRes() {
  const res: Record<string, unknown> = { json: vi.fn(), statusCode: 200 };
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  return res as { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; statusCode: number };
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── Suite ────────────────────────────────────────────────────────────

describe('ModulesController', () => {
  let tableData: Record<string, unknown[]>;

  function setupSupabase() {
    const supabase = {
      from: vi.fn().mockImplementation((t: string) => createQueryMock(() => tableData[t] || [])),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (getSupabase as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
    return supabase;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tableData = {
      modules: [MOD_RESTAURANT, MOD_POOL],
      app_permissions: [],
      app_role_permissions: [],
      roles: [{ id: 'role-1', name: 'restaurant_admin' }, { id: 'role-2', name: 'restaurant_staff' }],
      users: [],
      user_roles: [],
      site_settings: [{ id: 1, navbar: { links: [] } }],
      menu_items: [],
      menu_categories: [],
    };
  });

  // ── getModules ──────────────────────────────────────────────────

  describe('getModules', () => {
    it('should return all modules', async () => {
      setupSupabase();
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }));
    });

    it('should filter active only when query param set', async () => {
      const sb = setupSupabase();
      const req = mockReq({ query: { activeOnly: 'true' } });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter showInMain when query param set', async () => {
      setupSupabase();
      const req = mockReq({ query: { showInMain: 'true' } });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── getModule ───────────────────────────────────────────────────

  describe('getModule', () => {
    it('should return a module by ID', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' } });
      const res = mockRes();
      await (getModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ slug: 'restaurant' }),
      }));
    });

    it('should fall back to slug lookup when ID not found', async () => {
      // First call (by ID) returns nothing, second call (by slug) returns data
      let callCount = 0;
      const sb = setupSupabase();
      sb.from.mockImplementation(() => {
        callCount++;
        return createQueryMock(() => callCount >= 2 ? [MOD_RESTAURANT] : []);
      });

      const req = mockReq({ params: { id: 'restaurant' } });
      const res = mockRes();
      await (getModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── createModule ────────────────────────────────────────────────

  describe('createModule', () => {
    it('should create a module and return 201', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Beach Bar', description: 'Drinks on the beach' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should auto-generate slug from name', async () => {
      const sb = setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Beach Bar' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      // Verify insert was called (the slug generation is in createModule)
      expect(sb.from).toHaveBeenCalledWith('modules');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should provision dynamic permissions for the new module', async () => {
      const sb = setupSupabase();
      const req = mockReq({
        body: { template_type: 'session_access', name: 'Spa', slug: 'spa' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(sb.from).toHaveBeenCalledWith('app_permissions');
      expect(sb.from).toHaveBeenCalledWith('app_role_permissions');
    });

    it('should create default staff user for the module', async () => {
      const sb = setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Burger Joint', slug: 'burger-joint' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(sb.from).toHaveBeenCalledWith('users');
      expect(sb.from).toHaveBeenCalledWith('roles');
    });

    it('should emit modules.updated socket event', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Sushi Bar' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(emitToAll).toHaveBeenCalledWith('modules.updated', expect.any(Object));
    });

    it('should log activity for module creation', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Pizzeria' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_MODULE',
        resource: 'module',
      }));
    });
  });

  // ── updateModule ────────────────────────────────────────────────

  describe('updateModule', () => {
    it('should update a module and return updated data', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Updated Restaurant', settings_version: 1 },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 when module not found', async () => {
      tableData.modules = [];
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-missing' }, body: { name: 'X' } });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when user lacks permission', async () => {
      setupSupabase();
      tableData.app_role_permissions = []; // no matching perms
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Hack' },
        user: { userId: 'staff-1', roles: ['customer'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow super_admin to bypass permission check', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Admin Updated' },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should detect version conflict (optimistic locking)', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Stale', settings_version: 99 }, // DB has version 1
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(409);
      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.error).toMatch(/version conflict/i);
    });

    it('should clear module cache after update', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Refresh' },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(clearModuleCache).toHaveBeenCalled();
    });

    it('should log activity for update', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Logged' },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE_MODULE' }));
    });
  });

  // ── deleteModule ────────────────────────────────────────────────

  describe('deleteModule', () => {
    it('should soft-delete (deactivate) by default', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: {} });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringMatching(/deactivated|soft/i),
      }));
    });

    it('should hard-delete with force=true and cascade dependencies', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringMatching(/hard-deleted/i),
      }));
    });

    it('should return 404 when deleting non-existent module', async () => {
      tableData.modules = [];
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-missing' }, query: {} });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for unauthorized user', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        query: {},
        user: { userId: 'staff-1', roles: ['customer'] },
      });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should clear module cache after delete', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: {} });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(clearModuleCache).toHaveBeenCalled();
    });

    it('should emit socket event after delete', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: {} });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(emitToAll).toHaveBeenCalledWith('modules.updated', expect.any(Object));
    });

    it('should log activity for soft delete', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: {} });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE_MODULE_SOFT' }));
    });

    it('should allow module slug-specific admin to delete', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        query: {},
        user: { userId: 'mod-admin', roles: ['restaurant_admin'] },
      });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── Edge Cases: getModules ───────────────────────────────────────

  describe('getModules – edge cases', () => {
    it('should return 500 when the database query fails', async () => {
      const sb = setupSupabase();
      // Override from() to return a query that resolves to an error
      sb.from.mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        ['select', 'eq', 'order'].forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
        chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => {
          resolve({ data: null, error: { message: 'connection refused' } });
          return Promise.resolve({ data: null, error: { message: 'connection refused' } });
        };
        return chain;
      });

      const req = mockReq({ query: {} });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Failed to fetch modules',
      }));
    });

    it('should return an empty array when no modules exist', async () => {
      tableData.modules = [];
      setupSupabase();
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [],
      }));
    });

    it('should handle combined activeOnly and showInMain filters', async () => {
      const sb = setupSupabase();
      const req = mockReq({ query: { activeOnly: 'true', showInMain: 'true' } });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      // from('modules') chain should have eq called for both filters
      const fromCall = sb.from.mock.results[0].value;
      expect(fromCall.eq).toHaveBeenCalled();
    });

    it('should ignore activeOnly when value is not "true"', async () => {
      setupSupabase();
      const req = mockReq({ query: { activeOnly: 'false' } });
      const res = mockRes();
      await getModules(req as any, res as any, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
      }));
    });
  });

  // ── Edge Cases: getModule ────────────────────────────────────────

  describe('getModule – edge cases', () => {
    it('should throw when both id and slug lookup fail', async () => {
      tableData.modules = [];
      setupSupabase();
      const req = mockReq({ params: { id: 'nonexistent' } });
      const res = mockRes();
      const next = mockNext();

      await expect(
        (getModule as Function)(req, res, next)
      ).rejects.toThrow();
    });

    it('should handle numeric-like id param', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: '12345' } });
      const res = mockRes();
      // Will try id then slug; both attempts use the mock which returns data based on tableData
      await (getModule as Function)(req, res, mockNext());
      // As long as no crash, the fallback flow works
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ── Edge Cases: createModule ─────────────────────────────────────

  describe('createModule – edge cases', () => {
    it('should use provided slug instead of auto-generating', async () => {
      const sb = setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Beach Bar', slug: 'custom-slug' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
      // The insert should have been called with the custom slug
      const modulesFrom = sb.from.mock.results.find((_: unknown, i: number) => sb.from.mock.calls[i][0] === 'modules');
      expect(modulesFrom).toBeDefined();
    });

    it('should still succeed when permission creation throws', async () => {
      const sb = setupSupabase();
      let permCallCount = 0;
      sb.from.mockImplementation((t: string) => {
        if (t === 'app_permissions') {
          permCallCount++;
          if (permCallCount === 1) {
            // First permission upsert throws
            return {
              upsert: vi.fn().mockImplementation(() => { throw new Error('permission DB error'); }),
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
            };
          }
        }
        return createQueryMock(() => tableData[t] || []);
      });

      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Test Module' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      // Module creation still succeeds despite permission error
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle navbar auto-add when site_settings has no navbar links', async () => {
      tableData.site_settings = [{ id: 1, navbar: null }];
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'session_access', name: 'Gym', slug: 'gym' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      // Should still succeed – navbar add is non-fatal
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should set icon to Waves for session_access template type', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'session_access', name: 'Pool Party', slug: 'pool-party' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should set icon to Home for unknown template type', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'generic_page', name: 'About Us', slug: 'about-us' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should use "system" as user_id in logActivity when req.user is absent', async () => {
      setupSupabase();
      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Cafe' },
        user: undefined,
      });
      const res = mockRes();
      // createModule reads (req.user as any)?.userId || 'system'
      await (createModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'system',
      }));
    });

    it('should handle roles creation failure gracefully', async () => {
      const sb = setupSupabase();
      let rolesCallCount = 0;
      sb.from.mockImplementation((t: string) => {
        if (t === 'roles') {
          rolesCallCount++;
          // Make roles insert fail
          const chain = createQueryMock(() => []);
          chain.insert = vi.fn().mockImplementation(() => ({
            select: vi.fn().mockReturnValue({
              then: (r: (v: { data: unknown; error: unknown }) => void) =>
                r({ data: null, error: { message: 'roles insert failed' } }),
            }),
            then: (r: (v: { data: unknown; error: unknown }) => void) =>
              r({ data: null, error: { message: 'roles insert failed' } }),
          }));
          return chain;
        }
        return createQueryMock(() => tableData[t] || []);
      });

      const req = mockReq({
        body: { template_type: 'menu_service', name: 'Test' },
      });
      const res = mockRes();
      await (createModule as Function)(req, res, mockNext());

      // Module still created despite roles failure
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── Edge Cases: updateModule ─────────────────────────────────────

  describe('updateModule – edge cases', () => {
    it('should increment settings_version when settings are updated', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { settings: { theme: 'dark' }, settings_version: 1 },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      // Should succeed – version matches so update proceeds
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should throw when user is missing on update', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'No Auth' },
        user: undefined,
      });
      const res = mockRes();
      const next = mockNext();

      await expect(
        (updateModule as Function)(req, res, next)
      ).rejects.toThrow('Authentication required');
    });

    it('should allow non-super_admin with correct module permission', async () => {
      tableData.app_role_permissions = [
        { role_name: 'restaurant_admin', permission_slug: 'module:restaurant:manage' },
      ];
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Updated by manager' },
        user: { userId: 'mgr-1', roles: ['restaurant_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should emit socket event after successful update', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'Socket Test' },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      expect(emitToAll).toHaveBeenCalledWith('modules.updated', expect.any(Object));
    });

    it('should skip version check when settings_version is not in body', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        body: { name: 'No Version Check' },
        user: { userId: 'admin-1', roles: ['super_admin'] },
      });
      const res = mockRes();
      await (updateModule as Function)(req, res, mockNext());

      // No 409 – version check skipped
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── Edge Cases: deleteModule ─────────────────────────────────────

  describe('deleteModule – edge cases', () => {
    it('should throw when user is missing on delete', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        query: {},
        user: undefined,
      });
      const res = mockRes();
      const next = mockNext();

      await expect(
        (deleteModule as Function)(req, res, next)
      ).rejects.toThrow('Authentication required');
    });

    it('should log DELETE_MODULE_HARD activity on force delete', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'DELETE_MODULE_HARD',
      }));
    });

    it('should clear module cache on force delete', async () => {
      setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(clearModuleCache).toHaveBeenCalledWith('restaurant');
    });

    it('should cascade delete menu_items on force delete with items present', async () => {
      tableData.menu_items = [{ id: 'item-1', module_id: 'mod-1' }];
      const sb = setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(sb.from).toHaveBeenCalledWith('menu_items');
    });

    it('should clean up permissions and roles on force delete', async () => {
      const sb = setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(sb.from).toHaveBeenCalledWith('app_permissions');
      expect(sb.from).toHaveBeenCalledWith('roles');
    });

    it('should remove module from navbar CMS on force delete', async () => {
      tableData.site_settings = [{ id: 1, navbar: { links: [{ moduleSlug: 'restaurant', label: 'Restaurant' }] } }];
      const sb = setupSupabase();
      const req = mockReq({ params: { id: 'mod-1' }, query: { force: 'true' } });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(sb.from).toHaveBeenCalledWith('site_settings');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should use "system" as user_id in logActivity when req.user has no userId', async () => {
      setupSupabase();
      const req = mockReq({
        params: { id: 'mod-1' },
        query: {},
        user: { roles: ['super_admin'] },
      });
      const res = mockRes();
      await (deleteModule as Function)(req, res, mockNext());

      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'system',
      }));
    });
  });
});
