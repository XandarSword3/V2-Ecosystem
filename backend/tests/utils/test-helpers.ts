/**
 * Test Utilities and Mock Factories
 * 
 * Provides easy-to-use factories for creating test doubles.
 * Use these in your unit tests to avoid boilerplate.
 */

import { vi } from 'vitest';
import type {
  EmailService,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
  Container,
} from '../../src/lib/container/types';
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
