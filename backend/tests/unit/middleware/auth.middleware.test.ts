import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock verifyToken
vi.mock('../../../src/modules/auth/auth.utils', () => ({
  verifyToken: vi.fn()
}));

import { verifyToken } from '../../../src/modules/auth/auth.utils';
import { authenticate, authorize, optionalAuth } from '../../../src/middleware/auth.middleware';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', () => {
      const mockPayload = { userId: 'user-1', roles: ['admin'] };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer valid-token' };

      authenticate(req, res, next);

      expect(verifyToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without auth header', () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).headers = {};

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request without Bearer prefix', () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Basic credentials' };

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });

    it('should reject invalid token', () => {
      vi.mocked(verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer invalid-token' };

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
    });
  });

  describe('authorize', () => {
    it('should allow user with matching role', () => {
      const middleware = authorize('admin', 'staff');

      const { req, res, next } = createMockReqRes({});
      req.user = { userId: 'user-1', roles: ['admin'] } as any;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow super_admin regardless of required roles', () => {
      const middleware = authorize('some_special_role');

      const { req, res, next } = createMockReqRes({});
      req.user = { userId: 'user-1', roles: ['super_admin'] } as any;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      const middleware = authorize('admin');

      const { req, res, next } = createMockReqRes({});
      req.user = { userId: 'user-1', roles: ['customer'] } as any;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions'
      });
    });

    it('should reject unauthenticated request', () => {
      const middleware = authorize('admin');

      const { req, res, next } = createMockReqRes({});
      (req as any).user = undefined;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authenticated'
      });
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', () => {
      const mockPayload = { userId: 'user-1', roles: ['customer'] };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer valid-token' };
      (req as any).user = undefined;

      optionalAuth(req, res, next);

      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user if no token', () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).headers = {};
      (req as any).user = undefined;

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user if token invalid', () => {
      vi.mocked(verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer invalid-token' };
      (req as any).user = undefined;

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
