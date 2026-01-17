/**
 * User Service Unit Tests
 * 
 * Tests for the DI-based UserService.
 * Uses in-memory repository for testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createUserService,
  UserService,
  UserServiceError,
  UpdateProfileInput,
} from '../../src/lib/services/user.service.js';
import { createInMemoryUserRepository } from '../../src/lib/repositories/user.repository.memory.js';
import type { 
  LoggerService, 
  ActivityLoggerService, 
  UserWithRoles,
  Role,
} from '../../src/lib/container/types.js';

describe('UserService', () => {
  let userService: UserService;
  let userRepo: ReturnType<typeof createInMemoryUserRepository>;
  let mockLogger: LoggerService;
  let mockActivityLogger: ActivityLoggerService;

  const sampleRoles: Role[] = [
    { id: '550e8400-e29b-41d4-a716-446655440101', name: 'admin', display_name: 'Administrator' },
    { id: '550e8400-e29b-41d4-a716-446655440102', name: 'staff', display_name: 'Staff Member' },
    { id: '550e8400-e29b-41d4-a716-446655440103', name: 'customer', display_name: 'Customer' },
  ];

  const sampleUser: UserWithRoles = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'john@example.com',
    full_name: 'John Doe',
    phone: '+1-555-1234',
    profile_image_url: null,
    preferred_language: 'en',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: null,
    last_login_at: null,
    roles: [sampleRoles[2]], // customer
  };

  beforeEach(() => {
    userRepo = createInMemoryUserRepository();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    mockActivityLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    // Add sample roles
    sampleRoles.forEach(role => userRepo.addRole(role));

    userService = createUserService({
      userRepository: userRepo,
      logger: mockLogger,
      activityLogger: mockActivityLogger,
    });
  });

  // ============================================
  // Profile Operations
  // ============================================

  describe('getProfile', () => {
    it('should return user profile with roles', async () => {
      userRepo.addUser(sampleUser);

      const profile = await userService.getProfile(sampleUser.id);

      expect(profile.id).toBe(sampleUser.id);
      expect(profile.email).toBe('john@example.com');
      expect(profile.full_name).toBe('John Doe');
      expect(profile.roles).toHaveLength(1);
      expect(profile.roles[0].name).toBe('customer');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.getProfile('550e8400-e29b-41d4-a716-446655440999')
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(
        userService.getProfile('invalid-id')
      ).rejects.toThrow(UserServiceError);
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      userRepo.addUser(sampleUser);
    });

    it('should update full name', async () => {
      const updated = await userService.updateProfile(sampleUser.id, {
        fullName: 'John Smith',
      });

      expect(updated.full_name).toBe('John Smith');
    });

    it('should update phone number', async () => {
      const updated = await userService.updateProfile(sampleUser.id, {
        phone: '+1-555-9999',
      });

      expect(updated.phone).toBe('+1-555-9999');
    });

    it('should clear phone number when set to null', async () => {
      const updated = await userService.updateProfile(sampleUser.id, {
        phone: null,
      });

      expect(updated.phone).toBeNull();
    });

    it('should update preferred language', async () => {
      const updated = await userService.updateProfile(sampleUser.id, {
        preferredLanguage: 'ar',
      });

      expect(updated.preferred_language).toBe('ar');
    });

    it('should update multiple fields', async () => {
      const updated = await userService.updateProfile(sampleUser.id, {
        fullName: 'Jane Doe',
        phone: '+1-555-0000',
        preferredLanguage: 'fr',
      });

      expect(updated.full_name).toBe('Jane Doe');
      expect(updated.phone).toBe('+1-555-0000');
      expect(updated.preferred_language).toBe('fr');
    });

    it('should log activity', async () => {
      await userService.updateProfile(sampleUser.id, { fullName: 'New Name' });

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'profile_updated',
        expect.objectContaining({
          userId: sampleUser.id,
          changes: ['full_name'],
        }),
        sampleUser.id
      );
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.updateProfile('550e8400-e29b-41d4-a716-446655440999', { fullName: 'Test' })
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error when no fields to update', async () => {
      await expect(
        userService.updateProfile(sampleUser.id, {})
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for name too short', async () => {
      await expect(
        userService.updateProfile(sampleUser.id, { fullName: 'J' })
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for name too long', async () => {
      await expect(
        userService.updateProfile(sampleUser.id, { fullName: 'A'.repeat(101) })
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid phone format', async () => {
      await expect(
        userService.updateProfile(sampleUser.id, { phone: 'abc' })
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid language', async () => {
      await expect(
        userService.updateProfile(sampleUser.id, { preferredLanguage: 'xx' as any })
      ).rejects.toThrow(UserServiceError);
    });
  });

  // ============================================
  // Admin Operations
  // ============================================

  describe('listUsers', () => {
    beforeEach(() => {
      // Add multiple users
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'alice@example.com',
        full_name: 'Alice Johnson',
        created_at: '2024-01-01T00:00:00Z',
      });
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'bob@example.com',
        full_name: 'Bob Smith',
        is_active: false,
        created_at: '2024-01-02T00:00:00Z',
      });
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'charlie@example.com',
        full_name: 'Charlie Brown',
        created_at: '2024-01-03T00:00:00Z',
        roles: [sampleRoles[0]], // admin
      });
    });

    it('should return all users', async () => {
      const result = await userService.listUsers();

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by search term (email)', async () => {
      const result = await userService.listUsers({ search: 'alice' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('alice@example.com');
    });

    it('should filter by search term (name)', async () => {
      const result = await userService.listUsers({ search: 'smith' });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].full_name).toBe('Bob Smith');
    });

    it('should filter by active status', async () => {
      const result = await userService.listUsers({ isActive: true });

      expect(result.users).toHaveLength(2);
      expect(result.users.every(u => u.is_active)).toBe(true);
    });

    it('should filter by inactive status', async () => {
      const result = await userService.listUsers({ isActive: false });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].full_name).toBe('Bob Smith');
    });

    it('should paginate results', async () => {
      const page1 = await userService.listUsers({}, { page: 1, limit: 2 });
      const page2 = await userService.listUsers({}, { page: 2, limit: 2 });

      expect(page1.users).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.totalPages).toBe(2);

      expect(page2.users).toHaveLength(1);
      expect(page2.page).toBe(2);
    });

    it('should limit maximum page size to 100', async () => {
      const result = await userService.listUsers({}, { page: 1, limit: 200 });
      expect(result.limit).toBe(100);
    });

    it('should default page to 1 for invalid values', async () => {
      const result = await userService.listUsers({}, { page: -1, limit: 10 });
      expect(result.page).toBe(1);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      userRepo.addUser(sampleUser);

      const user = await userService.getUserById(sampleUser.id);

      expect(user.id).toBe(sampleUser.id);
      expect(user.email).toBe('john@example.com');
    });

    it('should include roles', async () => {
      userRepo.addUser({
        ...sampleUser,
        roles: [sampleRoles[0], sampleRoles[1]], // admin and staff
      });

      const user = await userService.getUserById(sampleUser.id);

      expect(user.roles).toHaveLength(2);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.getUserById('550e8400-e29b-41d4-a716-446655440999')
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid ID format', async () => {
      await expect(
        userService.getUserById('invalid')
      ).rejects.toThrow(UserServiceError);
    });
  });

  describe('updateUserRoles', () => {
    beforeEach(() => {
      userRepo.addUser(sampleUser);
    });

    it('should update user roles', async () => {
      const newRoles = await userService.updateUserRoles(
        sampleUser.id,
        ['550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440102']
      );

      expect(newRoles).toHaveLength(2);
      expect(newRoles.map(r => r.name).sort()).toEqual(['admin', 'staff']);
    });

    it('should replace all existing roles', async () => {
      await userService.updateUserRoles(sampleUser.id, ['550e8400-e29b-41d4-a716-446655440101']);
      const newRoles = await userService.updateUserRoles(sampleUser.id, ['550e8400-e29b-41d4-a716-446655440102']);

      expect(newRoles).toHaveLength(1);
      expect(newRoles[0].name).toBe('staff');
    });

    it('should log activity with performer', async () => {
      await userService.updateUserRoles(
        sampleUser.id,
        ['550e8400-e29b-41d4-a716-446655440101'],
        'admin-user-123'
      );

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'user_roles_updated',
        expect.objectContaining({
          userId: sampleUser.id,
          oldRoles: ['customer'],
          newRoles: ['admin'],
        }),
        'admin-user-123'
      );
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.updateUserRoles('550e8400-e29b-41d4-a716-446655440999', ['550e8400-e29b-41d4-a716-446655440101'])
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for empty role array', async () => {
      await expect(
        userService.updateUserRoles(sampleUser.id, [])
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid role ID', async () => {
      await expect(
        userService.updateUserRoles(sampleUser.id, ['550e8400-e29b-41d4-a716-446655440999'])
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for invalid role ID format', async () => {
      await expect(
        userService.updateUserRoles(sampleUser.id, ['invalid-format'])
      ).rejects.toThrow(UserServiceError);
    });
  });

  describe('toggleUserActive', () => {
    beforeEach(() => {
      userRepo.addUser(sampleUser);
    });

    it('should deactivate active user', async () => {
      const updated = await userService.toggleUserActive(sampleUser.id, false);

      expect(updated.is_active).toBe(false);
    });

    it('should activate inactive user', async () => {
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440002',
        is_active: false,
      });

      const updated = await userService.toggleUserActive(
        '550e8400-e29b-41d4-a716-446655440002',
        true
      );

      expect(updated.is_active).toBe(true);
    });

    it('should log activation', async () => {
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440002',
        is_active: false,
      });

      await userService.toggleUserActive(
        '550e8400-e29b-41d4-a716-446655440002',
        true,
        'admin-123'
      );

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'user_activated',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440002',
        }),
        'admin-123'
      );
    });

    it('should log deactivation', async () => {
      await userService.toggleUserActive(sampleUser.id, false, 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'user_deactivated',
        expect.anything(),
        'admin-123'
      );
    });

    it('should throw error when status unchanged (already active)', async () => {
      await expect(
        userService.toggleUserActive(sampleUser.id, true)
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error when status unchanged (already inactive)', async () => {
      userRepo.addUser({
        ...sampleUser,
        id: '550e8400-e29b-41d4-a716-446655440002',
        is_active: false,
      });

      await expect(
        userService.toggleUserActive('550e8400-e29b-41d4-a716-446655440002', false)
      ).rejects.toThrow(UserServiceError);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userService.toggleUserActive('550e8400-e29b-41d4-a716-446655440999', false)
      ).rejects.toThrow(UserServiceError);
    });
  });

  // ============================================
  // Error Class Tests
  // ============================================

  describe('UserServiceError', () => {
    it('should create error with correct properties', () => {
      const error = new UserServiceError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('UserServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new UserServiceError('Test', 'CODE');
      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should work without activity logger', async () => {
      const serviceWithoutLogger = createUserService({
        userRepository: userRepo,
        logger: mockLogger,
      });

      userRepo.addUser(sampleUser);
      const updated = await serviceWithoutLogger.updateProfile(sampleUser.id, {
        fullName: 'New Name',
      });

      expect(updated.full_name).toBe('New Name');
    });

    it('should handle user with no roles', async () => {
      userRepo.addUser({
        ...sampleUser,
        roles: [],
      });

      const profile = await userService.getProfile(sampleUser.id);
      expect(profile.roles).toHaveLength(0);
    });

    it('should handle user with multiple roles', async () => {
      userRepo.addUser({
        ...sampleUser,
        roles: sampleRoles, // all 3 roles
      });

      const profile = await userService.getProfile(sampleUser.id);
      expect(profile.roles).toHaveLength(3);
    });
  });
});
