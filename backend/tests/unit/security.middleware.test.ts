/**
 * Security Middleware Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  enhancedSecurityHeaders,
  sanitizeRequest,
  suspiciousRequestDetector,
  requestId,
} from '../../src/middleware/security.middleware.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      path: '/api/test',
      method: 'GET',
      query: {},
      params: {},
      headers: {},
      ip: '127.0.0.1',
    };
    mockRes = {
      setHeader: vi.fn(),
      removeHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('enhancedSecurityHeaders', () => {
    it('should set X-Content-Type-Options header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should set X-Frame-Options header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });

    it('should set X-XSS-Protection header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should set Referrer-Policy header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should set Permissions-Policy header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.stringContaining('camera=()')
      );
    });

    it('should remove X-Powered-By header', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });

    it('should set no-cache headers for auth endpoints', () => {
      mockReq.path = '/api/auth/login';
      
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    });

    it('should set no-cache headers for admin endpoints', () => {
      mockReq.path = '/api/admin/users';
      
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
      );
    });

    it('should call next', () => {
      enhancedSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sanitizeRequest', () => {
    it('should remove null bytes from query parameters', () => {
      mockReq.query = { search: 'test\0value' };
      
      sanitizeRequest(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.query!.search).toBe('testvalue');
    });

    it('should not modify clean query parameters', () => {
      mockReq.query = { search: 'clean value' };
      
      sanitizeRequest(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.query!.search).toBe('clean value');
    });

    it('should call next', () => {
      sanitizeRequest(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('suspiciousRequestDetector', () => {
    it('should detect and block SQL injection patterns in query', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      mockReq.query = { id: "1; DROP TABLE users; --" };
      
      suspiciousRequestDetector(mockReq as Request, mockRes as Response, mockNext);
      
      // Should log warning and block the request
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid request' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should detect and block SELECT FROM patterns', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      mockReq.query = { search: "SELECT * FROM users WHERE 1=1" };
      
      suspiciousRequestDetector(mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow normal requests', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      vi.clearAllMocks();
      
      mockReq.query = { search: 'normal search query' };
      
      suspiciousRequestDetector(mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.warn).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should check params for suspicious patterns and block', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      mockReq.params = { id: "1 UNION SELECT password FROM users" };
      
      suspiciousRequestDetector(mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requestId', () => {
    it('should generate request ID if not provided', () => {
      mockReq.headers = {};
      
      requestId(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId!.length).toBeGreaterThan(0);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-Id', mockReq.requestId);
    });

    it('should use provided X-Request-Id header', () => {
      mockReq.headers = { 'x-request-id': 'existing-request-id' };
      
      requestId(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe('existing-request-id');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-request-id');
    });

    it('should call next', () => {
      requestId(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
