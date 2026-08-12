import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Recursive Mock Builder for Supabase
export function createChainableMock(returnData: any = null, error: any = null, count: number | null = null) {
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'or', 'not', 'filter',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'rpc', 'csv', 'head', 'throwOnError'
  ];
  const mock: any = {};
  
  methods.forEach(method => {
    mock[method] = vi.fn().mockReturnThis();
  });

  // Make it thenable to act as a Promise
  mock.then = (resolve: any, reject: any) => {
    if (error) {
       resolve({ data: null, error, count }); 
    } else {
       resolve({ data: returnData, error: null, count });
    }
  };

  return mock;
}

// Helper to create mock request/response
export function createMockReqRes(options: { 
  params?: Record<string, string>; 
  query?: Record<string, any>; 
  body?: Record<string, any>;
  user?: { id: string; role: string; userId: string; tenantId?: string; scope?: string };
  headers?: Record<string, string>;
  propertyId?: string;
} = {}) {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    // tenantId/scope: needed by security/tenant-scope.ts's getCallerTenantId
    // and requireTenantScope, used for cross-tenant IDOR checks in
    // roles/permissions controllers. Defaults model a normal tenant-scoped
    // admin (tenant_admin maps to the 'admin' role, matching the default
    // role below) — tests exercising a specific tenant mismatch or a
    // genuinely-unscoped platform admin should override explicitly.
    user: options.user || { id: 'admin-1', role: 'admin', userId: 'admin-1', tenantId: 'tenant-1', scope: 'tenant_admin' },
    headers: options.headers || {},
    get: vi.fn((name: string) => (options.headers || {})[name?.toLowerCase()]),
    header: vi.fn((name: string) => (options.headers || {})[name?.toLowerCase()]),
    cookies: {},
    // propertyId: set by validatePropertyAccess in the real request chain
    // (see propertyAccess.middleware.ts). Admin controllers for gift cards,
    // coupons, and reviews now require this via requirePropertyId. Left
    // undefined by default — not every controller path is admin-only, and
    // some (e.g. reviews.controller.ts's createReview) branch on whether a
    // property context exists at all, so silently defaulting it here would
    // change behavior for tests that aren't about property scoping. Pass
    // `propertyId: 'property-1'` (or similar) explicitly in tests that
    // exercise an admin endpoint.
    propertyId: options.propertyId,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    set: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// Standalone mock functions for individual use
export function mockRequest(options: {
  params?: Record<string, string>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  user?: { userId: string; role: string; tenantId?: string; scope?: string };
  headers?: Record<string, string>;
  ip?: string;
} = {}): Partial<Request> {
  return {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    // tenantId/scope default to a normal tenant-scoped staff/admin caller —
    // needed by security/tenant-scope.ts's getCallerTenantId (used by
    // getScopedClient) for the payments-module cross-tenant fixes. Tests
    // exercising a specific tenant mismatch or an unauthenticated caller
    // should still pass `user: undefined` or their own object explicitly.
    user: 'user' in options ? options.user : { userId: 'staff-123', role: 'staff', tenantId: 'tenant-1', scope: 'tenant_admin' },
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1',
    get: vi.fn((header: string) => (options.headers || {})[header.toLowerCase()]),
    header: vi.fn((header: string) => (options.headers || {})[header.toLowerCase()]),
    cookies: {},
  } as Partial<Request>;
}

export function mockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

export function mockNext(): ReturnType<typeof vi.fn> {
  return vi.fn();
}
