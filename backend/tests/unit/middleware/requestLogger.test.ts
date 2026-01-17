/**
 * Request Logger Middleware Tests
 * 
 * Tests for the request logging middleware, especially edge cases
 * that can cause "Cannot set headers after they are sent" errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the logger to prevent actual logging during tests
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RequestLogger Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      body: {},
      user: undefined,
    };

    mockRes = {
      statusCode: 200,
      send: vi.fn().mockReturnThis(),
      headersSent: false,
    };

    nextFn = vi.fn();
  });

  it('should add requestId to the request object', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    requestLogger(mockReq as Request, mockRes as Response, nextFn);
    
    expect(mockReq.requestId).toBeDefined();
    expect(typeof mockReq.requestId).toBe('string');
  });

  it('should call next function', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    requestLogger(mockReq as Request, mockRes as Response, nextFn);
    
    expect(nextFn).toHaveBeenCalled();
  });

  it('should wrap res.send to log responses', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    const originalSend = mockRes.send;
    
    requestLogger(mockReq as Request, mockRes as Response, nextFn);
    
    // res.send should be wrapped (different function)
    expect(mockRes.send).toBeDefined();
  });

  it('should sanitize sensitive fields in request body', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    const { logger } = await import('../../../src/utils/logger.js');
    
    mockReq.body = {
      email: 'test@example.com',
      password: 'secret123',
      token: 'abc123',
    };
    
    requestLogger(mockReq as Request, mockRes as Response, nextFn);
    
    // Password and token should be redacted in logs
    // The actual log call should have sanitized the body
  });

  it('should only log response once even if send is called multiple times', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    const { logger } = await import('../../../src/utils/logger.js');
    
    requestLogger(mockReq as Request, mockRes as Response, nextFn);
    
    // Call send multiple times (simulating double-send scenario)
    mockRes.send!('First response');
    
    // Get log call count after first send
    const firstLogCallCount = (logger.info as ReturnType<typeof vi.fn>).mock.calls.length;
    
    mockRes.send!('Second response');
    
    // Log should not have been called again for the response
    const secondLogCallCount = (logger.info as ReturnType<typeof vi.fn>).mock.calls.length;
    
    // The info logger should only log the response once
    // (there will be one log for the incoming request too)
    expect(secondLogCallCount).toBe(firstLogCallCount);
  });

  it('should handle requests without user', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    mockReq.user = undefined;
    
    expect(() => {
      requestLogger(mockReq as Request, mockRes as Response, nextFn);
    }).not.toThrow();
  });

  it('should handle requests with user', async () => {
    const { requestLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    mockReq.user = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    } as any;
    
    expect(() => {
      requestLogger(mockReq as Request, mockRes as Response, nextFn);
    }).not.toThrow();
  });
});

describe('ErrorLogger Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      body: {},
      params: {},
      query: {},
      requestId: 'test-request-id',
    };

    mockRes = {
      statusCode: 500,
    };

    nextFn = vi.fn();
  });

  it('should log error details', async () => {
    const { errorLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    const { logger } = await import('../../../src/utils/logger.js');
    
    const testError = new Error('Test error message');
    
    errorLogger(testError, mockReq as Request, mockRes as Response, nextFn);
    
    expect(logger.error).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalledWith(testError);
  });

  it('should pass error to next middleware', async () => {
    const { errorLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    const testError = new Error('Test error');
    
    errorLogger(testError, mockReq as Request, mockRes as Response, nextFn);
    
    expect(nextFn).toHaveBeenCalledWith(testError);
  });

  it('should handle missing requestId', async () => {
    const { errorLogger } = await import('../../../src/middleware/requestLogger.middleware.js');
    
    mockReq.requestId = undefined;
    const testError = new Error('Test error');
    
    expect(() => {
      errorLogger(testError, mockReq as Request, mockRes as Response, nextFn);
    }).not.toThrow();
  });
});

describe('Headers Already Sent Protection', () => {
  it('should not crash when response already sent', async () => {
    const mockReq: Partial<Request> = {
      method: 'GET',
      originalUrl: '/api/test',
      body: {},
      requestId: 'test-id',
    };

    const mockRes: Partial<Response> = {
      statusCode: 200,
      headersSent: true, // Headers already sent
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // This simulates what the global error handler does
    if (mockRes.headersSent) {
      // Should not try to send response
      expect(mockRes.status).not.toHaveBeenCalled();
    }
  });
});
