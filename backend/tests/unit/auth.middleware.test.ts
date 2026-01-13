import { describe, it, expect, vi } from 'vitest';

// Import the actual middleware functions from source
import {
  authenticate,
  authorize,
  optionalAuth,
} from '../../src/middleware/auth.middleware';
import { generateTokens } from '../../src/modules/auth/auth.utils';

describe('Auth Middleware (Source)', () => {
  const testPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    roles: ['guest', 'user'],
  };

  describe('authenticate', () => {
    it('should return 401 when no authorization header', () => {
      const req = { headers: {} } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No token provided',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      const req = { headers: { authorization: 'Basic token' } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid or expired token',
      }));
    });

    it('should set req.user and call next for valid token', () => {
      const tokens = generateTokens(testPayload);
      const req = { headers: { authorization: `Bearer ${tokens.accessToken}` } } as any;
      const res = {} as any;
      const next = vi.fn();

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(testPayload.userId);
      expect(req.user.email).toBe(testPayload.email);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should return 401 when no user attached to request', () => {
      const authorizeMiddleware = authorize('admin');
      const req = {} as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Not authenticated',
      }));
    });

    it('should return 403 when user does not have required role', () => {
      const authorizeMiddleware = authorize('admin');
      const req = { user: { userId: 'user-1', roles: ['guest'] } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient permissions',
      }));
    });

    it('should call next when user has required role', () => {
      const authorizeMiddleware = authorize('admin');
      const req = { user: { userId: 'user-1', roles: ['admin'] } } as any;
      const res = {} as any;
      const next = vi.fn();

      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next when user is super_admin', () => {
      const authorizeMiddleware = authorize('admin');
      const req = { user: { userId: 'user-1', roles: ['super_admin'] } } as any;
      const res = {} as any;
      const next = vi.fn();

      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept multiple allowed roles', () => {
      const authorizeMiddleware = authorize('admin', 'staff', 'manager');
      const req = { user: { userId: 'user-1', roles: ['staff'] } } as any;
      const res = {} as any;
      const next = vi.fn();

      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next without user when no authorization header', () => {
      const req = { headers: {} } as any;
      const res = {} as any;
      const next = vi.fn();

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set req.user for valid token', () => {
      const tokens = generateTokens(testPayload);
      const req = { headers: { authorization: `Bearer ${tokens.accessToken}` } } as any;
      const res = {} as any;
      const next = vi.fn();

      optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(testPayload.userId);
      expect(next).toHaveBeenCalled();
    });

    it('should call next without user when token is invalid', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } } as any;
      const res = {} as any;
      const next = vi.fn();

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
