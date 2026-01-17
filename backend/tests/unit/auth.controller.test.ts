/**
 * Auth Controller Unit Tests
 * 
 * Comprehensive tests for auth.controller.ts HTTP handlers.
 * Tests all authentication endpoints: register, login, logout, 
 * refresh token, change password, forgot/reset password.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockReqRes, createChainableMock } from './utils.js';

// Mock dependencies before importing controller
vi.mock('../../src/modules/auth/auth.service.js', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshAccessToken: vi.fn(),
  getUserById: vi.fn(),
  changePassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../src/modules/auth/auth.validation.js', () => ({
  loginSchema: {
    parse: vi.fn((data) => data),
  },
  registerSchema: {
    parse: vi.fn((data) => data),
  },
  changePasswordSchema: {
    parse: vi.fn((data) => data),
  },
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

vi.mock('../../src/config/index.js', () => ({
  config: {
    env: 'test',
  },
}));

describe('Auth Controller', () => {
  let authService: typeof import('../../src/modules/auth/auth.service.js');
  let logActivity: typeof import('../../src/utils/activityLogger.js').logActivity;

  beforeEach(async () => {
    vi.clearAllMocks();
    authService = await import('../../src/modules/auth/auth.service.js');
    const activityLogger = await import('../../src/utils/activityLogger.js');
    logActivity = activityLogger.logActivity;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // REGISTER TESTS
  // ============================================

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        fullName: 'New User',
      };

      vi.mocked(authService.register).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      } as any);

      const { register } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'newuser@example.com',
          password: 'securePassword123',
          fullName: 'New User',
        },
      });

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          user: mockUser,
        }),
      });
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'REGISTER',
        resource: 'auth',
      }));
    });

    it('should handle registration failure with 500 error', async () => {
      vi.mocked(authService.register).mockRejectedValue(new Error('Email already exists'));

      const { register } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'existing@example.com',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should include error message in development mode', async () => {
      vi.mocked(authService.register).mockRejectedValue(new Error('Detailed error'));

      const { register } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { email: 'test@test.com', password: 'pass', fullName: 'Test' },
      });

      await register(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Detailed error'),
      }));
    });
  });

  // ============================================
  // LOGIN TESTS
  // ============================================

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockResult = {
        user: { id: 'user-123', email: 'user@example.com' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      vi.mocked(authService.login).mockResolvedValue(mockResult as any);

      const { login } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'user@example.com',
          password: 'correctPassword',
        },
      });
      // Set up IP and user agent
      req.ip = '127.0.0.1';
      vi.mocked(req.get).mockImplementation((header: string) => {
        if (header === 'user-agent') return 'TestBrowser/1.0';
        return undefined;
      });

      await login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
      expect(authService.login).toHaveBeenCalledWith(
        'user@example.com',
        'correctPassword',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'TestBrowser/1.0',
        }
      );
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'LOGIN',
        resource: 'auth',
      }));
    });

    it('should call next with error on login failure', async () => {
      const loginError = new Error('Invalid credentials');
      vi.mocked(authService.login).mockRejectedValue(loginError);

      const { login } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'user@example.com',
          password: 'wrongPassword',
        },
      });

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(loginError);
    });

    it('should pass IP address and user agent to login service', async () => {
      const mockResult = {
        user: { id: 'user-123' },
        accessToken: 'token',
        refreshToken: 'refresh',
      };
      vi.mocked(authService.login).mockResolvedValue(mockResult as any);

      const { login } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { email: 'test@test.com', password: 'pass' },
      });
      req.ip = '192.168.1.1';
      req.get = vi.fn().mockReturnValue('Mozilla/5.0');

      await login(req, res, next);

      expect(authService.login).toHaveBeenCalledWith(
        'test@test.com',
        'pass',
        { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      );
    });
  });

  // ============================================
  // REFRESH TOKEN TESTS
  // ============================================

  describe('refreshToken', () => {
    it('should refresh access token successfully', async () => {
      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      vi.mocked(authService.refreshAccessToken).mockResolvedValue(mockResult);

      const { refreshToken } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { refreshToken: 'valid-refresh-token' },
      });

      await refreshToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should return 400 if refresh token is missing', async () => {
      const { refreshToken } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {},
      });

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token required',
      });
    });

    it('should call next with error on refresh failure', async () => {
      const refreshError = new Error('Invalid refresh token');
      vi.mocked(authService.refreshAccessToken).mockRejectedValue(refreshError);

      const { refreshToken } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { refreshToken: 'invalid-token' },
      });

      await refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(refreshError);
    });
  });

  // ============================================
  // GET CURRENT USER TESTS
  // ============================================

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        fullName: 'Test User',
        roles: ['customer'],
      };
      vi.mocked(authService.getUserById).mockResolvedValue(mockUser as any);

      const { getCurrentUser } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'user-123', role: 'customer' };

      await getCurrentUser(req, res, next);

      expect(authService.getUserById).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should call next with error if user not found', async () => {
      const notFoundError = new Error('User not found');
      vi.mocked(authService.getUserById).mockRejectedValue(notFoundError);

      const { getCurrentUser } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'nonexistent-123', role: 'customer' };

      await getCurrentUser(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
    });
  });

  // ============================================
  // LOGOUT TESTS
  // ============================================

  describe('logout', () => {
    it('should logout user successfully', async () => {
      vi.mocked(authService.logout).mockResolvedValue(undefined);

      const { logout } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes();
      req.headers = { authorization: 'Bearer valid-token' };
      req.user = { userId: 'user-123', role: 'customer' };

      await logout(req, res, next);

      expect(authService.logout).toHaveBeenCalledWith('valid-token');
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'LOGOUT',
        resource: 'auth',
      }));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should succeed even without authorization header', async () => {
      const { logout } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes();
      req.headers = {};
      req.user = { userId: 'user-123', role: 'customer' };

      await logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should call next with error if logout fails', async () => {
      const logoutError = new Error('Logout failed');
      vi.mocked(authService.logout).mockRejectedValue(logoutError);

      const { logout } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes();
      req.headers = { authorization: 'Bearer token' };
      req.user = { userId: 'user-123', role: 'customer' };

      await logout(req, res, next);

      expect(next).toHaveBeenCalledWith(logoutError);
    });
  });

  // ============================================
  // CHANGE PASSWORD TESTS
  // ============================================

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue(undefined);

      const { changePassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          currentPassword: 'oldPassword123',
          newPassword: 'newSecurePassword456',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await changePassword(req, res, next);

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-123',
        'oldPassword123',
        'newSecurePassword456'
      );
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'CHANGE_PASSWORD',
        resource: 'auth',
      }));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should call next with error if current password is wrong', async () => {
      const wrongPasswordError = new Error('Current password is incorrect');
      vi.mocked(authService.changePassword).mockRejectedValue(wrongPasswordError);

      const { changePassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(wrongPasswordError);
    });
  });

  // ============================================
  // FORGOT PASSWORD TESTS
  // ============================================

  describe('forgotPassword', () => {
    it('should send reset email and return success message', async () => {
      vi.mocked(authService.sendPasswordResetEmail).mockResolvedValue(undefined);

      const { forgotPassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { email: 'user@example.com' },
      });

      await forgotPassword(req, res, next);

      expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    });

    it('should return same message even if email does not exist (security)', async () => {
      vi.mocked(authService.sendPasswordResetEmail).mockRejectedValue(
        new Error('User not found')
      );

      const { forgotPassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: { email: 'nonexistent@example.com' },
      });

      await forgotPassword(req, res, next);

      // Should NOT reveal whether email exists
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    });
  });

  // ============================================
  // RESET PASSWORD TESTS
  // ============================================

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue({ user_id: 'user-123' } as any);

      const { resetPassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          token: 'valid-reset-token',
          newPassword: 'newSecurePassword123',
        },
      });

      await resetPassword(req, res, next);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'newSecurePassword123'
      );
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RESET_PASSWORD',
        resource: 'auth',
      }));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
      });
    });

    it('should call next with error for invalid reset token', async () => {
      const invalidTokenError = new Error('Invalid or expired reset token');
      vi.mocked(authService.resetPassword).mockRejectedValue(invalidTokenError);

      const { resetPassword } = await import('../../src/modules/auth/auth.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          token: 'invalid-token',
          newPassword: 'newPassword123',
        },
      });

      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(invalidTokenError);
    });
  });
});
