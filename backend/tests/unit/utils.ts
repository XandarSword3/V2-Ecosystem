import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Recursive Mock Builder for Supabase
export function createChainableMock(returnData: any = null, error: any = null, count: number | null = null) {
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'or',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'rpc', 'csv', 'head'
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
  user?: { id: string; role: string; userId: string };
} = {}) {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user || { id: 'admin-1', role: 'admin', userId: 'admin-1' },
    get: vi.fn(),
    header: vi.fn(),
    cookies: {},
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// Standalone mock functions for individual use
export function mockRequest(options: {
  params?: Record<string, string>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  user?: { userId: string; role: string };
  headers?: Record<string, string>;
  ip?: string;
} = {}): Partial<Request> {
  return {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    user: options.user,
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
