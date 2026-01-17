/**
 * User Service with Dependency Injection
 *
 * Handles user profile management and admin user operations.
 * Uses DI for repository, enabling easy testing.
 */

import type {
  UserRepository,
  User,
  UserWithRoles,
  Role,
  UserFilters,
  PreferredLanguage,
  LoggerService,
  ActivityLoggerService,
} from '../container/types.js';

// ============================================
// ERROR HANDLING
// ============================================

export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

// ============================================
// INPUT TYPES
// ============================================

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  preferredLanguage?: PreferredLanguage;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface UserService {
  // Profile operations
  getProfile(userId: string): Promise<UserWithRoles>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<User>;
  
  // Admin operations
  listUsers(filters?: UserFilters, pagination?: PaginationParams): Promise<{ users: UserWithRoles[]; total: number; page: number; limit: number; totalPages: number }>;
  getUserById(id: string): Promise<UserWithRoles>;
  updateUserRoles(userId: string, roleIds: string[], performedBy?: string): Promise<Role[]>;
  toggleUserActive(userId: string, isActive: boolean, performedBy?: string): Promise<User>;
}

// ============================================
// DEPENDENCIES
// ============================================

export interface UserServiceDeps {
  userRepository: UserRepository;
  logger: LoggerService;
  activityLogger?: ActivityLoggerService;
}

// ============================================
// VALIDATION
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
const VALID_LANGUAGES: PreferredLanguage[] = ['en', 'ar', 'fr'];

function validateUUID(id: string, fieldName: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new UserServiceError(`Invalid ${fieldName} format`, 'INVALID_UUID');
  }
}

function validateProfileInput(input: UpdateProfileInput): void {
  if (input.fullName !== undefined) {
    if (input.fullName.length < 2) {
      throw new UserServiceError('Full name must be at least 2 characters', 'INVALID_FULL_NAME');
    }
    if (input.fullName.length > 100) {
      throw new UserServiceError('Full name must be at most 100 characters', 'INVALID_FULL_NAME');
    }
  }
  
  if (input.phone !== undefined && input.phone !== null) {
    if (!PHONE_REGEX.test(input.phone)) {
      throw new UserServiceError('Invalid phone number format', 'INVALID_PHONE');
    }
  }
  
  if (input.preferredLanguage !== undefined) {
    if (!VALID_LANGUAGES.includes(input.preferredLanguage)) {
      throw new UserServiceError('Invalid preferred language', 'INVALID_LANGUAGE');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createUserService(deps: UserServiceDeps): UserService {
  const { userRepository, logger, activityLogger } = deps;

  // ----------------------------------------
  // PROFILE OPERATIONS
  // ----------------------------------------

  async function getProfile(userId: string): Promise<UserWithRoles> {
    validateUUID(userId, 'user ID');
    
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
    }
    
    return user;
  }

  async function updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    validateUUID(userId, 'user ID');
    validateProfileInput(input);
    
    // Check if there are any fields to update
    const hasUpdates = Object.values(input).some(v => v !== undefined);
    if (!hasUpdates) {
      throw new UserServiceError('No fields to update', 'NO_UPDATES');
    }
    
    const existingUser = await userRepository.getUserById(userId);
    if (!existingUser) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
    }
    
    const updateData: Partial<User> = {};
    if (input.fullName !== undefined) updateData.full_name = input.fullName;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.preferredLanguage !== undefined) updateData.preferred_language = input.preferredLanguage;
    
    const updated = await userRepository.updateUser(userId, updateData);
    
    logger.info(`Profile updated for user ${userId}`);
    
    if (activityLogger) {
      await activityLogger.log('profile_updated', {
        userId,
        changes: Object.keys(updateData),
      }, userId);
    }
    
    return updated;
  }

  // ----------------------------------------
  // ADMIN OPERATIONS
  // ----------------------------------------

  async function listUsers(
    filters: UserFilters = {},
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<{ users: UserWithRoles[]; total: number; page: number; limit: number; totalPages: number }> {
    // Validate pagination
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit));
    
    const result = await userRepository.getUsers(filters, { page, limit });
    
    return {
      users: result.users,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async function getUserById(id: string): Promise<UserWithRoles> {
    validateUUID(id, 'user ID');
    
    const user = await userRepository.getUserById(id);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
    }
    
    return user;
  }

  async function updateUserRoles(
    userId: string,
    roleIds: string[],
    performedBy?: string
  ): Promise<Role[]> {
    validateUUID(userId, 'user ID');
    
    if (!roleIds || roleIds.length === 0) {
      throw new UserServiceError('At least one role is required', 'NO_ROLES');
    }
    
    // Validate all role IDs
    for (const roleId of roleIds) {
      validateUUID(roleId, 'role ID');
    }
    
    // Verify user exists
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
    }
    
    // Verify all roles exist
    const existingRoles = await userRepository.getRolesByIds(roleIds);
    if (existingRoles.length !== roleIds.length) {
      throw new UserServiceError('One or more invalid role IDs', 'INVALID_ROLE_IDS');
    }
    
    // Get old roles for logging
    const oldRoles = user.roles;
    
    // Update roles
    const newRoles = await userRepository.updateUserRoles(userId, roleIds);
    
    logger.info(`Roles updated for user ${userId}: ${newRoles.map(r => r.name).join(', ')}`);
    
    if (activityLogger) {
      await activityLogger.log('user_roles_updated', {
        userId,
        oldRoles: oldRoles.map(r => r.name),
        newRoles: newRoles.map(r => r.name),
      }, performedBy);
    }
    
    return newRoles;
  }

  async function toggleUserActive(
    userId: string,
    isActive: boolean,
    performedBy?: string
  ): Promise<User> {
    validateUUID(userId, 'user ID');
    
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND', 404);
    }
    
    if (user.is_active === isActive) {
      throw new UserServiceError(
        `User is already ${isActive ? 'active' : 'inactive'}`,
        'NO_CHANGE'
      );
    }
    
    const updated = await userRepository.updateUser(userId, { is_active: isActive });
    
    logger.info(`User ${userId} ${isActive ? 'activated' : 'deactivated'}`);
    
    if (activityLogger) {
      await activityLogger.log(isActive ? 'user_activated' : 'user_deactivated', {
        userId,
      }, performedBy);
    }
    
    return updated;
  }

  return {
    getProfile,
    updateProfile,
    listUsers,
    getUserById,
    updateUserRoles,
    toggleUserActive,
  };
}
