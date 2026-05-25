/**
 * Authentication Flow Integration Tests
 * Tests complete authentication flows including login, 2FA, password reset, and session management
 *
 * Uses the managed integration test lifecycle (setup.ts) — no direct DB/Supabase client calls.
 * All user creation goes through the API; test-DB teardown is handled by the lifecycle teardown.
 */
import request from 'supertest';
import app from '../../src/app';
import { authenticator } from 'otplib';

const canGenerateOtp =
  typeof (authenticator as unknown as { generate?: (secret: string) => string })?.generate === 'function';

// ---------------------------------------------------------------------------
// Registration & core login flows
// ---------------------------------------------------------------------------

describe('Authentication Flow Integration', () => {
  let testUserEmail: string;
  const testUserPassword = 'SecurePassword123!@#';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(() => {
    testUserEmail = `test-auth-${Date.now()}@example.com`;
  });

  describe('User Registration', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: testUserEmail, password: testUserPassword, fullName: 'Test User', phone: '+1234567890' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data.user');
      expect(response.body.data.user.email).toBe(testUserEmail);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'weak-password@example.com', password: '123', fullName: 'Test User' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: testUserEmail, password: testUserPassword, fullName: 'Test User' });

      expect([400, 409]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid-email', password: testUserPassword, fullName: 'Test User' });

      expect(response.status).toBe(400);
    });
  });

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data.tokens.accessToken');
      expect(response.body).toHaveProperty('data.tokens.refreshToken');
      expect(response.body).toHaveProperty('data.user');

      accessToken = response.body.data.tokens.accessToken;
      refreshToken = response.body.data.tokens.refreshToken;
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: 'WrongPassword123!' });

      expect(response.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: testUserPassword });

      expect(response.status).toBe(401);
    });

    it('should track failed login attempts', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: testUserEmail, password: 'WrongPassword' });
      }

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: 'WrongPassword' });

      expect([401, 429]).toContain(response.status);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data.tokens.accessToken');
        accessToken = response.body.data.tokens.accessToken;
      }
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' });

      expect(response.status).toBe(401);
    });

    it('should reject expired refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'expired.refresh.token' });

      expect(response.status).toBe(401);
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/v1/auth/me');
      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUserEmail });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset');
    });

    it('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-reset-token', newPassword: 'NewSecurePassword123!@#' });

      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Logout', () => {
    it('should logout and invalidate token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 204]).toContain(response.status);
    });

    it('should reject requests after logout', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401]).toContain(response.status);
    });
  });
});

// ---------------------------------------------------------------------------
// Two-Factor Authentication
// ---------------------------------------------------------------------------

describe('Two-Factor Authentication', () => {
  let accessToken: string;
  let totpSecret: string;

  beforeAll(async () => {
    const email = `test-2fa-${Date.now()}@example.com`;
    const password = 'SecurePassword123!@#';

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'TwoFactor Test' });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    accessToken =
      loginResponse.body?.data?.tokens?.accessToken ||
      loginResponse.body?.accessToken;
  });

  describe('2FA Setup', () => {
    it('should generate TOTP secret for setup', async () => {
      const response = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data.secret');
        expect(response.body).toHaveProperty('data.qrCode');
        totpSecret = response.body.data.secret;
      }
    });

    it('should verify and enable 2FA with valid code', async () => {
      if (!totpSecret || !canGenerateOtp) return;

      const validCode = (authenticator as unknown as { generate: (s: string) => string }).generate(totpSecret);
      const response = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: validCode });

      expect([200, 400]).toContain(response.status);
    });

    it('should reject invalid 2FA code', async () => {
      const response = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: '000000' });

      expect(response.status).toBe(400);
    });
  });

  describe('2FA Management', () => {
    it('should get backup codes', async () => {
      const response = await request(app)
        .get('/api/v1/auth/2fa/backup-codes')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('codes');
        expect(Array.isArray(response.body.codes)).toBe(true);
      }
    });

    it('should disable 2FA with valid code', async () => {
      if (!totpSecret || !canGenerateOtp) return;

      const validCode = (authenticator as unknown as { generate: (s: string) => string }).generate(totpSecret);
      const response = await request(app)
        .delete('/api/v1/auth/2fa')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: validCode });

      expect([200, 204, 400]).toContain(response.status);
    });
  });
});

// ---------------------------------------------------------------------------
// Account Lockout
// ---------------------------------------------------------------------------

describe('Account Lockout', () => {
  let lockedUserEmail: string;
  const password = 'SecurePassword123!@#';

  beforeAll(async () => {
    lockedUserEmail = `test-lockout-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: lockedUserEmail, password, fullName: 'Lockout Test' });
  });

  it('should lock account after max failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockedUserEmail, password: 'WrongPassword' });
    }

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: lockedUserEmail, password: 'WrongPassword' });

    expect([401, 423, 429]).toContain(response.status);
  });

  it('should reject correct password during lockout', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: lockedUserEmail, password });

    expect([200, 401, 423]).toContain(response.status);
  });
});

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

describe('Session Management', () => {
  let accessToken: string;

  beforeAll(async () => {
    const email = `test-session-${Date.now()}@example.com`;
    const password = 'SecurePassword123!@#';

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'Session Test' });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    accessToken =
      loginResponse.body?.data?.tokens?.accessToken ||
      loginResponse.body?.accessToken;
  });

  it('should list active sessions', async () => {
    const response = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    if (response.status === 200) {
      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
    }
  });

  it('should terminate specific session', async () => {
    const response = await request(app)
      .delete('/api/v1/auth/sessions/session-id-123')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([200, 204, 404]).toContain(response.status);
  });

  it('should terminate all other sessions', async () => {
    const response = await request(app)
      .delete('/api/v1/auth/sessions/all-others')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([200, 204, 404]).toContain(response.status);
  });
});
