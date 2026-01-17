/**
 * User Controller Unit Tests
 * 
 * Comprehensive tests for user.controller.ts HTTP handlers.
 * Tests all user endpoints: getProfile, updateProfile, listUsers,
 * getUserById, updateUserRoles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockReqRes, createChainableMock } from './utils.js';

// Mock dependencies before importing controller
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

describe('User Controller', () => {
  let getSupabase: typeof import('../../src/database/connection.js').getSupabase;
  let logActivity: typeof import('../../src/utils/activityLogger.js').logActivity;

  beforeEach(async () => {
    vi.clearAllMocks();
    const connectionModule = await import('../../src/database/connection.js');
    getSupabase = connectionModule.getSupabase;
    const activityLogger = await import('../../src/utils/activityLogger.js');
    logActivity = activityLogger.logActivity;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // GET PROFILE TESTS
  // ============================================

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Test User',
        phone: '+1234567890',
        profile_image_url: null,
        preferred_language: 'en',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
        user_roles: [{ role: { name: 'customer' } }],
      };

      const queryMock = createChainableMock(mockUser);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'user-123', role: 'customer' };

      await getProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'user-123',
          email: 'user@example.com',
          full_name: 'Test User',
          roles: ['customer'],
        }),
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      const { getProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = undefined;

      await getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 if user not found', async () => {
      const queryMock = createChainableMock(null, { code: 'PGRST116' });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'nonexistent-123', role: 'customer' };

      await getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle user with multiple roles', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
        full_name: 'Admin User',
        phone: null,
        profile_image_url: null,
        preferred_language: 'en',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
        user_roles: [
          { role: { name: 'admin' } },
          { role: { name: 'staff' } },
        ],
      };

      const queryMock = createChainableMock(mockUser);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'user-123', role: 'admin' };

      await getProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          roles: ['admin', 'staff'],
        }),
      });
    });
  });

  // ============================================
  // UPDATE PROFILE TESTS
  // ============================================

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updatedUser = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Updated Name',
        phone: '+9876543210',
        profile_image_url: null,
        preferred_language: 'ar',
      };

      const queryMock = createChainableMock(updatedUser);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          full_name: 'Updated Name',
          phone: '+9876543210',
          preferred_language: 'ar',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await updateProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
      });
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'UPDATE_PROFILE',
        resource: 'users',
      }));
    });

    it('should return 401 if user is not authenticated', async () => {
      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { full_name: 'New Name' },
      });
      req.user = undefined;

      await updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 if no fields to update', async () => {
      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {},
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields to update',
      });
    });

    it('should return 400 for invalid phone format', async () => {
      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { phone: 'not-a-phone' },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Validation failed',
      }));
    });

    it('should return 400 for invalid preferred_language', async () => {
      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { preferred_language: 'de' }, // Only en, ar, fr are valid
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle database error on update', async () => {
      const queryMock = createChainableMock(null, { message: 'Update failed' });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateProfile } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { full_name: 'New Name' },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update profile',
      });
    });
  });

  // ============================================
  // LIST USERS (ADMIN) TESTS
  // ============================================

  describe('listUsers', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          full_name: 'User One',
          phone: null,
          profile_image_url: null,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: null,
          user_roles: [{ role: { id: 'role-1', name: 'customer' } }],
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          full_name: 'User Two',
          phone: '+1234567890',
          profile_image_url: null,
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: null,
          user_roles: [{ role: { id: 'role-2', name: 'staff' } }],
        },
      ];

      const queryMock = createChainableMock(mockUsers, null, 2);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { listUsers } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { page: '1', limit: '20' },
      });

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'user-1', roles: ['customer'] }),
          expect.objectContaining({ id: 'user-2', roles: ['staff'] }),
        ]),
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter users by search term', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          full_name: 'John Doe',
          phone: null,
          profile_image_url: null,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: null,
          user_roles: [],
        },
      ];

      const queryMock = createChainableMock(mockUsers, null, 1);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { listUsers } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { search: 'john' },
      });

      await listUsers(req, res, next);

      expect(queryMock.or).toHaveBeenCalled();
    });

    it('should sanitize search input to prevent SQL injection', async () => {
      const queryMock = createChainableMock([], null, 0);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { listUsers } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { search: "'; DROP TABLE users; --" },
      });

      await listUsers(req, res, next);

      // Should complete without error and call or() with sanitized input
      expect(queryMock.or).toHaveBeenCalled();
      const orCall = queryMock.or.mock.calls[0][0];
      expect(orCall).not.toContain("'");
      expect(orCall).not.toContain(";");
    });

    it('should respect limit cap of 100', async () => {
      const queryMock = createChainableMock([], null, 0);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { listUsers } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { limit: '500' }, // Exceeds cap
      });

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        pagination: expect.objectContaining({
          limit: 100, // Should be capped at 100
        }),
      }));
    });

    it('should handle database error', async () => {
      const queryMock = createChainableMock(null, { message: 'Database error' });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { listUsers } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes();

      await listUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to list users',
      });
    });
  });

  // ============================================
  // GET USER BY ID (ADMIN) TESTS
  // ============================================

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        email: 'user@example.com',
        full_name: 'Test User',
        phone: null,
        profile_image_url: null,
        preferred_language: 'en',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
        last_login_at: '2024-01-15T10:30:00Z',
        user_roles: [{ role: { id: 'role-1', name: 'customer', display_name: 'Customer' } }],
      };

      const queryMock = createChainableMock(mockUser);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getUserById } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      });

      await getUserById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          email: 'user@example.com',
          roles: [{ id: 'role-1', name: 'customer', displayName: 'Customer' }],
        }),
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const { getUserById } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'not-a-valid-uuid' },
      });

      await getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID format',
      });
    });

    it('should return 404 if user not found', async () => {
      const queryMock = createChainableMock(null, { code: 'PGRST116' });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getUserById } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      });

      await getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });

  // ============================================
  // UPDATE USER ROLES (SUPER ADMIN) TESTS
  // ============================================

  describe('updateUserRoles', () => {
    it('should update user roles successfully', async () => {
      const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const roleId = 'b2c3d4e5-f678-9012-cdef-ab1234567890';

      // Mock user exists
      const userQueryMock = createChainableMock({ id: userId, email: 'user@test.com' });
      // Mock roles exist
      const rolesQueryMock = createChainableMock([{ id: roleId, name: 'staff' }]);
      // Mock old roles
      const oldRolesQueryMock = createChainableMock([{ role_id: 'old-role', roles: { name: 'customer' } }]);
      // Mock delete
      const deleteQueryMock = createChainableMock(null);
      // Mock insert
      const insertQueryMock = createChainableMock(null);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'users') return userQueryMock;
          if (table === 'roles') return rolesQueryMock;
          if (table === 'user_roles') {
            // Alternate between old roles query, delete, and insert
            if (callCount === 3) return oldRolesQueryMock;
            if (callCount === 4) return deleteQueryMock;
            return insertQueryMock;
          }
          return createChainableMock(null);
        }),
      } as any);

      const { updateUserRoles } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: userId },
        body: { roleIds: [roleId] },
      });
      req.user = { userId: 'admin-123', role: 'super_admin' };

      await updateUserRoles(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Roles updated successfully',
        data: { roles: ['staff'] },
      });
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_USER_ROLES',
        resource: 'users',
        entity_id: userId,
      }));
    });

    it('should return 400 for invalid UUID format', async () => {
      const { updateUserRoles } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid-uuid' },
        body: { roleIds: ['role-1'] },
      });

      await updateUserRoles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID format',
      });
    });

    it('should return 400 if roleIds is empty', async () => {
      const { updateUserRoles } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        body: { roleIds: [] },
      });

      await updateUserRoles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Validation failed',
      }));
    });

    it('should return 404 if user not found', async () => {
      const queryMock = createChainableMock(null, { code: 'PGRST116' });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateUserRoles } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        body: { roleIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] },
      });

      await updateUserRoles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should return 400 if role IDs are invalid', async () => {
      const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      
      // User exists
      const userQueryMock = createChainableMock({ id: userId, email: 'user@test.com' });
      // But roles don't exist (return fewer than requested)
      const rolesQueryMock = createChainableMock([]);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'users') return userQueryMock;
          return rolesQueryMock;
        }),
      } as any);

      const { updateUserRoles } = await import('../../src/modules/users/user.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: userId },
        body: { roleIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] },
      });

      await updateUserRoles(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'One or more invalid role IDs',
      });
    });
  });
});
