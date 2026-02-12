/**
 * Test Utilities and Mock Factories
 * 
 * Provides easy-to-use factories for creating test doubles:
 *  - Service mocks (email, QR, logger, activity, socket)
 *  - Express request / response / next mocks
 *  - Assertion helpers (API errors, pagination, activity logs, socket events)
 */

import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type {
  EmailService,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
  Container,
} from '../../src/lib/container/types';
import type { AuthenticatedUser } from '../../src/types/index';
import { InMemoryPoolRepository } from '../../src/lib/repositories/pool.repository.memory';

// ============================================
// Mock Factories
// ============================================

/**
 * Create a mock EmailService
 */
export function createMockEmailService(): EmailService & { 
  _calls: { method: string; args: unknown[] }[] 
} {
  const calls: { method: string; args: unknown[] }[] = [];
  
  return {
    _calls: calls,
    sendEmail: vi.fn(async (...args) => { calls.push({ method: 'sendEmail', args }); return true; }),
    sendTemplatedEmail: vi.fn(async (...args) => { calls.push({ method: 'sendTemplatedEmail', args }); return true; }),
    sendPoolTicketConfirmation: vi.fn(async (...args) => { calls.push({ method: 'sendPoolTicketConfirmation', args }); return true; }),
    sendBookingConfirmation: vi.fn(async (...args) => { calls.push({ method: 'sendBookingConfirmation', args }); return true; }),
    sendOrderConfirmation: vi.fn(async (...args) => { calls.push({ method: 'sendOrderConfirmation', args }); return true; }),
  };
}

/**
 * Create a mock QRCodeService
 */
export function createMockQRCodeService(): QRCodeService {
  return {
    generate: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
    generateAsBuffer: vi.fn().mockResolvedValue(Buffer.from('mockQR')),
  };
}

/**
 * Create a mock LoggerService that captures all logs
 */
export function createMockLogger(): LoggerService & { 
  logs: { level: string; message: string; args: unknown[] }[] 
} {
  const logs: { level: string; message: string; args: unknown[] }[] = [];
  
  return {
    logs,
    info: vi.fn((message, ...args) => logs.push({ level: 'info', message, args })),
    warn: vi.fn((message, ...args) => logs.push({ level: 'warn', message, args })),
    error: vi.fn((message, ...args) => logs.push({ level: 'error', message, args })),
    debug: vi.fn((message, ...args) => logs.push({ level: 'debug', message, args })),
  };
}

/**
 * Create a mock ActivityLoggerService
 */
export function createMockActivityLogger(): ActivityLoggerService & {
  activities: { action: string; details: Record<string, unknown>; userId?: string }[]
} {
  const activities: { action: string; details: Record<string, unknown>; userId?: string }[] = [];
  
  return {
    activities,
    log: vi.fn(async (action, details, userId) => {
      activities.push({ action, details, userId });
    }),
  };
}

/**
 * Create a mock SocketEmitter
 */
export function createMockSocketEmitter(): SocketEmitter & {
  emissions: { target: string; event: string; data: unknown }[]
} {
  const emissions: { target: string; event: string; data: unknown }[] = [];
  
  return {
    emissions,
    emitToUnit: vi.fn((unit, event, data) => emissions.push({ target: `unit:${unit}`, event, data })),
    emitToRoom: vi.fn((room, event, data) => emissions.push({ target: `room:${room}`, event, data })),
  };
}

/**
 * Create a test config
 */
export function createTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    env: 'test',
    port: 3000,
    apiUrl: 'http://localhost:3000',
    frontendUrl: 'http://localhost:3000',
    database: { url: 'postgres://test:test@localhost:5432/test' },
    supabase: { url: 'http://localhost:54321', anonKey: 'test-anon-key', serviceKey: 'test-service-key' },
    jwt: { 
      secret: 'test-jwt-secret-minimum-32-characters', 
      refreshSecret: 'test-refresh-secret-minimum-32-chars', 
      expiresIn: '15m', 
      refreshExpiresIn: '7d' 
    },
    stripe: { secretKey: 'sk_test_xxx', webhookSecret: 'whsec_test' },
    email: { host: 'smtp.test.com', port: 587, user: 'test', pass: 'test', from: 'test@test.com' },
    ...overrides,
  };
}

// ============================================
// Container Factory for Tests
// ============================================

export interface TestContainer extends Omit<Container, 'database'> {
  poolRepository: InMemoryPoolRepository;
  emailService: ReturnType<typeof createMockEmailService>;
  logger: ReturnType<typeof createMockLogger>;
  activityLogger: ReturnType<typeof createMockActivityLogger>;
  socketEmitter: ReturnType<typeof createMockSocketEmitter>;
}

/**
 * Create a complete test container with all mocked dependencies
 */
export function createTestContainer(overrides?: Partial<TestContainer>): TestContainer {
  const defaults: TestContainer = {
    poolRepository: new InMemoryPoolRepository(),
    emailService: createMockEmailService(),
    qrCodeService: createMockQRCodeService(),
    logger: createMockLogger(),
    activityLogger: createMockActivityLogger(),
    socketEmitter: createMockSocketEmitter(),
    config: createTestConfig(),
  };

  return { ...defaults, ...overrides };
}

// ============================================
// Test Data Builders
// ============================================

/**
 * Build test pool session data
 */
export function buildPoolSession(overrides?: Record<string, unknown>) {
  return {
    name: 'Morning Swim',
    start_time: '09:00',
    end_time: '12:00',
    capacity: 100,
    price: 25,
    adult_price: 25,
    child_price: 15,
    is_active: true,
    ...overrides,
  };
}

/**
 * Build test pool ticket data
 */
export function buildPoolTicket(sessionId: string, overrides?: Record<string, unknown>) {
  return {
    session_id: sessionId,
    guest_name: 'Test Guest',
    guest_email: 'test@example.com',
    guest_phone: '+1234567890',
    date: new Date().toISOString().split('T')[0],
    adults: 2,
    children: 1,
    infants: 0,
    status: 'valid' as const,
    payment_status: 'paid',
    payment_method: 'cash',
    ...overrides,
  };
}

/**
 * Build test user data
 */
export function buildUser(overrides?: Record<string, unknown>) {
  const id = `user-${Date.now()}`;
  return {
    id,
    email: `${id}@test.com`,
    name: 'Test User',
    role: 'customer',
    ...overrides,
  };
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that an activity was logged
 */
export function expectActivityLogged(
  activityLogger: ReturnType<typeof createMockActivityLogger>,
  action: string,
  detailsMatch?: Record<string, unknown>
) {
  const found = activityLogger.activities.find(a => a.action === action);
  if (!found) {
    throw new Error(`Expected activity '${action}' to be logged. Logged: ${JSON.stringify(activityLogger.activities)}`);
  }
  if (detailsMatch) {
    for (const [key, value] of Object.entries(detailsMatch)) {
      if (found.details[key] !== value) {
        throw new Error(`Expected activity '${action}' to have ${key}=${value}, got ${found.details[key]}`);
      }
    }
  }
  return found;
}

/**
 * Assert that a socket event was emitted
 */
export function expectSocketEmitted(
  socketEmitter: ReturnType<typeof createMockSocketEmitter>,
  event: string,
  targetContains?: string
) {
  const found = socketEmitter.emissions.find(e => e.event === event);
  if (!found) {
    throw new Error(`Expected socket event '${event}' to be emitted. Emitted: ${JSON.stringify(socketEmitter.emissions)}`);
  }
  if (targetContains && !found.target.includes(targetContains)) {
    throw new Error(`Expected socket event '${event}' target to contain '${targetContains}', got '${found.target}'`);
  }
  return found;
}

// ============================================
// Express Mock Factories
// ============================================

/**
 * Create a mock Express Request object.
 *
 * Every property can be overridden via the `overrides` parameter.
 * Includes sensible defaults for `method`, `path`, `headers`, etc.
 *
 * @example
 *   const req = createMockRequest({ params: { id: '123' }, user: { ... } });
 */
export function createMockRequest(overrides?: Record<string, unknown>): Request {
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/',
    url: '/',
    baseUrl: '',
    originalUrl: '/',
    headers: {},
    params: {},
    query: {},
    body: {},
    cookies: {},
    signedCookies: {},
    ip: '127.0.0.1',
    ips: [],
    protocol: 'http',
    secure: false,
    hostname: 'localhost',
    subdomains: [],
    requestId: 'test-request-id',
    user: undefined,
    get: vi.fn((name: string) => {
      const headers = (req.headers ?? {}) as Record<string, string>;
      return headers[name.toLowerCase()];
    }),
    header: vi.fn((name: string) => {
      const headers = (req.headers ?? {}) as Record<string, string>;
      return headers[name.toLowerCase()];
    }),
    accepts: vi.fn(),
    acceptsCharsets: vi.fn(),
    acceptsEncodings: vi.fn(),
    acceptsLanguages: vi.fn(),
    is: vi.fn(),
    ...overrides,
  };

  return req as unknown as Request;
}

/**
 * Create a mock Express Response object.
 *
 * All chainable methods (`status`, `json`, `send`, etc.) return `res`
 * so you can assert on calls: `expect(res.status).toHaveBeenCalledWith(200)`.
 *
 * @example
 *   const res = createMockResponse();
 *   await controller(req, res, next);
 *   expect(res.status).toHaveBeenCalledWith(200);
 *   expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
 */
export function createMockResponse(): Response {
  const res: Record<string, unknown> = {
    statusCode: 200,
    headersSent: false,
    locals: {},
  };

  // Chainable methods
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.end = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.contentType = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.header = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.getHeader = vi.fn();
  res.removeHeader = vi.fn();
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  res.render = vi.fn().mockReturnValue(res);
  res.format = vi.fn().mockReturnValue(res);
  res.attachment = vi.fn().mockReturnValue(res);
  res.download = vi.fn().mockReturnValue(res);
  res.links = vi.fn().mockReturnValue(res);
  res.vary = vi.fn().mockReturnValue(res);
  res.append = vi.fn().mockReturnValue(res);
  res.location = vi.fn().mockReturnValue(res);

  return res as unknown as Response;
}

/**
 * Create a mock Express NextFunction (spy).
 *
 * @example
 *   const next = createMockNext();
 *   await middleware(req, res, next);
 *   expect(next).toHaveBeenCalled();
 */
export function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ============================================
// Assertion Helpers – API Errors
// ============================================

/**
 * Assert that a mock response returned an API error.
 *
 * Checks `res.status()` was called with `expectedStatus` and
 * `res.json()` was called with a body matching `{ success: false, error: ... }`.
 *
 * @param res - Mock response from `createMockResponse()`.
 * @param expectedStatus - Expected HTTP status code.
 * @param errorContains - Optional substring the error message should contain.
 *
 * @example
 *   expectApiError(res, 400, 'Invalid');
 */
export function expectApiError(
  res: Response,
  expectedStatus: number,
  errorContains?: string,
): void {
  expect(res.status).toHaveBeenCalledWith(expectedStatus);
  expect(res.json).toHaveBeenCalled();

  const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
  expect(jsonCall).toBeDefined();
  expect(jsonCall.success).toBe(false);

  if (errorContains) {
    const errorMsg: string = jsonCall.error ?? jsonCall.message ?? '';
    expect(errorMsg.toLowerCase()).toContain(errorContains.toLowerCase());
  }
}

// ============================================
// Assertion Helpers – Pagination
// ============================================

/**
 * Assert that a successful paginated response was returned.
 *
 * Validates the shape: `{ success: true, data: [...], pagination: { page, limit, total, totalPages } }`.
 *
 * @param res - Mock response from `createMockResponse()`.
 * @param opts - Optional expected pagination fields.
 *
 * @example
 *   expectPagination(res, { page: 1, total: 42 });
 */
export function expectPagination(
  res: Response,
  opts?: { page?: number; limit?: number; total?: number; totalPages?: number },
): void {
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalled();

  const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
  expect(jsonCall).toBeDefined();
  expect(jsonCall.success).toBe(true);
  expect(Array.isArray(jsonCall.data)).toBe(true);
  expect(jsonCall.pagination).toBeDefined();
  expect(jsonCall.pagination).toHaveProperty('page');
  expect(jsonCall.pagination).toHaveProperty('limit');
  expect(jsonCall.pagination).toHaveProperty('total');
  expect(jsonCall.pagination).toHaveProperty('totalPages');

  if (opts?.page !== undefined) expect(jsonCall.pagination.page).toBe(opts.page);
  if (opts?.limit !== undefined) expect(jsonCall.pagination.limit).toBe(opts.limit);
  if (opts?.total !== undefined) expect(jsonCall.pagination.total).toBe(opts.total);
  if (opts?.totalPages !== undefined) expect(jsonCall.pagination.totalPages).toBe(opts.totalPages);
}

