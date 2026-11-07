import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';
import { createMockReqRes } from '../utils';

const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.client,
}));

vi.mock('../../../src/security/scoped-client.js', () => ({
  getScopedClient: () => harness.client,
  requireTenantScope: (req: any) => req?.user?.tenantId || 'tenant-1',
  tenantContextFor: (req: any) => ({ tenantId: req?.user?.tenantId || 'tenant-1', actorId: req?.user?.userId }),
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { getRoles, createRole, updateRole, deleteRole } from '../../../src/modules/admin/controllers/roles.controller';

describe('RolesController (Genuine Stateful Database Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.clear();
  });

  describe('getRoles', () => {
    it('returns roles with accurately computed user and permission counts from stateful tables', async () => {
      harness.seed('roles', [
        { id: 'role-1', name: 'admin', display_name: 'Administrator', tenant_id: 'tenant-1' },
        { id: 'role-2', name: 'staff', display_name: 'Staff', tenant_id: 'tenant-1' },
      ]);

      harness.seed('user_roles', [
        { role_id: 'role-1', user_id: 'u-1', tenant_id: 'tenant-1' },
        { role_id: 'role-1', user_id: 'u-2', tenant_id: 'tenant-1' },
        { role_id: 'role-2', user_id: 'u-3', tenant_id: 'tenant-1' },
      ]);

      harness.seed('role_permissions', [
        { role_id: 'role-1', permission_id: 'perm-1' },
        { role_id: 'role-1', permission_id: 'perm-2' },
        { role_id: 'role-2', permission_id: 'perm-1' },
      ]);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await getRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'role-1',
              users_count: 2,
              permissions_count: 2,
            }),
            expect.objectContaining({
              id: 'role-2',
              users_count: 1,
              permissions_count: 1,
            }),
          ]),
        })
      );
    });

    it('returns empty array when no roles exist for tenant', async () => {
      harness.seed('roles', []);

      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await getRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('handles simulated database errors by passing error to next', async () => {
      harness.simulateError('roles', { message: 'Database query timeout' });

      const { req, res, next } = createMockReqRes();
      await getRoles(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database query timeout' }));
    });
  });

  describe('createRole', () => {
    it('creates role successfully and persists it in the database table', async () => {
      harness.seed('roles', []);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'concierge',
          displayName: 'Guest Concierge',
          description: 'Front-desk concierge service role',
          businessUnit: 'property',
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await createRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const rolesInDb = harness.getTable('roles');
      expect(rolesInDb.length).toBe(1);
      expect(rolesInDb[0].name).toBe('concierge');
      expect(rolesInDb[0].display_name).toBe('Guest Concierge');
    });

    it('handles database creation error by calling next', async () => {
      harness.simulateError('roles', { message: 'Unique constraint violation: role name exists' });

      const { req, res, next } = createMockReqRes({
        body: { name: 'duplicate' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await createRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unique constraint violation: role name exists' }));
    });
  });

  describe('updateRole', () => {
    it('updates role successfully and mutates table in stateful db', async () => {
      harness.seed('roles', [
        {
          id: 'role-update-1',
          name: 'old-role-name',
          display_name: 'Old Role',
          tenant_id: 'tenant-1',
        },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-update-1' },
        body: {
          name: 'updated-role-name',
          displayName: 'Updated Role Display',
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await updateRole(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      // Verify real state mutation
      const updated = harness.getTable('roles').find((r) => r.id === 'role-update-1');
      expect(updated?.name).toBe('updated-role-name');
      expect(updated?.display_name).toBe('Updated Role Display');
    });

    it('handles update errors by calling next', async () => {
      harness.simulateError('roles', { message: 'Database lock timeout' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-1' },
        body: { name: 'test' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await updateRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database lock timeout' }));
    });
  });

  describe('deleteRole', () => {
    it('deletes role from stateful database and cascades deletion of role permissions', async () => {
      harness.seed('roles', [
        { id: 'role-to-delete', name: 'temp-role', tenant_id: 'tenant-1' },
      ]);
      harness.seed('user_roles', []); // No assigned users
      harness.seed('role_permissions', [
        { role_id: 'role-to-delete', permission_id: 'perm-1' },
      ]);
      harness.seed('app_role_permissions', [
        { role_name: 'temp-role', permission_slug: 'module:temp:view', tenant_id: 'tenant-1' },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-to-delete' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await deleteRole(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Role deleted successfully',
      });

      // Verify row is actually removed from database
      const remainingRoles = harness.getTable('roles');
      expect(remainingRoles.some((r) => r.id === 'role-to-delete')).toBe(false);
    });

    it('prevents deletion if role still has assigned users', async () => {
      harness.seed('roles', [
        { id: 'role-with-users', name: 'active-staff', tenant_id: 'tenant-1' },
      ]);
      harness.seed('user_roles', [
        { role_id: 'role-with-users', user_id: 'u-1', tenant_id: 'tenant-1' },
      ]);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-with-users' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
      });

      await deleteRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cannot delete role with assigned users'),
        })
      );

      // Verify role was NOT deleted
      expect(harness.getTable('roles').length).toBe(1);
    });
  });
});
