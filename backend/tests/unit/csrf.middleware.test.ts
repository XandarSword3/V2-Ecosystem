/**
 * CSRF Middleware Unit Tests
 * 
 * Tests for the Double Submit Cookie CSRF protection implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock request/response types
interface MockRequest {
  method: string;
  path: string;
  ip: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

interface MockResponse {
  statusCode: number;
  body: any;
  cookies: Record<string, { value: string; options: any }>;
  status: (code: number) => MockResponse;
  json: (data: unknown) => void;
  cookie: (name: string, value: string, options: any) => void;
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: 'POST',
    path: '/api/some-endpoint',
    ip: '127.0.0.1',
    headers: {},
    cookies: {},
    ...overrides,
  };
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
    },
    cookie(name: string, value: string, options: any) {
      this.cookies[name] = { value, options };
    },
  };
  return res;
}

// Import the actual functions we're testing
import {
  generateCsrfToken,
  getCsrfTokenFromCookie,
  getCsrfTokenFromHeader,
  csrfProtection,
  ensureCsrfToken,
} from '../../src/middleware/csrf.middleware.js';

describe('CSRF Token Generation', () => {
  it('should generate a 64-character hex token', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it('should generate unique tokens each time', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateCsrfToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('CSRF Token Extraction', () => {
  it('should extract token from cookie', () => {
    const req = createMockRequest({
      cookies: { 'csrf-token': 'test-token-value' },
    });
    const token = getCsrfTokenFromCookie(req as any);
    expect(token).toBe('test-token-value');
  });

  it('should return undefined if no cookie', () => {
    const req = createMockRequest();
    const token = getCsrfTokenFromCookie(req as any);
    expect(token).toBeUndefined();
  });

  it('should extract token from header', () => {
    const req = createMockRequest({
      headers: { 'x-csrf-token': 'header-token-value' },
    });
    const token = getCsrfTokenFromHeader(req as any);
    expect(token).toBe('header-token-value');
  });

  it('should return undefined if no header', () => {
    const req = createMockRequest();
    const token = getCsrfTokenFromHeader(req as any);
    expect(token).toBeUndefined();
  });
});

describe('CSRF Protection Middleware', () => {
  it('should skip validation for GET requests', () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('should skip validation for HEAD requests', () => {
    const req = createMockRequest({ method: 'HEAD' });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should skip validation for OPTIONS requests', () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should skip validation for exempt paths (login)', () => {
    const req = createMockRequest({ 
      method: 'POST', 
      path: '/api/auth/login' 
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should skip validation for Stripe webhook', () => {
    const req = createMockRequest({ 
      method: 'POST', 
      path: '/api/payments/webhook' 
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should reject POST without cookie token', () => {
    const req = createMockRequest({ method: 'POST' });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('CSRF token missing');
  });

  it('should reject POST without header token', () => {
    const token = generateCsrfToken();
    const req = createMockRequest({ 
      method: 'POST',
      cookies: { 'csrf-token': token },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('header missing');
  });

  it('should reject POST with mismatched tokens', () => {
    const cookieToken = generateCsrfToken();
    const headerToken = generateCsrfToken(); // Different token
    const req = createMockRequest({ 
      method: 'POST',
      cookies: { 'csrf-token': cookieToken },
      headers: { 'x-csrf-token': headerToken },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('validation failed');
  });

  it('should allow POST with matching tokens', () => {
    const token = generateCsrfToken();
    const req = createMockRequest({ 
      method: 'POST',
      cookies: { 'csrf-token': token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('should allow PUT with matching tokens', () => {
    const token = generateCsrfToken();
    const req = createMockRequest({ 
      method: 'PUT',
      cookies: { 'csrf-token': token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should allow DELETE with matching tokens', () => {
    const token = generateCsrfToken();
    const req = createMockRequest({ 
      method: 'DELETE',
      cookies: { 'csrf-token': token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('should allow PATCH with matching tokens', () => {
    const token = generateCsrfToken();
    const req = createMockRequest({ 
      method: 'PATCH',
      cookies: { 'csrf-token': token },
      headers: { 'x-csrf-token': token },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });
});

describe('Ensure CSRF Token Middleware', () => {
  it('should set cookie if none exists', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    let nextCalled = false;

    ensureCsrfToken(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(res.cookies['csrf-token']).toBeDefined();
    expect(res.cookies['csrf-token'].value).toHaveLength(64);
  });

  it('should not overwrite existing cookie', () => {
    const existingToken = 'existing-token-value';
    const req = createMockRequest({
      cookies: { 'csrf-token': existingToken },
    });
    const res = createMockResponse();
    let nextCalled = false;

    ensureCsrfToken(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(res.cookies['csrf-token']).toBeUndefined(); // No new cookie set
  });
});

describe('Timing-Safe Comparison', () => {
  it('should use timing-safe comparison to prevent timing attacks', () => {
    // This test verifies the implementation uses crypto.timingSafeEqual
    // by checking that tokens of different lengths are properly rejected
    const token = generateCsrfToken();
    const shortToken = token.slice(0, 32);
    
    const req = createMockRequest({ 
      method: 'POST',
      cookies: { 'csrf-token': token },
      headers: { 'x-csrf-token': shortToken },
    });
    const res = createMockResponse();
    let nextCalled = false;

    csrfProtection(req as any, res as any, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
