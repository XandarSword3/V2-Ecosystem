import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Import the actual middleware functions
import { normalizeBody } from '../../src/middleware/normalizeBody.middleware';
import { requestIdMiddleware, getRequestId } from '../../src/middleware/requestId.middleware';

describe('normalizeBody Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = vi.fn();
  });

  it('should call next', () => {
    normalizeBody(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should normalize snake_case to camelCase', () => {
    req.body = { user_name: 'john', user_email: 'john@example.com' };
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body.userName).toBe('john');
    expect(req.body.userEmail).toBe('john@example.com');
    // Original keys should still exist
    expect(req.body.user_name).toBe('john');
    expect(next).toHaveBeenCalled();
  });

  it('should normalize camelCase to snake_case', () => {
    req.body = { userName: 'jane', userEmail: 'jane@example.com' };
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body.user_name).toBe('jane');
    expect(req.body.user_email).toBe('jane@example.com');
    // Original keys should still exist
    expect(req.body.userName).toBe('jane');
    expect(next).toHaveBeenCalled();
  });

  it('should handle empty body', () => {
    req.body = {};
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('should not modify non-object bodies', () => {
    req.body = 'string body';
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body).toBe('string body');
    expect(next).toHaveBeenCalled();
  });

  it('should not modify array bodies', () => {
    req.body = [1, 2, 3];
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body).toEqual([1, 2, 3]);
    expect(next).toHaveBeenCalled();
  });

  it('should handle null body', () => {
    req.body = null;
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('should handle undefined body', () => {
    req.body = undefined;
    
    normalizeBody(req as Request, res as Response, next);
    
    expect(req.body).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('requestIdMiddleware', () => {
  let req: Partial<Request> & { requestId?: string };
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { 
      headers: {},
      requestId: undefined
    };
    res = { 
      setHeader: vi.fn() 
    };
    next = vi.fn();
  });

  it('should generate a UUID if no X-Request-ID header', () => {
    requestIdMiddleware(req as Request, res as Response, next);
    
    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(next).toHaveBeenCalled();
  });

  it('should use existing X-Request-ID header if provided', () => {
    req.headers = { 'x-request-id': 'custom-request-id-123' };
    
    requestIdMiddleware(req as Request, res as Response, next);
    
    expect(req.requestId).toBe('custom-request-id-123');
    expect(next).toHaveBeenCalled();
  });

  it('should set X-Request-ID response header', () => {
    requestIdMiddleware(req as Request, res as Response, next);
    
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
  });

  it('should set response header to match request ID', () => {
    req.headers = { 'x-request-id': 'my-request-id' };
    
    requestIdMiddleware(req as Request, res as Response, next);
    
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'my-request-id');
  });
});

describe('getRequestId Helper', () => {
  it('should return request ID when present', () => {
    const req = { requestId: 'test-id-123' } as Request;
    
    expect(getRequestId(req)).toBe('test-id-123');
  });

  it('should return placeholder when request ID is missing', () => {
    const req = {} as Request;
    
    expect(getRequestId(req)).toBe('no-request-id');
  });

  it('should return placeholder when request ID is undefined', () => {
    const req = { requestId: undefined } as unknown as Request;
    
    expect(getRequestId(req)).toBe('no-request-id');
  });

  it('should return placeholder when request ID is empty string', () => {
    const req = { requestId: '' } as Request;
    
    expect(getRequestId(req)).toBe('no-request-id');
  });
});
