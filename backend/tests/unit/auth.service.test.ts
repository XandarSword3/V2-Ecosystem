/**
 * Auth Service Unit Tests
 * 
 * Comprehensive tests for AuthService with dependency injection.
 * Tests run completely in-memory - no database, no network calls.
 * 
 * REFACTORED: Now using the DI-based architecture with in-memory repository.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthService, AuthServiceError, AuthService } from '../../src/lib/services/auth.service.js';
import { createInMemoryAuthRepository, InMemoryAuthRepository } from '../../src/lib/repositories/auth.repository.memory.js';
import { createMockEmailService, createMockLogger, createMockActivityLogger, createTestConfig } from '../utils/test-helpers.js';
import type { EmailService, LoggerService, ActivityLoggerService, AppConfig, AuthUser, AuthRole } from '../../src/lib/container/types.js';

describe('AuthService', () => {
  let authService: AuthService;
  let authRepository: InMemoryAuthRepository;
  let mockEmailService: ReturnType<typeof createMockEmailService>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let config: AppConfig;

  // Test data builders
  function buildTestUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4P.ZHxNe4R1rE3Hy', // "password123"
      full_name: 'Test User',
      phone: '+1234567890',
      preferred_language: 'en',
      email_verified: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function buildTestRole(overrides: Partial<AuthRole> = {}): AuthRole {
    return {
      id: 'role-customer',
      name: 'customer',
      display_name: 'Customer',
      ...overrides,
    };
  }

  beforeEach(() => {
    // Create fresh instances for each test
    authRepository = createInMemoryAuthRepository();
    mockEmailService = createMockEmailService();
    mockLogger = createMockLogger();
    mockActivityLogger = createMockActivityLogger();
    config = createTestConfig();

    authService = createAuthService({
      authRepository,
      emailService: mockEmailService as unknown as EmailService,
      logger: mockLogger as unknown as LoggerService,
      activityLogger: mockActivityLogger as unknown as ActivityLoggerService,
      config,
    });

    // Add default customer role
    authRepository.addRole(buildTestRole());
  });

  // ============================================
  // REGISTRATION TESTS
  // ============================================

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
        phone: '+1234567890',
      });

      expect(result.user).toMatchObject({
        email: 'new@example.com',
        fullName: 'New User',
      });
      expect(result.user.id).toBeDefined();
    });

    it('should hash the password before storing', async () => {
      await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
      });

      const users = authRepository.getAllUsers();
      expect(users[0].password_hash).not.toBe('securepass123');
      expect(users[0].password_hash).toMatch(/^\$2[aby]?\$/); // bcrypt hash pattern
    });

    it('should normalize email to lowercase', async () => {
      const result = await authService.register({
        email: 'NEW@EXAMPLE.COM',
        password: 'securepass123',
        fullName: 'New User',
      });

      expect(result.user.email).toBe('new@example.com');
    });

    it('should assign customer role by default', async () => {
      const result = await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
      });

      const roles = await authRepository.getUserRoles(result.user.id);
      expect(roles).toContain('customer');
    });

    it('should throw if email already exists', async () => {
      authRepository.addUser(buildTestUser({ email: 'existing@example.com' }));

      await expect(authService.register({
        email: 'existing@example.com',
        password: 'securepass123',
        fullName: 'New User',
      })).rejects.toThrow(AuthServiceError);

      try {
        await authService.register({
          email: 'existing@example.com',
          password: 'securepass123',
          fullName: 'New User',
        });
      } catch (error) {
        expect((error as AuthServiceError).code).toBe('EMAIL_EXISTS');
        expect((error as AuthServiceError).statusCode).toBe(409);
      }
    });

    it('should log activity after registration', async () => {
      await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
      });

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'REGISTER',
        expect.objectContaining({ email: 'new@example.com' }),
        expect.any(String)
      );
    });

    it('should use default language if not specified', async () => {
      await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
      });

      const users = authRepository.getAllUsers();
      expect(users[0].preferred_language).toBe('en');
    });

    it('should respect specified language preference', async () => {
      await authService.register({
        email: 'new@example.com',
        password: 'securepass123',
        fullName: 'New User',
        preferredLanguage: 'ar',
      });

      const users = authRepository.getAllUsers();
      expect(users[0].preferred_language).toBe('ar');
    });
  });

  // ============================================
  // LOGIN TESTS
  // ============================================

  describe('login', () => {
    beforeEach(async () => {
      authRepository.addRole(buildTestRole({ id: 'role-admin', name: 'admin', display_name: 'Admin' }));
    });

    it('should login with valid credentials', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      const result = await authService.login({
        email: 'login@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('login@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should return user roles', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      const result = await authService.login({
        email: 'login@example.com',
        password: 'password123',
      });

      expect(result.user.roles).toContain('customer');
    });

    it('should create a session on login', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      await authService.login({
        email: 'login@example.com',
        password: 'password123',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
      });

      const sessions = authRepository.getAllSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].ip_address).toBe('192.168.1.1');
      expect(sessions[0].user_agent).toBe('Test Browser');
    });

    it('should update last_login_at', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      const beforeLogin = new Date();
      await authService.login({
        email: 'login@example.com',
        password: 'password123',
      });

      const users = authRepository.getAllUsers();
      const loginUser = users.find(u => u.email === 'login@example.com');
      expect(new Date(loginUser!.last_login_at!).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should throw for invalid email', async () => {
      await expect(authService.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      })).rejects.toThrow(AuthServiceError);

      try {
        await authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        });
      } catch (error) {
        expect((error as AuthServiceError).code).toBe('INVALID_CREDENTIALS');
        expect((error as AuthServiceError).statusCode).toBe(401);
      }
    });

    it('should throw for invalid password', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      await expect(authService.login({
        email: 'login@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow(AuthServiceError);
    });

    it('should throw for disabled account', async () => {
      authRepository.addUser(buildTestUser({
        id: 'disabled-user',
        email: 'disabled@example.com',
        is_active: false,
      }));

      await expect(authService.login({
        email: 'disabled@example.com',
        password: 'password123',
      })).rejects.toThrow(AuthServiceError);

      try {
        await authService.login({
          email: 'disabled@example.com',
          password: 'password123',
        });
      } catch (error) {
        expect((error as AuthServiceError).code).toBe('ACCOUNT_DISABLED');
        expect((error as AuthServiceError).statusCode).toBe(403);
      }
    });

    it('should log activity on login', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });

      await authService.login({
        email: 'login@example.com',
        password: 'password123',
        ipAddress: '192.168.1.1',
      });

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'LOGIN',
        expect.objectContaining({ ipAddress: '192.168.1.1' }),
        expect.any(String)
      );
    });
  });

  // ============================================
  // TOKEN TESTS
  // ============================================

  describe('token operations', () => {
    it('should generate valid access token', () => {
      const tokens = authService.generateTokens({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      });

      const decoded = authService.verifyToken(tokens.accessToken);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toContain('customer');
    });

    it('should generate valid refresh token', () => {
      const tokens = authService.generateTokens({
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      });

      const decoded = authService.verifyRefreshToken(tokens.refreshToken);
      expect(decoded.userId).toBe('user-123');
    });

    it('should throw for invalid access token', () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow();
    });

    it('should throw for invalid refresh token', () => {
      expect(() => authService.verifyRefreshToken('invalid-token')).toThrow();
    });
  });

  // ============================================
  // REFRESH TOKEN TESTS
  // ============================================

  describe('refreshAccessToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      await authService.register({
        email: 'refresh@example.com',
        password: 'password123',
        fullName: 'Refresh User',
      });

      const loginResult = await authService.login({
        email: 'refresh@example.com',
        password: 'password123',
      });

      const result = await authService.refreshAccessToken(loginResult.tokens.refreshToken);

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      // Both tokens should be valid JWTs
      expect(result.tokens.accessToken).toMatch(/^eyJ/);
      expect(result.tokens.refreshToken).toMatch(/^eyJ/);
    });

    it('should throw for invalid refresh token', async () => {
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow();
    });

    it('should throw for inactive session', async () => {
      await authService.register({
        email: 'expired@example.com',
        password: 'password123',
        fullName: 'Expired User',
      });

      const loginResult = await authService.login({
        email: 'expired@example.com',
        password: 'password123',
      });

      // Invalidate the session
      const sessions = authRepository.getAllSessions();
      const session = sessions[0];
      await authRepository.updateSession(session.id, {
        is_active: false,
      });

      await expect(authService.refreshAccessToken(loginResult.tokens.refreshToken))
        .rejects.toThrow(AuthServiceError);
    });
  });

  // ============================================
  // LOGOUT TESTS
  // ============================================

  describe('logout', () => {
    it('should invalidate session on logout', async () => {
      await authService.register({
        email: 'logout@example.com',
        password: 'password123',
        fullName: 'Logout User',
      });

      const loginResult = await authService.login({
        email: 'logout@example.com',
        password: 'password123',
      });

      await authService.logout(loginResult.tokens.accessToken);

      // Session should be invalidated
      const session = await authRepository.getSessionByToken(loginResult.tokens.accessToken);
      expect(session).toBeNull();
    });
  });

  // ============================================
  // GET USER TESTS
  // ============================================

  describe('getUserById', () => {
    it('should return user with roles', async () => {
      await authService.register({
        email: 'getuser@example.com',
        password: 'password123',
        fullName: 'Get User',
      });

      const users = authRepository.getAllUsers();
      const result = await authService.getUserById(users[0].id);

      expect(result.email).toBe('getuser@example.com');
      expect(result.roles).toContain('customer');
    });

    it('should throw for non-existent user', async () => {
      await expect(authService.getUserById('non-existent'))
        .rejects.toThrow(AuthServiceError);

      try {
        await authService.getUserById('non-existent');
      } catch (error) {
        expect((error as AuthServiceError).code).toBe('USER_NOT_FOUND');
        expect((error as AuthServiceError).statusCode).toBe(404);
      }
    });
  });

  // ============================================
  // CHANGE PASSWORD TESTS
  // ============================================

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      await authService.register({
        email: 'changepass@example.com',
        password: 'oldpassword123',
        fullName: 'Change Password User',
      });

      const users = authRepository.getAllUsers();
      await authService.changePassword(users[0].id, 'oldpassword123', 'newpassword456');

      // Should be able to login with new password
      const result = await authService.login({
        email: 'changepass@example.com',
        password: 'newpassword456',
      });
      expect(result.user.email).toBe('changepass@example.com');
    });

    it('should throw for incorrect current password', async () => {
      await authService.register({
        email: 'changepass@example.com',
        password: 'oldpassword123',
        fullName: 'Change Password User',
      });

      const users = authRepository.getAllUsers();
      await expect(authService.changePassword(users[0].id, 'wrongpassword', 'newpassword456'))
        .rejects.toThrow(AuthServiceError);
    });

    it('should invalidate all sessions after password change', async () => {
      await authService.register({
        email: 'changepass@example.com',
        password: 'oldpassword123',
        fullName: 'Change Password User',
      });

      const loginResult = await authService.login({
        email: 'changepass@example.com',
        password: 'oldpassword123',
      });

      const users = authRepository.getAllUsers();
      await authService.changePassword(users[0].id, 'oldpassword123', 'newpassword456');

      // Old session should be invalidated
      const session = await authRepository.getSessionByToken(loginResult.tokens.accessToken);
      expect(session).toBeNull();
    });

    it('should log activity after password change', async () => {
      await authService.register({
        email: 'changepass@example.com',
        password: 'oldpassword123',
        fullName: 'Change Password User',
      });

      const users = authRepository.getAllUsers();
      await authService.changePassword(users[0].id, 'oldpassword123', 'newpassword456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CHANGE_PASSWORD',
        {},
        users[0].id
      );
    });
  });

  // ============================================
  // PASSWORD RESET TESTS
  // ============================================

  describe('sendPasswordResetEmail', () => {
    it('should send reset email for existing user', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'password123',
        fullName: 'Reset User',
      });

      await authService.sendPasswordResetEmail('reset@example.com');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'reset@example.com',
          subject: expect.stringContaining('Reset Your Password'),
        })
      );
    });

    it('should not reveal if email does not exist', async () => {
      // Should not throw for non-existent email
      await expect(authService.sendPasswordResetEmail('nonexistent@example.com'))
        .resolves.toBeUndefined();

      // Should not send email
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should create a session to store reset token', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'password123',
        fullName: 'Reset User',
      });

      await authService.sendPasswordResetEmail('reset@example.com');

      const sessions = authRepository.getAllSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'oldpassword123',
        fullName: 'Reset User',
      });

      await authService.sendPasswordResetEmail('reset@example.com');

      // Get the reset token from the session
      const sessions = authRepository.getAllSessions();
      const resetToken = sessions[0].refresh_token;

      await authService.resetPassword(resetToken, 'newpassword456');

      // Should be able to login with new password
      const result = await authService.login({
        email: 'reset@example.com',
        password: 'newpassword456',
      });
      expect(result.user.email).toBe('reset@example.com');
    });

    it('should throw for invalid token', async () => {
      await expect(authService.resetPassword('invalid-token', 'newpassword'))
        .rejects.toThrow(AuthServiceError);

      try {
        await authService.resetPassword('invalid-token', 'newpassword');
      } catch (error) {
        expect((error as AuthServiceError).code).toBe('INVALID_RESET_TOKEN');
      }
    });

    it('should delete reset token after use', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'oldpassword123',
        fullName: 'Reset User',
      });

      await authService.sendPasswordResetEmail('reset@example.com');

      const sessions = authRepository.getAllSessions();
      const resetToken = sessions[0].refresh_token;

      await authService.resetPassword(resetToken, 'newpassword456');

      // Token should no longer work
      await expect(authService.resetPassword(resetToken, 'anotherpassword'))
        .rejects.toThrow(AuthServiceError);
    });

    it('should log activity after password reset', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'oldpassword123',
        fullName: 'Reset User',
      });

      await authService.sendPasswordResetEmail('reset@example.com');

      const sessions = authRepository.getAllSessions();
      const resetToken = sessions[0].refresh_token;

      await authService.resetPassword(resetToken, 'newpassword456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'RESET_PASSWORD',
        {},
        expect.any(String)
      );
    });
  });
});
