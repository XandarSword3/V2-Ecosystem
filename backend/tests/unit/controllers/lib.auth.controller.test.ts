import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';
import { createAuthController } from '../../../src/lib/controllers/auth.controller';

describe('AuthController', () => {
  let mockAuthService: any;
  let mockActivityLogger: any;
  let controller: ReturnType<typeof createAuthController>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      refreshAccessToken: vi.fn(),
      getUserById: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      resetPassword: vi.fn(),
    };

    mockActivityLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    controller = createAuthController({
      authService: mockAuthService,
      activityLogger: mockActivityLogger,
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', fullName: 'Test User' };
      mockAuthService.register.mockResolvedValue(mockUser);

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should reject invalid email', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'invalid-email',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
      }));
    });

    it('should reject short password', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'short',
          fullName: 'Test User',
        },
      });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors with statusCode', async () => {
      mockAuthService.register.mockRejectedValue({
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
        statusCode: 409,
      });

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    });

    it('should pass unknown errors to next', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Unknown error'));

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockResult = { accessToken: 'token', user: { id: 'user-1' } };
      mockAuthService.login.mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      await controller.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should reject invalid credentials format', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          email: 'invalid',
          password: 'password123',
        },
      });

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
      }));
    });

    it('should handle login failure', async () => {
      mockAuthService.login.mockRejectedValue({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        statusCode: 401,
      });

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResult = { accessToken: 'new-token' };
      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: { refreshToken: 'valid-refresh-token' },
      });

      await controller.refreshToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should require refresh token', async () => {
      const { req, res, next } = createMockReqRes({
        body: {},
      });

      await controller.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token required',
        code: 'MISSING_TOKEN',
      });
    });

    it('should handle invalid refresh token', async () => {
      mockAuthService.refreshAccessToken.mockRejectedValue({
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
        statusCode: 401,
      });

      const { req, res, next } = createMockReqRes({
        body: { refreshToken: 'invalid-token' },
      });

      await controller.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      mockAuthService.getUserById.mockResolvedValue(mockUser);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'user' },
      });

      await controller.getCurrentUser(req, res, next);

      expect(mockAuthService.getUserById).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should handle user not found', async () => {
      mockAuthService.getUserById.mockRejectedValue({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        statusCode: 404,
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'non-existent', role: 'user' },
      });

      await controller.getCurrentUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'user', id: 'user-1' },
      });
      // Add headers with authorization
      (req as any).headers = { authorization: 'Bearer token123' };

      await controller.logout(req, res, next);

      expect(mockAuthService.logout).toHaveBeenCalledWith('token123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should handle logout without token', async () => {
      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'user', id: 'user-1' },
      });
      // Empty headers
      (req as any).headers = {};

      await controller.logout(req, res, next);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: {
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        },
        user: { userId: 'user-1', role: 'user' },
      });

      await controller.changePassword(req, res, next);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'oldpassword123',
        'newpassword123'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should reject short new password', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          currentPassword: 'oldpassword123',
          newPassword: 'short',
        },
        user: { userId: 'user-1', role: 'user' },
      });

      await controller.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle incorrect current password', async () => {
      mockAuthService.changePassword.mockRejectedValue({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
        statusCode: 400,
      });

      const { req, res, next } = createMockReqRes({
        body: {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        },
        user: { userId: 'user-1', role: 'user' },
      });

      await controller.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('forgotPassword', () => {
    it('should send reset email successfully', async () => {
      mockAuthService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: { email: 'test@example.com' },
      });

      await controller.forgotPassword(req, res, next);

      expect(mockAuthService.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    });

    it('should return success even for non-existent email (security)', async () => {
      mockAuthService.sendPasswordResetEmail.mockRejectedValue(new Error('User not found'));

      const { req, res, next } = createMockReqRes({
        body: { email: 'nonexistent@example.com' },
      });

      await controller.forgotPassword(req, res, next);

      // Should not reveal if email exists
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: {
          token: 'valid-reset-token',
          newPassword: 'newpassword123',
        },
      });

      await controller.resetPassword(req, res, next);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'newpassword123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
      });
    });

    it('should reject short new password', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          token: 'valid-reset-token',
          newPassword: 'short',
        },
      });

      await controller.resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle invalid reset token', async () => {
      mockAuthService.resetPassword.mockRejectedValue({
        code: 'INVALID_TOKEN',
        message: 'Reset token is invalid or expired',
        statusCode: 400,
      });

      const { req, res, next } = createMockReqRes({
        body: {
          token: 'invalid-token',
          newPassword: 'newpassword123',
        },
      });

      await controller.resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
