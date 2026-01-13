import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../src/database/connection';
import { createChainableMock, mockRequest, mockResponse, mockNext } from './utils';

// Mock dependencies
vi.mock('../../src/database/connection');
vi.mock('../../src/utils/activityLogger', () => ({
  logActivity: vi.fn(),
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Import after mocks
import {
  getProfile,
  updateProfile,
  listUsers,
  getUserById,
  updateUserRoles,
} from '../../src/modules/users/user.controller';

describe('User Controller', () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof mockResponse>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
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

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockUser)),
      } as any);

      req.user = { userId: 'user-123', role: 'customer' };

      await getProfile(req as Request, res as Response, next as NextFunction);

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

    it('should return 401 when not authenticated', async () => {
      req.user = undefined;

      await getProfile(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        ),
      } as any);

      req.user = { userId: 'nonexistent', role: 'customer' };

      await getProfile(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updatedUser = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Updated Name',
        phone: '+1234567890',
        profile_image_url: null,
        preferred_language: 'ar',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(updatedUser)
        ),
      } as any);

      req.user = { userId: 'user-123', role: 'customer' };
      req.body = { full_name: 'Updated Name', preferred_language: 'ar' };

      await updateProfile(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
      });
    });

    it('should return 401 when not authenticated', async () => {
      req.user = undefined;
      req.body = { full_name: 'New Name' };

      await updateProfile(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 for invalid data', async () => {
      req.user = { userId: 'user-123', role: 'customer' };
      req.body = { full_name: 'A' }; // Too short

      await updateProfile(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
    });

    it('should return 400 when no fields to update', async () => {
      req.user = { userId: 'user-123', role: 'customer' };
      req.body = {};

      await updateProfile(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields to update',
      });
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
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
          user_roles: [{ role: { name: 'customer' } }],
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          full_name: 'User Two',
          phone: null,
          profile_image_url: null,
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: null,
          user_roles: [{ role: { name: 'staff' } }],
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(mockUsers, null, 2)
        ),
      } as any);

      req.query = { page: '1', limit: '20' };

      await listUsers(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'user-1' }),
          expect.objectContaining({ id: 'user-2' }),
        ]),
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should support search query', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock([], null, 0)
        ),
      } as any);

      req.query = { search: 'test@example.com' };

      await listUsers(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
        })
      );
    });

    it('should handle database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { message: 'DB error' })
        ),
      } as any);

      req.query = {};

      await listUsers(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to list users',
      });
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        full_name: 'Test User',
        phone: null,
        profile_image_url: null,
        preferred_language: 'en',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
        last_login_at: null,
        user_roles: [{ role: { id: 'role-1', name: 'customer', display_name: 'Customer' } }],
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(mockUser)
        ),
      } as any);

      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      await getUserById(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          roles: expect.arrayContaining([
            expect.objectContaining({ name: 'customer' }),
          ]),
        }),
      });
    });

    it('should return 400 for invalid UUID', async () => {
      req.params = { id: 'invalid-uuid' };

      await getUserById(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID format',
      });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        ),
      } as any);

      req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      await getUserById(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });

  describe('updateUserRoles', () => {
    const validUserId = '123e4567-e89b-12d3-a456-426614174000';
    const validRoleId = '223e4567-e89b-12d3-a456-426614174000';

    it('should update user roles successfully', async () => {
      const mockUser = { id: validUserId, email: 'user@example.com' };
      const mockRoles = [{ id: validRoleId, name: 'admin' }];
      const mockOldRoles = [{ role_id: 'old-role', roles: { name: 'customer' } }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(createChainableMock(mockUser))
          .mockReturnValueOnce(createChainableMock(mockRoles))
          .mockReturnValueOnce(createChainableMock(mockOldRoles))
          .mockReturnValueOnce(createChainableMock(null))
          .mockReturnValueOnce(createChainableMock(null)),
      } as any);

      req.params = { id: validUserId };
      req.body = { roleIds: [validRoleId] };
      req.user = { userId: 'admin-123', role: 'super_admin' };

      await updateUserRoles(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Roles updated successfully',
        data: { roles: ['admin'] },
      });
    });

    it('should return 400 for invalid user ID format', async () => {
      req.params = { id: 'invalid' };
      req.body = { roleIds: [validRoleId] };

      await updateUserRoles(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID format',
      });
    });

    it('should return 400 for empty role IDs', async () => {
      req.params = { id: validUserId };
      req.body = { roleIds: [] };

      await updateUserRoles(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        ),
      } as any);

      req.params = { id: validUserId };
      req.body = { roleIds: [validRoleId] };
      req.user = { userId: 'admin-123', role: 'super_admin' };

      await updateUserRoles(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should return 400 for invalid role IDs', async () => {
      const mockUser = { id: validUserId, email: 'user@example.com' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(createChainableMock(mockUser))
          .mockReturnValueOnce(createChainableMock([])), // No matching roles
      } as any);

      req.params = { id: validUserId };
      req.body = { roleIds: [validRoleId] };
      req.user = { userId: 'admin-123', role: 'super_admin' };

      await updateUserRoles(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'One or more invalid role IDs',
      });
    });
  });
});
