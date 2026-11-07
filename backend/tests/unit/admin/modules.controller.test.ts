import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/security/scoped-client.js', () => ({
  getScopedClient: (ctx: any) => harness.client,
  requireTenantScope: (req: any) => req?.user?.tenantId || 'tenant-1',
  tenantContextFor: (req: any) => ({ tenantId: req?.user?.tenantId || 'tenant-1', actorId: req?.user?.userId }),
}));

vi.mock('../../../src/socket', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('../../../src/socket/index', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
}));

vi.mock('../../../src/middleware/moduleGuard.middleware.js', () => ({
  clearModuleCache: vi.fn(),
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/routes/dynamic-modules.loader.js', () => ({
  loadDynamicModules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/feature-limits.service.js', () => ({
  assertModuleLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/security/permission-cache.service.js', () => ({
  permissionCache: {
    refreshCache: vi.fn().mockResolvedValue(undefined),
  },
}));

import * as modulesController from '../../../src/modules/admin/modules.controller.js';

function createMockReqRes(overrides: any = {}) {
  const req: any = {
    params: {},
    query: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    get: vi.fn((h: string) => (h.toLowerCase() === 'user-agent' ? 'test-agent' : undefined)),
    user: {
      id: 'user-1',
      userId: 'user-1',
      role: 'admin',
      roles: ['admin', 'super_admin'],
      scope: 'super_admin',
      tenantId: 'tenant-1',
    },
    property: { id: 'prop-1' },
    ...overrides,
  };
  const res: any = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('ModulesController (Genuine Stateful Database Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.clear();
  });

  describe('getModules', () => {
    it('returns modules scoped to caller tenant and filters activeOnly properly', async () => {
      // Seed stateful table with 3 modules: 1 active in tenant-1, 1 inactive in tenant-1, 1 in tenant-2
      harness.seed('modules', [
        {
          id: 'mod-1',
          name: 'Active Dining',
          slug: 'dining',
          engine_type: 'instant_transaction',
          is_active: true,
          show_in_main: true,
          sort_order: 1,
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
        {
          id: 'mod-2',
          name: 'Draft Spa',
          slug: 'spa',
          engine_type: 'time_exclusive_reservation',
          is_active: false,
          show_in_main: false,
          sort_order: 2,
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
        {
          id: 'mod-3',
          name: 'Other Tenant Store',
          slug: 'store',
          engine_type: 'instant_transaction',
          is_active: true,
          show_in_main: true,
          sort_order: 3,
          tenant_id: 'tenant-2',
          property_id: 'prop-2',
        },
      ]);

      // Call with activeOnly: true
      const { req, res, next } = createMockReqRes({
        query: { activeOnly: 'true' },
      });

      await modulesController.getModules(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0].data;

      // Must contain mod-1 (active, tenant-1)
      expect(responseData.some((m: any) => m.id === 'mod-1')).toBe(true);
      // Must NOT contain mod-2 (inactive)
      expect(responseData.some((m: any) => m.id === 'mod-2')).toBe(false);
      // Must NOT contain mod-3 (tenant-2 isolation)
      expect(responseData.some((m: any) => m.id === 'mod-3')).toBe(false);
    });

    it('handles simulated database failure with 500 error', async () => {
      harness.simulateError('modules', { message: 'Connection pool exhausted' });

      const { req, res, next } = createMockReqRes();
      await modulesController.getModules(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch modules',
      });
    });
  });

  describe('getModule', () => {
    it('returns module by UUID when it belongs to caller tenant', async () => {
      harness.seed('modules', [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Boutique Shop',
          slug: 'boutique',
          engine_type: 'instant_transaction',
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: '11111111-1111-1111-1111-111111111111' },
      });

      await modulesController.getModule(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Boutique Shop',
          slug: 'boutique',
        }),
      });
    });

    it('returns 404 when module does not exist', async () => {
      harness.seed('modules', []);

      const { req, res, next } = createMockReqRes({
        params: { id: 'nonexistent-slug' },
      });

      await modulesController.getModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Module not found',
      });
    });
  });

  describe('createModule', () => {
    it('creates module in stateful database with defaults and permissions', async () => {
      harness.seed('modules', []);
      harness.seed('app_role_permissions', []);
      harness.seed('site_settings', [{ id: 1, navbar: { links: [] } }]);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Beach Club Cabanas',
          engine_type: 'time_exclusive_reservation',
          description: 'Exclusive seaside cabana rentals',
        },
      });

      await modulesController.createModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const created = harness.getTable('modules');
      expect(created.length).toBe(1);
      expect(created[0].name).toBe('Beach Club Cabanas');
      expect(created[0].slug).toBe('beach-club-cabanas');
      expect(created[0].engine_type).toBe('time_exclusive_reservation');
      expect(created[0].is_active).toBe(true);
      expect(created[0].settings_version).toBe(1);
    });

    it('rejects creation when slug is reserved with 422', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Admin Panel',
          slug: 'admin',
          engine_type: 'instant_transaction',
        },
      });

      await modulesController.createModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Reserved slug',
        })
      );
      // Verifies NOTHING was written to database
      expect(harness.getTable('modules').length).toBe(0);
    });

    it('rejects duplicate slug within same tenant with 409 conflict', async () => {
      harness.seed('modules', [
        {
          id: 'mod-existing',
          name: 'Existing Dining',
          slug: 'dining',
          engine_type: 'instant_transaction',
          is_active: true,
          tenant_id: 'tenant-1',
          property_id: 'prop-1',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Second Dining',
          slug: 'dining',
          engine_type: 'instant_transaction',
        },
      });

      await modulesController.createModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Slug conflict',
        })
      );
      expect(harness.getTable('modules').length).toBe(1);
    });
  });

  describe('updateModule', () => {
    it('updates module and increments settings_version when settings change', async () => {
      harness.seed('modules', [
        {
          id: 'mod-1',
          name: 'Original Title',
          slug: 'original',
          engine_type: 'instant_transaction',
          tenant_id: 'tenant-1',
          settings_version: 1,
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-1' },
        body: {
          name: 'Updated Title',
          settings: { color: 'blue' },
        },
      });

      await modulesController.updateModule(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      // Verify real state mutation in database
      const updated = harness.getTable('modules').find((m) => m.id === 'mod-1');
      expect(updated?.name).toBe('Updated Title');
      expect(updated?.settings_version).toBe(2);
    });

    it('strictly 404s when updating another tenant module (tenant isolation)', async () => {
      harness.seed('modules', [
        {
          id: 'mod-alien',
          name: 'Alien Module',
          slug: 'alien',
          engine_type: 'instant_transaction',
          tenant_id: 'tenant-2', // belongs to tenant-2
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-alien' },
        body: { name: 'Attempted Hijack' },
        user: {
          id: 'user-t1',
          userId: 'user-t1',
          role: 'admin',
          roles: ['admin'], // not super_admin
          scope: 'tenant',
          tenantId: 'tenant-1',
        },
      });

      await modulesController.updateModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Module not found',
      });

      // Verify table was NOT mutated
      const alien = harness.getTable('modules').find((m) => m.id === 'mod-alien');
      expect(alien?.name).toBe('Alien Module');
    });
  });

  describe('deleteModule', () => {
    it('soft deletes module by setting is_active to false in database', async () => {
      harness.seed('modules', [
        {
          id: 'mod-delete-me',
          name: 'Delete Me',
          slug: 'delete-me',
          is_active: true,
          tenant_id: 'tenant-1',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-delete-me' },
      });

      await modulesController.deleteModule(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      // Verify real state mutation: module is now inactive
      const target = harness.getTable('modules').find((m) => m.id === 'mod-delete-me');
      expect(target?.is_active).toBe(false);
    });

    it('rejects deletion of another tenant module with 404', async () => {
      harness.seed('modules', [
        {
          id: 'mod-other-tenant',
          name: 'Protected',
          slug: 'protected',
          is_active: true,
          tenant_id: 'tenant-other',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-other-tenant' },
        user: {
          id: 'user-t1',
          userId: 'user-t1',
          role: 'admin',
          roles: ['admin'],
          scope: 'tenant',
          tenantId: 'tenant-1',
        },
      });

      await modulesController.deleteModule(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Module not found',
      });

      // Verify module remained active
      const target = harness.getTable('modules').find((m) => m.id === 'mod-other-tenant');
      expect(target?.is_active).toBe(true);
    });
  });
});
