import { describe, it, expect, vi, beforeEach } from 'vitest';

// Storage for mock data
let mockUsers: Array<Record<string, unknown>> = [];
let mockRoles: Array<Record<string, unknown>> = [];
let mockUserRoles: Array<Record<string, unknown>> = [];
let mockSessions: Array<Record<string, unknown>> = [];
let mockPasswordResets: Array<Record<string, unknown>> = [];

// Create a chainable query mock
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ 
      data: firstItem, 
      error: firstItem ? null : { code: 'PGRST116' }
    });
  });
  
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  
  mockObj.insert = vi.fn().mockImplementation((insertData) => {
    const insertResult = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: Array.isArray(insertData) 
            ? insertData.map((d: unknown, i: number) => ({ id: `new-item-${i}`, ...(d as object) }))
            : { id: 'new-user-1', ...insertData }, 
          error: null 
        })
      }),
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: insertData, error: null });
        return Promise.resolve({ data: insertData, error: null });
      }
    };
    return insertResult;
  });
  
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'not', 'is', 'or'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  
  return mockObj;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'users':
        return createQueryMock(() => mockUsers);
      case 'roles':
        return createQueryMock(() => mockRoles);
      case 'user_roles':
        return createQueryMock(() => mockUserRoles);
      case 'sessions':
        return createQueryMock(() => mockSessions);
      case 'password_reset_tokens':
        return createQueryMock(() => mockPasswordResets);
      default:
        return createQueryMock(() => []);
    }
  })
};

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock auth.utils
vi.mock('../../../../src/modules/auth/auth.utils', () => ({
  generateTokens: vi.fn().mockReturnValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token'
  }),
  verifyRefreshToken: vi.fn().mockReturnValue({ 
    userId: 'user-123', 
    tokenVersion: 0 
  }),
}));

// Mock database connection
vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock config
vi.mock('../../../../src/config/index', () => ({
  config: {
    jwt: {
      accessTokenSecret: 'test-secret',
      refreshTokenSecret: 'test-refresh-secret',
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '7d'
    }
  }
}));

// Mock email service
vi.mock('../../../../src/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendPasswordReset: vi.fn().mockResolvedValue(true),
    sendWelcome: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as authService from '../../../../src/modules/auth/auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers = [];
    mockRoles = [];
    mockUserRoles = [];
    mockSessions = [];
    mockPasswordResets = [];
  });

  // ============================================
  // REGISTRATION
  // ============================================

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUsers = []; // No existing user
      mockRoles = [{ id: 'role-1', name: 'customer' }];

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(result.user).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should throw error if email already exists', async () => {
      mockUsers = [{ id: 'existing-user', email: 'test@example.com' }];

      await expect(authService.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      })).rejects.toThrow('Email already registered');
    });

    it('should register user with preferred language', async () => {
      mockUsers = [];
      mockRoles = [{ id: 'role-1', name: 'customer' }];

      const result = await authService.register({
        email: 'arabic@example.com',
        password: 'password123',
        fullName: 'Arabic User',
        preferredLanguage: 'ar',
      });

      expect(result.user).toBeDefined();
    });
  });

  // ============================================
  // LOGIN
  // ============================================

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        is_active: true,
        two_factor_enabled: false,
        token_version: 0
      }];
      mockUserRoles = [{ role_id: 'role-1', roles: { name: 'customer' } }];

      const result = await authService.login('test@example.com', 'password123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser'
      });

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should return 2FA required when enabled', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        is_active: true,
        two_factor_enabled: true,
        token_version: 0
      }];

      const result = await authService.login('test@example.com', 'password123', {});

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.message).toBe('Two-factor authentication required');
    });

    it('should reject disabled account', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        is_active: false,
        two_factor_enabled: false
      }];

      await expect(authService.login('test@example.com', 'password123', {}))
        .rejects.toThrow('Account is disabled');
    });

    it('should reject invalid credentials when user not found', async () => {
      mockUsers = [];

      await expect(authService.login('nonexistent@example.com', 'password123', {}))
        .rejects.toThrow('Invalid credentials');
    });
  });

  // ============================================
  // COMPLETE LOGIN AFTER 2FA
  // ============================================

  describe('completeLoginAfter2FA', () => {
    it('should complete login after 2FA verification', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        token_version: 0,
        is_active: true
      }];
      mockUserRoles = [{ role_id: 'role-1', roles: { name: 'customer' } }];

      const result = await authService.completeLoginAfter2FA('user-1', {
        ipAddress: '127.0.0.1'
      });

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });

  // ============================================
  // TOKEN REFRESH
  // ============================================

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      mockUsers = [{
        id: 'user-123',
        email: 'test@example.com',
        token_version: 0,
        is_active: true
      }];
      mockSessions = [{
        id: 'session-1',
        user_id: 'user-123',
        refresh_token: 'mock_refresh_token',
        is_active: true
      }];
      mockUserRoles = [{ role_id: 'role-1', roles: { name: 'customer' } }];

      const result = await authService.refreshAccessToken('mock_refresh_token');

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });
  });

  // ============================================
  // LOGOUT
  // ============================================

  describe('logout', () => {
    it('should logout user and invalidate tokens', async () => {
      mockSessions = [{ id: 'session-1', user_id: 'user-1', refresh_token: 'token' }];

      await authService.logout('user-1', 'token');

      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });

    it('should logout all sessions when no token provided', async () => {
      mockSessions = [
        { id: 'session-1', user_id: 'user-1' },
        { id: 'session-2', user_id: 'user-1' }
      ];

      await authService.logout('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });
  });

  // ============================================
  // USER RETRIEVAL
  // ============================================

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User'
      }];
      mockUserRoles = [{ role_id: 'role-1', roles: { name: 'customer' } }];

      const result = await authService.getCurrentUser('user-1');

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User'
      }];

      const result = await authService.getUserById('user-1');

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: 'old_hash'
      }];

      await authService.changePassword('user-1', 'oldPassword', 'newPassword');

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      mockUsers = [{
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User'
      }];

      await authService.sendPasswordResetEmail('test@example.com');

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should not throw error for non-existent email', async () => {
      mockUsers = [];

      // Should not throw - silently return for security
      await authService.sendPasswordResetEmail('nonexistent@example.com');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockSessions = [{
        id: 'session-1',
        user_id: 'user-1',
        refresh_token: 'valid-token',
        is_active: true,
        expires_at: new Date(Date.now() + 3600000).toISOString() // Valid for 1 hour
      }];
      mockUsers = [{ id: 'user-1' }];

      await authService.resetPassword('valid-token', 'newPassword123');

      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });
  });

  // ============================================
  // 2FA MANAGEMENT
  // ============================================

  describe('disable2FA', () => {
    it('should disable 2FA for user', async () => {
      mockUsers = [{
        id: 'user-1',
        two_factor_enabled: true
      }];

      await authService.disable2FA('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });
});
