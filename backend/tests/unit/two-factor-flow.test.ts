/**
 * 2FA Login Flow Regression Tests
 *
 * These tests verify the complete 2FA authentication flow as described in
 * the F2 authorization certification. They cover:
 *
 * 1. Login with 2FA-enabled user → requiresTwoFactor response (no tokens)
 * 2. Mandatory 2FA setup for privileged accounts without 2FA
 * 3. Already-enrolled privileged user gets requiresTwoFactor, NOT requiresTwoFactorSetup
 * 4. completeLoginAfter2FA issues tokens and session
 *
 * SECURITY INVARIANT: No access token or session is ever issued until the
 * TOTP/backup code is verified. The requiresTwoFactor response must NEVER
 * include a tokens payload.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock data stores ────────────────────────────────────────────────────

let mockUsers: Array<Record<string, unknown>> = [];
let mockSessions: Array<Record<string, unknown>> = [];

// Create a chainable query mock (same pattern as existing auth.service.test.ts)
function createQueryMock(getData: () => unknown[]) {
  const chain: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in'];
  chainMethods.forEach(method => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  chain.single = vi.fn().mockImplementation(() => {
    const data = getData();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116', message: 'Not found' } });
  });

  chain.maybeSingle = vi.fn().mockImplementation(() => {
    const data = getData();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });

  chain.insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
    }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
      resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  });

  chain.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });

  chain.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });

  chain.upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
      resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  });

  chain.then = function (resolve: (v: { data: unknown; error: unknown }) => void) {
    const data = getData();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };

  return chain;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'users':
        return createQueryMock(() => mockUsers);
      case 'sessions':
        return createQueryMock(() => mockSessions);
      default:
        return createQueryMock(() => []);
    }
  }),
};

// ── Module mocks ────────────────────────────────────────────────────────

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../src/database/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
  getSupabaseAdmin: vi.fn(() => mockSupabase),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(async (plain: string, _hash: string) => plain === 'correct-password'),
    hash: vi.fn(async (plain: string) => 'hashed-' + plain),
  },
}));

vi.mock('../../src/modules/auth/auth.utils.js', () => ({
  generateTokens: vi.fn().mockReturnValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
  }),
  verifyRefreshToken: vi.fn().mockReturnValue({ userId: 'user-1', tokenVersion: 0 }),
  scopeToRoles: vi.fn((scope: string) => {
    const map: Record<string, string[]> = {
      super_admin: ['super_admin'],
      tenant_admin: ['admin'],
      property_staff: ['staff'],
      customer: ['customer'],
    };
    return map[scope] || [scope];
  }),
  scopeIsPlatformAdmin: vi.fn((scope: string) => scope === 'platform_admin' || scope === 'super_admin'),
  generateTwoFactorSetupToken: vi.fn().mockReturnValue({ token: 'mock-setup-token' }),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    jwt: { accessTokenSecret: 'test-secret', refreshTokenSecret: 'test-refresh', accessTokenExpiry: '15m', refreshTokenExpiry: '7d' },
    redis: { url: 'redis://localhost:6379' },
    frontend: { url: 'http://localhost:3000' },
    turnstile: { secretKey: '' },
    email: { from: 'test@test.com' },
    database: { url: 'postgres://test' },
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue(true) },
}));

vi.mock('../../src/services/password-policy.service.js', () => ({
  validatePassword: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('../../src/middleware/rateLimiter.js', () => ({
  applyProgressiveDelay: vi.fn().mockResolvedValue(undefined),
  recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
  recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ───────────────────────────────────────────────────────────────

describe('2FA Login Flow Regression', () => {
  beforeEach(() => {
    mockUsers.length = 0;
    mockSessions.length = 0;
    vi.clearAllMocks();
  });

  describe('Login with 2FA-enabled user', () => {
    it('returns requiresTwoFactor WITHOUT tokens when user has 2FA enabled', async () => {
      mockUsers.push({
        id: 'user-2fa',
        email: '2fa@example.com',
        password_hash: 'correct-password',
        is_active: true,
        email_verified: true,
        two_factor_enabled: true,
        token_version: 0,
        scope: 'customer',
      });

      const authService = await import('../../src/modules/auth/auth.service.js');
      const result = await authService.login('2fa@example.com', 'correct-password', {});

      // SECURITY: must return requiresTwoFactor
      expect(result).toHaveProperty('requiresTwoFactor', true);
      expect(result).toHaveProperty('userId', 'user-2fa');
      expect(result).toHaveProperty('email', '2fa@example.com');

      // SECURITY: must NOT include tokens
      expect(result).not.toHaveProperty('tokens');
      expect(result).not.toHaveProperty('accessToken');
    });

    it('does NOT create a session when returning requiresTwoFactor', async () => {
      mockUsers.push({
        id: 'user-2fa',
        email: '2fa@example.com',
        password_hash: 'correct-password',
        is_active: true,
        email_verified: true,
        two_factor_enabled: true,
        token_version: 0,
        scope: 'customer',
      });

      const authService = await import('../../src/modules/auth/auth.service.js');
      const result = await authService.login('2fa@example.com', 'correct-password', {});

      // The function should return early without creating a session
      expect(result).toHaveProperty('requiresTwoFactor', true);
      // Sessions table should NOT have been written to
      expect(mockSupabase.from).not.toHaveBeenCalledWith('sessions');
    });
  });

  describe('Mandatory 2FA setup for privileged accounts', () => {
    it('returns requiresTwoFactorSetup for super_admin without 2FA', async () => {
      mockUsers.push({
        id: 'admin-1',
        email: 'admin@example.com',
        password_hash: 'correct-password',
        is_active: true,
        email_verified: true,
        two_factor_enabled: false,
        scope: 'super_admin',
        token_version: 0,
      });

      const authService = await import('../../src/modules/auth/auth.service.js');
      const result = await authService.login('admin@example.com', 'correct-password', {});

      expect(result).toHaveProperty('requiresTwoFactorSetup', true);
      expect(result).toHaveProperty('twoFactorSetupToken');
    });

    it('returns requiresTwoFactor for super_admin WITH 2FA (not requiresTwoFactorSetup)', async () => {
      mockUsers.push({
        id: 'admin-1',
        email: 'admin@example.com',
        password_hash: 'correct-password',
        is_active: true,
        email_verified: true,
        two_factor_enabled: true,
        scope: 'super_admin',
        token_version: 0,
      });

      const authService = await import('../../src/modules/auth/auth.service.js');
      const result = await authService.login('admin@example.com', 'correct-password', {});

      // CRITICAL: already-enrolled admin must get requiresTwoFactor, NOT requiresTwoFactorSetup
      expect(result).toHaveProperty('requiresTwoFactor', true);
      expect(result).not.toHaveProperty('requiresTwoFactorSetup');
      expect(result).not.toHaveProperty('tokens');
    });
  });

  describe('completeLoginAfter2FA', () => {
    it('issues tokens and session after successful 2FA verification', async () => {
      mockUsers.push({
        id: 'user-2fa',
        email: '2fa@example.com',
        is_active: true,
        scope: 'customer',
        token_version: 0,
        tenant_id: 'tenant-1',
      });

      const authService = await import('../../src/modules/auth/auth.service.js');
      const result = await authService.completeLoginAfter2FA('user-2fa', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.user).toHaveProperty('id', 'user-2fa');
      expect(result.user).toHaveProperty('email', '2fa@example.com');
    });
  });
});
