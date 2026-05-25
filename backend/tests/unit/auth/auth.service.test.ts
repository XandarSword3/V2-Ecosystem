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
  emailService: { sendEmail: mockSendEmail },
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
  vi.clearAllMocks();
  resetChain();
  mockValidatePassword.mockResolvedValue({ valid: true, errors: [] });
  mockIsAccountLocked.mockResolvedValue({ locked: false });
  mockSendEmail.mockResolvedValue(undefined);
});

// ── register ──────────────────────────────────────────────────────────────────

describe('register', () => {
  function setupRegisterMocks(existingUsers: unknown[] = []) {
    // 1. email check
    mockChain.limit.mockResolvedValueOnce({ data: existingUsers, error: null });
    // 2. user insert
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-new', email: 'new@example.com', full_name: 'New User' },
      error: null,
    });
    // 3. role lookup
    mockChain.limit.mockResolvedValueOnce({ data: [{ id: 'role-customer' }], error: null });
    // 4. user_roles insert (returns chain, terminal resolves automatically)
    mockChain.insert.mockResolvedValueOnce({ data: null, error: null });
  }

  it('creates user and returns tokens', async () => {
    setupRegisterMocks();
    const result = await authService.register({
      email: 'new@example.com',
      password: 'Password123!',
      fullName: 'New User',
    });
    expect(result.user.email).toBe('new@example.com');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  });

  it('hashes the password before storing', async () => {
    setupRegisterMocks();
    await authService.register({ email: 'x@x.com', password: 'Password123!', fullName: 'X' });
    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('Password123!', 12);
  });

  it('lowercases the email', async () => {
    setupRegisterMocks();
    const result = await authService.register({
      email: 'UPPER@EXAMPLE.COM',
      password: 'Password123!',
      fullName: 'Upper',
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
    // find user
    mockChain.single.mockResolvedValueOnce({ data: user, error: null });
    // create session
    mockChain.insert.mockResolvedValueOnce({ error: null });
    // update last_login
    mockChain.eq.mockResolvedValueOnce({ error: null });
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
});

// ── changePassword ────────────────────────────────────────────────────────────

describe('changePassword', () => {
  it('updates password when current password matches', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', password_hash: '$2a$12$hashed' },
      error: null,
    });
    mockChain.eq.mockResolvedValueOnce({ error: null });

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
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', password_hash: '$2a$12$hashed' },
      error: null,
    });
    mockValidatePassword.mockResolvedValueOnce({ valid: false, errors: ['Too short'] });
    await expect(
      authService.changePassword('user-1', 'OldPass123!', 'weak')
    ).rejects.toMatchObject({ code: 'PASSWORD_POLICY_VIOLATION' });
  });
});

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

describe('sendPasswordResetEmail', () => {
  it('sends reset email for existing user', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', full_name: 'Test', email: 'test@example.com' },
      error: null,
    });
    // existing sessions query
    mockChain.eq.mockResolvedValueOnce({ data: [], error: null });
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
    mockChain.eq.mockResolvedValueOnce({ data: [], error: null });
    await expect(authService.resetPassword('bad-token', 'NewPass123!')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('throws TOKEN_EXPIRED for expired token', async () => {
    mockChain.eq.mockResolvedValueOnce({
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
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockChain.eq.mockResolvedValueOnce({
      data: [{ id: 'sess-1', user_id: 'user-1', expires_at: future, refresh_token: 'tok' }],
      error: null,
    });
    // update user password
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // delete reset session
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // invalidate other sessions
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const result = await authService.resetPassword('tok', 'NewPass123!');
    expect((result as any).user_id).toBe('user-1');
    expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith('NewPass123!', 12);
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns user with roles', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'u@x.com',
        full_name: 'U X',
        phone: null,
        profile_image_url: null,
        preferred_language: 'en',
      },
      error: null,
    });
    mockChain.eq.mockResolvedValueOnce({
      data: [{ roles: { name: 'customer' } }],
      error: null,
    });

    const user = await authService.getCurrentUser('user-1');
    expect(user.email).toBe('u@x.com');
    expect(user.roles).toContain('customer');
  });

  it('throws USER_NOT_FOUND for missing user', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(authService.getCurrentUser('ghost')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
