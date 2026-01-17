import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

import { getSupabase } from '../../../src/database/connection';
import { getRoles, createRole, updateRole, deleteRole } from '../../../src/modules/admin/controllers/roles.controller';

describe('RolesController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoles', () => {
    it('should return roles with user and permission counts', async () => {
      const mockRoles = [
        { id: 'role-1', name: 'admin', display_name: 'Administrator' },
        { id: 'role-2', name: 'staff', display_name: 'Staff' }
      ];
      const mockUserRoles = [
        { role_id: 'role-1' },
        { role_id: 'role-1' },
        { role_id: 'role-2' }
      ];
      const mockRolePerms = [
        { role_id: 'role-1', permission_id: 'perm-1' },
        { role_id: 'role-1', permission_id: 'perm-2' },
        { role_id: 'role-2', permission_id: 'perm-1' }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'roles') return createChainableMock(mockRoles);
        if (table === 'user_roles') return createChainableMock(mockUserRoles);
        if (table === 'role_permissions') return createChainableMock(mockRolePerms);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'role-1',
            users_count: 2,
            permissions_count: 2
          }),
          expect.objectContaining({
            id: 'role-2',
            users_count: 1,
            permissions_count: 1
          })
        ])
      }));
    });

    it('should return empty array when no roles', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle database errors', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getRoles(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createRole', () => {
    it('should create role successfully', async () => {
      const mockRole = { id: 'role-1', name: 'manager', display_name: 'Manager' };

      const queryBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: mockRole, error: null }))
      };

      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'manager',
          displayName: 'Manager',
          description: 'Management role',
          businessUnit: 'resort'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await createRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRole
      });
    });

    it('should handle creation errors', async () => {
      const queryBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: new Error('Duplicate') }))
      };

      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        body: { name: 'duplicate' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await createRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      const mockRole = { id: 'role-1', name: 'updated-role' };

      const queryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: mockRole, error: null }))
      };

      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-1' },
        body: { name: 'updated-role', displayName: 'Updated Role' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateRole(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRole
      });
    });

    it('should handle update errors', async () => {
      const queryBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: new Error('Update failed') }))
      };

      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-1' },
        body: { name: 'test' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteRole', () => {
    it('should delete role successfully', async () => {
      // deleteRole checks for assigned users, deletes permissions, then deletes role
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0 })
            })
          };
        }
        if (table === 'role_permissions') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        }
        if (table === 'roles') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom
      } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-1' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteRole(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Role deleted successfully'
      });
    });

    it('should handle delete errors', async () => {
      const queryBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: new Error('Delete failed') }))
      };

      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'role-1' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteRole(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
