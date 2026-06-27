/// <reference types="vitest/globals" />

/**
 * Auth Service Unit Tests
 * Rewired to test src/modules/auth/auth.service.ts (post-Engine-Refit).
 * All external calls mocked — no DB, no network.
 */


// ── Config ───────────────────────────────────────────────────────────────────
vi.mock('../../../src/config/index.js', () => ({
  config: {
    jwt: { secret: 'test-secret-32-chars-minimum-ok', refreshSecret: 'ref-secret-32-chars-minimum-ok!', expiresIn: '15m', refreshExpiresIn: '7d' },
    frontendUrl: 'http://localhost:3000',
  },
}));

// ── Logger ───────────────────────────────────────────────────────────────────
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Email ─────────────────────────────────────────────────────────────────────
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/services/email.service.js', () => ({
  emailService: { sendEmail: (...args: unknown[]) => mockSendEmail(...args) },
}));

// ── Password policy ───────────────────────────────────────────────────────────
const mockValidatePassword = vi.fn().mockResolvedValue({ valid: true, errors: [] });
vi.mock('../../../src/services/password-policy.service.js', () => ({
  validatePassword: (...args: unknown[]) => mockValidatePassword(...args),
}));

// ── Lockout service ───────────────────────────────────────────────────────────
const mockIsAccountLocked = vi.fn().mockResolvedValue({ locked: false });
const mockRecordFailedAttempt = vi.fn().mockResolvedValue(undefined);
const mockRecordSuccessfulLogin = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/modules/auth/lockout.service.js', () => ({
  isAccountLocked: (...args: unknown[]) => mockIsAccountLocked(...args),
  recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
  recordSuccessfulLogin: (...args: unknown[]) => mockRecordSuccessfulLogin(...args),
}));

// ── Token blacklist ───────────────────────────────────────────────────────────
vi.mock('../../../src/services/token-blacklist.service.js', () => ({
  blacklistToken: vi.fn().mockResolvedValue(undefined),
}));

// ── DB chain mock ─────────────────────────────────────────────────────────────
const mockChain = {
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  limit: vi.fn(),
  order: vi.fn(),
  filter: vi.fn(),
  rpc: vi.fn(),
};
const resetChain = () =>
  Object.keys(mockChain).forEach((k) => (mockChain as any)[k].mockReturnValue(mockChain));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

// ── bcryptjs — deterministic in tests ────────────────────────────────────────
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('$2a$12$hashed_password'),
  compare: vi.fn().mockResolvedValue(true),
}));

import * as authService from '../../../src/modules/auth/auth.service.js';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();   // clears call history AND mockResolvedValueOnce queues
  resetChain();
  // Re-seed mocks whose implementations are cleared by resetAllMocks
  vi.mocked(bcrypt.hash).mockResolvedValue('$2a$12$hashed_password' as never);
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  mockValidatePassword.mockResolvedValue({ valid: true, errors: [] });
  mockIsAccountLocked.mockResolvedValue({ locked: false });
  mockSendEmail.mockResolvedValue(undefined);
});

// ── register ──────────────────────────────────────────────────────────────────

describe('register', () => {
  function setupRegisterMocks(existingUsers: unknown[] = [], userOverride: Record<string, unknown> = {}) {
    // 1. email check: .select().eq().limit() — limit is terminal
    mockChain.limit.mockResolvedValueOnce({ data: existingUsers, error: null });
    // 2. user insert: .insert().select().single() — insert returns chain, single is terminal
    mockChain.insert.mockReturnValueOnce(mockChain); // call 1: users insert → chain continues
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-new', email: userOverride.email || 'new@example.com', full_name: 'New User', ...userOverride },
      error: null,
    });
    // 3. role lookup: .select().eq().limit() — limit is terminal
    mockChain.limit.mockResolvedValueOnce({ data: [{ id: 'role-customer' }], error: null });
    // 4. user_roles insert: .insert() — terminal, resolves directly
    mockChain.insert.mockResolvedValueOnce({ data: null, error: null }); // call 2: user_roles insert
  }

  it('creates user and returns user object (no tokens; email verification required first)', async () => {
    setupRegisterMocks();
    const result = await authService.register({
      email: 'new@example.com',
      password: 'Password123!',
      fullName: 'New User',
      tenantId: 'tenant-00000000-0000-0000-0000-000000000001',
    });
    expect(result.user.email).toBe('new@example.com');
    expect((result as any).tokens).toBeUndefined();
  });

  it('hashes the password before storing', async () => {
    setupRegisterMocks();
    await authService.register({ email: 'x@x.com', password: 'Password123!', fullName: 'X', tenantId: 'tenant-00000000-0000-0000-0000-000000000001' });
    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('Password123!', 12);
  });

  it('lowercases the email', async () => {
    setupRegisterMocks([], { email: 'upper@example.com' });
    const result = await authService.register({
      email: 'UPPER@EXAMPLE.COM',
      password: 'Password123!',
      fullName: 'Upper',
      tenantId: 'tenant-00000000-0000-0000-0000-000000000001',
    });
    expect(result.user.email).toBe('upper@example.com');
  });

  it('throws when email already exists', async () => {
    mockChain.limit.mockResolvedValueOnce({ data: [{ id: 'existing' }], error: null });
    await expect(
      authService.register({ email: 'taken@example.com', password: 'Password123!', fullName: 'X' })
    ).rejects.toThrow('Email already registered');
  });

  it('throws when password policy fails', async () => {
    mockChain.limit.mockResolvedValueOnce({ data: [], error: null });
    mockValidatePassword.mockResolvedValueOnce({ valid: false, errors: ['Too short'] });
    await expect(
      authService.register({ email: 'new@example.com', password: 'weak', fullName: 'X' })
    ).rejects.toThrow('Password does not meet policy');
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('login', () => {
  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    password_hash: '$2a$12$hashed',
    full_name: 'Test User',
    is_active: true,
    email_verified: true,
    two_factor_enabled: false,
    roles: ['customer'],
    role: null,
    token_version: 0,
    last_login_at: null,
    profile_image_url: null,
    preferred_language: 'en',
  };

  function setupLoginMocks(userOverrides = {}) {
    const user = { ...activeUser, ...userOverrides };
    // find user: .select().eq('email',...).single() — eq returns chain, single is terminal
    mockChain.single.mockResolvedValueOnce({ data: user, error: null });
    // create session: .insert({...}) — terminal, resolves directly
    mockChain.insert.mockResolvedValueOnce({ error: null });
    // update last_login: .update({...}).eq('id', user.id) — eq is terminal (2nd eq call)
    // 1st eq call (.eq('email',...)) uses resetChain default (returns mockChain)
    mockChain.eq
      .mockReturnValueOnce(mockChain)         // call 1: .eq('email', ...) → chain continues
      .mockResolvedValueOnce({ error: null }); // call 2: .eq('id', user.id) on update → terminal
  }

  it('returns user and tokens on valid credentials', async () => {
    setupLoginMocks();
    const result = await authService.login('user@example.com', 'Password123!', {});
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('tokens');
    expect((result as any).user.email).toBe('user@example.com');
  });

  it('throws INVALID_CREDENTIALS when user not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(authService.login('ghost@x.com', 'pass', {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws ACCOUNT_DISABLED for inactive account', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { ...activeUser, is_active: false },
      error: null,
    });
    await expect(authService.login('user@example.com', 'pass', {})).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
    });
  });

  it('throws ACCOUNT_LOCKED when lockout fires', async () => {
    mockChain.single.mockResolvedValueOnce({ data: activeUser, error: null });
    mockIsAccountLocked.mockResolvedValueOnce({ locked: true, message: 'Locked' });
    await expect(authService.login('user@example.com', 'pass', {})).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('throws INVALID_CREDENTIALS on wrong password', async () => {
    mockChain.single.mockResolvedValueOnce({ data: activeUser, error: null });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    await expect(authService.login('user@example.com', 'wrongpass', {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(mockRecordFailedAttempt).toHaveBeenCalled();
  });

  it('throws EMAIL_NOT_VERIFIED when email not verified', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { ...activeUser, email_verified: false },
      error: null,
    });
    await expect(authService.login('user@example.com', 'Password123!', {})).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('returns requiresTwoFactor when 2FA is enabled', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { ...activeUser, two_factor_enabled: true },
      error: null,
    });
    const result = await authService.login('user@example.com', 'Password123!', {});
    expect((result as any).requiresTwoFactor).toBe(true);
  });

  it('clears lockout on successful login', async () => {
    setupLoginMocks();
    await authService.login('user@example.com', 'Password123!', {});
    expect(mockRecordSuccessfulLogin).toHaveBeenCalled();
  });

  it('returns requiresTwoFactorSetup when 2FA is not enabled for super_admin or tenant_admin', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { ...activeUser, two_factor_enabled: false, roles: ['super_admin'], scope: 'super_admin' },
      error: null,
    });
    const result = await authService.login('admin@example.com', 'Password123!', {});
    expect((result as any).requiresTwoFactorSetup).toBe(true);
    expect((result as any).message).toContain('Two-factor authentication is mandatory');
  });
});

// ── changePassword ────────────────────────────────────────────────────────────

describe('changePassword', () => {
  it('updates password when current password matches', async () => {
    // user lookup: .select(...).eq('id', userId).single() — eq call 1 returns chain, single resolves
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', password_hash: '$2a$12$hashed' },
      error: null,
    });
    // changePassword calls logout(userId) after update, which does:
    //   sessions.update({is_active:false}).eq('user_id', userId)  — eq resolves
    // and then tries rpc('increment_token_version') — rpc() returns mockChain (default, not resolved),
    // so the catch block runs: users.select('token_version').eq('id',userId).single() then users.update.eq
    // For simplicity, set enough eq resolves to cover the update + logout chain:
    // eq call 1: user lookup .eq('id', userId) — returns mockChain
    // eq call 2: password update .eq('id', userId) — resolves
    // eq call 3: logout sessions .eq('user_id', userId) — resolves
    // eq call 4: logout fallback user select .eq('id', userId) — returns mockChain (single resolves)
    // eq call 5: logout fallback update .eq('id', userId) — resolves
    mockChain.eq
      .mockReturnValueOnce(mockChain)          // call 1: user lookup
      .mockResolvedValueOnce({ error: null })  // call 2: password update
      .mockResolvedValueOnce({ error: null })  // call 3: logout sessions update
      .mockReturnValueOnce(mockChain)          // call 4: logout fallback select
      .mockResolvedValueOnce({ error: null }); // call 5: logout fallback update
    // logout fallback also calls single() to get token_version
    mockChain.single.mockResolvedValueOnce({ data: { token_version: 0 }, error: null });
    // rpc returns mockChain by default (not a promise) — catch block fires, which is fine

    await expect(
      authService.changePassword('user-1', 'OldPass123!', 'NewPass456!')
    ).resolves.toBeUndefined();
    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('NewPass456!', 12);
  });

  it('throws INVALID_CREDENTIALS when current password is wrong', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', password_hash: '$2a$12$hashed' },
      error: null,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    await expect(authService.changePassword('user-1', 'wrong', 'New456!')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws when new password fails policy', async () => {
    // user lookup: .select(...).eq('id', userId).single() — eq returns chain, single resolves
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', password_hash: '$2a$12$hashed' },
      error: null,
    });
    mockChain.eq.mockReturnValueOnce(mockChain); // eq('id', userId) returns chain
    mockValidatePassword.mockResolvedValueOnce({ valid: false, errors: ['Too short'] });
    await expect(
      authService.changePassword('user-1', 'OldPass123!', 'weak')
    ).rejects.toMatchObject({ code: 'PASSWORD_POLICY_VIOLATION' });
  });
});

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

describe('sendPasswordResetEmail', () => {
  it('sends reset email for existing user', async () => {
    // user lookup: .select().eq('email',...).single() — eq returns chain, single resolves
    mockChain.eq.mockReturnValueOnce(mockChain); // eq('email', ...) returns chain
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', full_name: 'Test', email: 'test@example.com' },
      error: null,
    });
    // existing sessions query: .select().eq('user_id',...).eq('is_active', true)
    // two chained eqs — first returns mockChain, second resolves
    mockChain.eq
      .mockReturnValueOnce(mockChain)           // call 1: .eq('user_id', ...) → chain continues
      .mockResolvedValueOnce({ data: [], error: null }); // call 2: .eq('is_active', true) → terminal
    // insert reset token session
    mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

    await authService.sendPasswordResetEmail('test@example.com');
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com', subject: expect.stringContaining('Reset') })
    );
  });

  it('returns silently for non-existent email', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(authService.sendPasswordResetEmail('ghost@x.com')).resolves.toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  it('throws INVALID_TOKEN for bad token', async () => {
    // .select().eq('refresh_token').eq('is_active').eq('session_type') — three chained eqs, third resolves
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ data: [], error: null });
    await expect(authService.resetPassword('bad-token', 'NewPass123!')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('throws TOKEN_EXPIRED for expired token', async () => {
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'sess-1',
            user_id: 'user-1',
            expires_at: new Date(Date.now() - 60000).toISOString(),
            refresh_token: 'tok',
          },
        ],
        error: null,
      });
    await expect(authService.resetPassword('tok', 'NewPass123!')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });

  it('updates password with valid token', async () => {
    // Ensure validatePassword returns valid (might have stale queue from previous test)
    mockValidatePassword.mockResolvedValue({ valid: true, errors: [] });
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    // token lookup: .select().eq('refresh_token').eq('is_active').eq('session_type') — three chained eqs
    mockChain.eq
      .mockReturnValueOnce(mockChain)
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({
        data: [{ id: 'sess-1', user_id: 'user-1', expires_at: future, refresh_token: 'tok' }],
        error: null,
      });
    // update user password: .update({...}).eq('id', session.user_id)
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // delete reset session: .delete().eq('id', session.id)
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // invalidate other sessions: .update({...}).eq('user_id', session.user_id)
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const result = await authService.resetPassword('tok', 'NewPass123!');
    expect((result as any).user_id).toBe('user-1');
    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('NewPass123!', 12);
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns user with roles', async () => {
    // user lookup: .select(...).eq('id', userId).single() — eq returns chain, single is terminal
    mockChain.eq.mockReturnValueOnce(mockChain); // eq('id', userId) returns chain
    mockChain.single.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'u@x.com',
        full_name: 'U X',
        phone: null,
        profile_image_url: null,
        preferred_language: 'en',
        is_platform_admin: false,
      },
      error: null,
    });
    // roles lookup: .select('roles (name)').eq('user_id', userId) — eq is terminal
    mockChain.eq.mockResolvedValueOnce({
      data: [{ roles: { name: 'customer' } }],
      error: null,
    });

    const user = await authService.getCurrentUser('user-1');
    expect(user.email).toBe('u@x.com');
    expect(user.roles).toContain('customer');
  });

  it('throws USER_NOT_FOUND for missing user', async () => {
    mockChain.eq.mockReturnValueOnce(mockChain); // eq('id', userId) returns chain
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(authService.getCurrentUser('ghost')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
