/**
 * Auth Test Helpers
 *
 * Utilities for creating JWT tokens and mocking authentication
 * middleware in unit/integration tests.
 */

import jwt from 'jsonwebtoken';
import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedUser } from '../../src/types/index';
import { randomUUID } from 'node:crypto';

// ─── Constants ───────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
const TEST_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars-long';

// ─── Default Users ───────────────────────────────────────────────────

function defaultUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  const userId = overrides?.userId ?? overrides?.id ?? randomUUID();
  return {
    userId,
    id: userId,
    email: `user-${userId.slice(0, 8)}@test.com`,
    roles: ['customer'],
    permissions: [],
    ...overrides,
  };
}

function adminUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return defaultUser({
    roles: ['super_admin'],
    permissions: ['*'],
    ...overrides,
  });
}

function staffUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return defaultUser({
    roles: ['staff'],
    permissions: [],
    ...overrides,
  });
}

// ─── Token Generators ────────────────────────────────────────────────

/**
 * Create a valid JWT access token for testing.
 *
 * @param user - Partial AuthenticatedUser; defaults are filled in automatically.
 * @param options - Optional jwt.SignOptions overrides (e.g. `expiresIn`).
 * @returns A signed JWT string suitable for `Authorization: Bearer <token>`.
 *
 * @example
 *   const token = createTestToken();
 *   const token = createTestToken({ roles: ['admin'] });
 *   const token = createTestToken({ userId: 'abc-123' }, { expiresIn: '1h' });
 */
export function createTestToken(
  user?: Partial<AuthenticatedUser>,
  options?: jwt.SignOptions,
): string {
  const u = defaultUser(user);
  return jwt.sign(
    {
      userId: u.userId,
      email: u.email,
      roles: u.roles,
      tokenVersion: 0,
    },
    TEST_JWT_SECRET,
    { expiresIn: 900, ...options },
  );
}

/**
 * Create a JWT access token with super_admin role.
 */
export function createAdminToken(
  overrides?: Partial<AuthenticatedUser>,
  options?: jwt.SignOptions,
): string {
  return createTestToken(adminUser(overrides), options);
}

/**
 * Create a JWT access token with staff role.
 */
export function createStaffToken(
  overrides?: Partial<AuthenticatedUser>,
  options?: jwt.SignOptions,
): string {
  return createTestToken(staffUser(overrides), options);
}

/**
 * Create a JWT refresh token for testing.
 */
export function createTestRefreshToken(
  userId?: string,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(
    { userId: userId ?? randomUUID(), type: 'refresh', tokenVersion: 0 },
    TEST_REFRESH_SECRET,
    { expiresIn: 604800, ...options },
  );
}

/**
 * Create an expired token (useful for testing 401 flows).
 */
export function createExpiredToken(user?: Partial<AuthenticatedUser>): string {
  return createTestToken(user, { expiresIn: 0 });
}

// ─── Auth Middleware Mock ────────────────────────────────────────────

/**
 * Returns a mock `authenticate` middleware that skips real JWT
 * verification and instead injects `req.user` directly.
 *
 * Usage in tests:
 * ```ts
 * vi.mock('../../src/middleware/auth.middleware', () => ({
 *   authenticate: mockAuthMiddleware({ roles: ['admin'] }),
 *   authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
 * }));
 * ```
 *
 * @param user - Partial user to inject. Defaults are filled in.
 */
export function mockAuthMiddleware(
  user?: Partial<AuthenticatedUser>,
): (req: Request, res: Response, next: NextFunction) => void {
  const u = defaultUser(user);
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = u;
    next();
  };
}

/**
 * Returns a mock `authorize` middleware that always passes.
 * Useful when you just want to bypass role checks in unit tests.
 */
export function mockAuthorizeMiddleware(): (
  ...roles: (string | string[])[]
) => (req: Request, res: Response, next: NextFunction) => void {
  return (..._roles) => (_req, _res, next) => next();
}

/**
 * Returns a mock `optionalAuth` middleware that optionally injects a user.
 */
export function mockOptionalAuth(
  user?: Partial<AuthenticatedUser> | null,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      req.user = defaultUser(user);
    }
    next();
  };
}

// ─── Auth Header Helper ─────────────────────────────────────────────

/**
 * Build an Authorization header object for use with supertest / fetch.
 *
 * @example
 *   const headers = authHeader(createAdminToken());
 *   await request(app).get('/api/users').set(headers);
 */
export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ─── Re-exports ──────────────────────────────────────────────────────

export { TEST_JWT_SECRET, TEST_REFRESH_SECRET };
