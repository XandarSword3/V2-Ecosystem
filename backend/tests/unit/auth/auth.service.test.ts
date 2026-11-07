/// <reference types="vitest/globals" />

/**
 * Auth Service Unit Tests (De-mocked & Verified)
 *
 * Replaces fragile sequential mock queues and tautological stubs with:
 * 1. createStatefulDbHarness: Real in-memory Supabase querying and table mutations.
 * 2. Real Password Policy Service: Genuine validation for length, cases, numbers, specials.
 * 3. Real Account Lockout Service: Genuine progressive tracking, 5-attempt lockout, and cache clearing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStatefulDbHarness } from '../../helpers/stateful-db-harness';

// ── In-Memory Cache & Email Spies ─────────────────────────────────────────────
const { mockCache, mockSendEmail } = vi.hoisted(() => ({
  mockCache: new Map<string, any>(),
  mockSendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../src/utils/cache', () => ({
  cache: {
    get: vi.fn(async (key: string) => mockCache.get(key) || null),
    set: vi.fn(async (key: string, val: any) => {
      mockCache.set(key, val);
    }),
    del: vi.fn(async (key: string) => {
      mockCache.delete(key);
    }),
  },
}));

vi.mock('../../../src/utils/cache.js', () => ({
  cache: {
    get: vi.fn(async (key: string) => mockCache.get(key) || null),
    set: vi.fn(async (key: string, val: any) => {
      mockCache.set(key, val);
    }),
    del: vi.fn(async (key: string) => {
      mockCache.delete(key);
    }),
  },
}));

// ── Config ───────────────────────────────────────────────────────────────────
vi.mock('../../../src/config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-32-chars-minimum-ok',
      refreshSecret: 'ref-secret-32-chars-minimum-ok!',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    frontendUrl: 'http://localhost:3000',
  },
}));

// ── Logger ───────────────────────────────────────────────────────────────────
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Email ─────────────────────────────────────────────────────────────────────
vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
    sendPasswordReset: (...args: unknown[]) => mockSendEmail(...args),
    sendWelcome: (...args: unknown[]) => mockSendEmail(...args),
  },
}));

// ── Lockout Service: Genuine implementation with zero wall-clock delay ─────────
vi.mock('../../../src/modules/auth/lockout.service.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    applyProgressiveDelay: vi.fn().mockResolvedValue(undefined),
    verifyCaptchaToken: vi.fn().mockImplementation(async (token?: string) => Boolean(token)),
  };
});

// ── Token blacklist ───────────────────────────────────────────────────────────
vi.mock('../../../src/services/token-blacklist.service.js', () => ({
  blacklistToken: vi.fn().mockResolvedValue(undefined),
}));

// ── Database Harness ──────────────────────────────────────────────────────────
const harness = createStatefulDbHarness();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => harness.supabase,
}));

// ── bcryptjs — deterministic in tests ────────────────────────────────────────
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashed_password'),
    compare: vi.fn().mockImplementation(async (plain: string, hash: string) => {
      if (plain === 'wrongpass' || plain === 'wrong') return false;
      if (plain === 'NewPass456!') return false; // Not matching old password
      return true;
    }),
  },
  hash: vi.fn().mockResolvedValue('$2a$12$hashed_password'),
  compare: vi.fn().mockImplementation(async (plain: string, hash: string) => {
    if (plain === 'wrongpass' || plain === 'wrong') return false;
    if (plain === 'NewPass456!') return false; // Not matching old password
    return true;
  }),
}));

import * as authService from '../../../src/modules/auth/auth.service.js';
import bcrypt from 'bcryptjs';

const TENANT_ID = 'tenant-00000000-0000-0000-0000-000000000001';

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  password_hash: '$2a$12$hashed_password',
  full_name: 'Test User',
  is_active: true,
  email_verified: true,
  two_factor_enabled: false,
  scope: 'customer',
  token_version: 0,
  last_login_at: null,
  profile_image_url: null,
  preferred_language: 'en',
  tenant_id: TENANT_ID,
};

describe('AuthService (De-mocked & Stateful DB Verification)', () => {
  beforeEach(() => {
    harness.clear();
    mockCache.clear();
    vi.clearAllMocks();

    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$12$hashed_password' as never);
    vi.mocked(bcrypt.compare).mockImplementation(async (plain: string) => {
      if (plain === 'wrongpass' || plain === 'wrong') return false;
      if (plain.startsWith('NewPass')) return false; // not matching old password
      return true;
    });

    harness.seed('tenants', [
      { id: TENANT_ID, name: 'Main Resort', subdomain: 'resort', is_active: true },
    ]);
    harness.seed('properties', [
      { id: 'prop-1', tenant_id: TENANT_ID, name: 'Ocean Front' },
    ]);
    harness.seed('roles', [
      { id: 'role-customer', name: 'customer' },
      { id: 'role-superadmin', name: 'super_admin' },
    ]);
  });

  // ============================================
  // 1. REGISTER
  // ============================================
  describe('register', () => {
    it('creates user and returns user object (no tokens; email verification required first)', async () => {
      const result = await authService.register({
        email: 'new@example.com',
        password: 'Password123!',
        fullName: 'New User',
        tenantId: TENANT_ID,
      });

      expect(result.user.email).toBe('new@example.com');
      expect((result as any).tokens).toBeUndefined();

      // State verification: check users table mutation
      const users = harness.getTable('users');
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('new@example.com');
      expect(users[0].email_verified).toBe(false);

      // Password history recorded
      const history = harness.getTable('password_history');
      expect(history).toHaveLength(1);
      expect(history[0].user_id).toBe(users[0].id);

      // Property access granted
      const access = harness.getTable('user_property_access');
      expect(access).toHaveLength(1);
      expect(access[0].property_id).toBe('prop-1');
    });

    it('hashes the password before storing', async () => {
      await authService.register({
        email: 'x@x.com',
        password: 'Password123!',
        fullName: 'X',
        tenantId: TENANT_ID,
      });

      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('Password123!', 12);
      const users = harness.getTable('users');
      expect(users[0].password_hash).toBe('$2a$12$hashed_password');
    });

    it('lowercases the email', async () => {
      const result = await authService.register({
        email: 'UPPER@EXAMPLE.COM',
        password: 'Password123!',
        fullName: 'Upper',
        tenantId: TENANT_ID,
      });

      expect(result.user.email).toBe('upper@example.com');
      const users = harness.getTable('users');
      expect(users[0].email).toBe('upper@example.com');
    });

    it('throws when email already exists', async () => {
      harness.seed('users', [{ ...baseUser, email: 'taken@example.com' }]);

      await expect(
        authService.register({
          email: 'taken@example.com',
          password: 'Password123!',
          fullName: 'X',
          tenantId: TENANT_ID,
        })
      ).rejects.toThrow('Email already registered');
    });

    it('throws when password policy fails (genuine password policy evaluation)', async () => {
      await expect(
        authService.register({
          email: 'new@example.com',
          password: 'weak',
          fullName: 'X',
          tenantId: TENANT_ID,
        })
      ).rejects.toThrow('Password does not meet policy');
    });
  });

  // ============================================
  // 2. LOGIN
  // ============================================
  describe('login', () => {
    it('returns user and tokens on valid credentials and updates last_login_at', async () => {
      harness.seed('users', [{ ...baseUser }]);

      const result = await authService.login('user@example.com', 'Password123!', {
        ipAddress: '192.168.1.1',
        userAgent: 'TestBrowser',
      }, TENANT_ID);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect((result as any).user.email).toBe('user@example.com');

      // State verification: check sessions table mutation
      const sessions = harness.getTable('sessions');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].user_id).toBe('user-1');
      expect(sessions[0].ip_address).toBe('192.168.1.1');

      // State verification: check user last_login_at update
      const users = harness.getTable('users');
      expect(users[0].last_login_at).toBeDefined();
    });

    it('throws INVALID_CREDENTIALS when user not found', async () => {
      await expect(authService.login('ghost@x.com', 'pass', {}, TENANT_ID)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('throws ACCOUNT_DISABLED for inactive account', async () => {
      harness.seed('users', [{ ...baseUser, is_active: false }]);

      await expect(authService.login('user@example.com', 'pass', {}, TENANT_ID)).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
    });

    it('locks account after 5 consecutive failed attempts (genuine lockout logic)', async () => {
      harness.seed('users', [{ ...baseUser }]);

      // 5 consecutive wrong password attempts (supplying valid captcha token for attempts 4 & 5)
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login('user@example.com', 'wrongpass', { captchaToken: 'valid-token' }, TENANT_ID)
        ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }

      // The 6th attempt is blocked by real lockout before password check
      await expect(
        authService.login('user@example.com', 'Password123!', {}, TENANT_ID)
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
      });
    });

    it('enforces CAPTCHA after 3 failed login attempts', async () => {
      harness.seed('users', [{ ...baseUser }]);

      for (let i = 0; i < 3; i++) {
        await expect(
          authService.login('user@example.com', 'wrongpass', {}, TENANT_ID)
        ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }

      // 4th attempt without captcha token is rejected with CAPTCHA_REQUIRED
      await expect(
        authService.login('user@example.com', 'wrongpass', {}, TENANT_ID)
      ).rejects.toMatchObject({ code: 'CAPTCHA_REQUIRED' });
    });

    it('throws INVALID_CREDENTIALS on wrong password and increments failed attempts', async () => {
      harness.seed('users', [{ ...baseUser }]);

      await expect(
        authService.login('user@example.com', 'wrongpass', {}, TENANT_ID)
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

      // Cache state verification: failed attempts recorded
      const cached = mockCache.get('lockout:user@example.com');
      expect(cached).toBeDefined();
      expect(cached.failedAttempts).toBe(1);
    });

    it('throws EMAIL_NOT_VERIFIED when email not verified', async () => {
      harness.seed('users', [{ ...baseUser, email_verified: false }]);

      await expect(
        authService.login('user@example.com', 'Password123!', {}, TENANT_ID)
      ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    });

    it('returns requiresTwoFactor when 2FA is enabled', async () => {
      harness.seed('users', [{ ...baseUser, two_factor_enabled: true }]);

      const result = await authService.login('user@example.com', 'Password123!', {}, TENANT_ID);
      expect((result as any).requiresTwoFactor).toBe(true);
      expect((result as any).userId).toBe('user-1');
    });

    it('clears lockout on successful login', async () => {
      harness.seed('users', [{ ...baseUser }]);

      // 2 failed attempts
      await expect(authService.login('user@example.com', 'wrongpass', {}, TENANT_ID)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      await expect(authService.login('user@example.com', 'wrongpass', {}, TENANT_ID)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(mockCache.get('lockout:user@example.com')?.failedAttempts).toBe(2);

      // Successful login clears lockout info
      await authService.login('user@example.com', 'Password123!', {}, TENANT_ID);
      expect(mockCache.get('lockout:user@example.com')).toBeUndefined();
    });

    it('returns requiresTwoFactorSetup when 2FA is not enabled for super_admin or tenant_admin', async () => {
      harness.seed('users', [{
        ...baseUser,
        two_factor_enabled: false,
        scope: 'super_admin',
        tenant_id: null,
      }]);

      const result = await authService.login('user@example.com', 'Password123!', {});
      expect((result as any).requiresTwoFactorSetup).toBe(true);
      expect((result as any).message).toContain('Two-factor authentication is mandatory');
    });
  });

  // ============================================
  // 3. CHANGE PASSWORD
  // ============================================
  describe('changePassword', () => {
    it('updates password and logs out active sessions when current password matches', async () => {
      harness.seed('users', [{ ...baseUser }]);
      harness.seed('sessions', [
        { id: 'sess-1', user_id: 'user-1', is_active: true },
        { id: 'sess-2', user_id: 'user-1', is_active: true },
      ]);

      await expect(
        authService.changePassword('user-1', 'Password123!', 'NewPass456!')
      ).resolves.toBeUndefined();

      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('NewPass456!', 12);

      // State verification: check password update and session termination
      const users = harness.getTable('users');
      expect(users[0].password_hash).toBe('$2a$12$hashed_password');

      const sessions = harness.getTable('sessions');
      expect(sessions.every((s) => s.is_active === false)).toBe(true);
    });

    it('throws INVALID_CREDENTIALS when current password is wrong', async () => {
      harness.seed('users', [{ ...baseUser }]);

      await expect(
        authService.changePassword('user-1', 'wrong', 'NewPass456!')
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws when new password fails policy (genuine policy check)', async () => {
      harness.seed('users', [{ ...baseUser }]);

      await expect(
        authService.changePassword('user-1', 'Password123!', 'weak')
      ).rejects.toMatchObject({ code: 'PASSWORD_POLICY_VIOLATION' });
    });
  });

  // ============================================
  // 4. PASSWORD RESET
  // ============================================
  describe('sendPasswordResetEmail', () => {
    it('sends reset email for existing user and persists reset session', async () => {
      harness.seed('users', [{ ...baseUser }]);

      await authService.sendPasswordResetEmail('user@example.com', TENANT_ID);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', subject: expect.stringContaining('Reset') })
      );

      const sessions = harness.getTable('sessions');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].user_id).toBe('user-1');
      expect(sessions[0].session_type).toBe('password_reset');
    });

    it('returns silently for non-existent email', async () => {
      await expect(authService.sendPasswordResetEmail('ghost@x.com')).resolves.toBeUndefined();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws INVALID_TOKEN for bad token', async () => {
      await expect(authService.resetPassword('bad-token', 'NewPass123!')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('throws TOKEN_EXPIRED for expired token', async () => {
      harness.seed('sessions', [
        {
          id: 'sess-1',
          user_id: 'user-1',
          refresh_token: 'tok-expired',
          is_active: true,
          session_type: 'password_reset',
          expires_at: new Date(Date.now() - 60000).toISOString(),
        },
      ]);

      await expect(authService.resetPassword('tok-expired', 'NewPass123!')).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
      });
    });

    it('updates password with valid token and cleans up reset session', async () => {
      harness.seed('users', [{ ...baseUser }]);
      harness.seed('sessions', [
        {
          id: 'reset-sess',
          user_id: 'user-1',
          refresh_token: 'valid-tok',
          is_active: true,
          session_type: 'password_reset',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ]);

      const result = await authService.resetPassword('valid-tok', 'NewPass123!');
      expect((result as any).user_id).toBe('user-1');
      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('NewPass123!', 12);

      // State verification: reset session deleted
      const sessions = harness.getTable('sessions');
      expect(sessions.find((s) => s.id === 'reset-sess')).toBeUndefined();
    });
  });

  // ============================================
  // 5. CURRENT USER
  // ============================================
  describe('getCurrentUser', () => {
    it('returns user with roles derived from scope', async () => {
      harness.seed('users', [{ ...baseUser, scope: 'customer' }]);

      const user = await authService.getCurrentUser('user-1');
      expect(user.email).toBe('user@example.com');
      expect(user.roles).toContain('customer');
    });

    it('throws USER_NOT_FOUND for missing user', async () => {
      await expect(authService.getCurrentUser('ghost')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });
});
