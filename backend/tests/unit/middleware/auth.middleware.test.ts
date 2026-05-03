import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock verifyToken
vi.mock('../../../src/modules/auth/auth.utils', () => ({
  verifyToken: vi.fn()
}));

import { verifyToken } from '../../../src/modules/auth/auth.utils';
import { authenticate, authorize, optionalAuth } from '../../../src/middleware/auth.middleware';

// Mock getSupabase
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../src/database/connection';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', async () => {
      const mockPayload = { userId: 'user-1', roles: ['admin'], tokenVersion: 1 };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

      const mockUser = { id: 'user-1', token_version: 1, is_active: true };
      const supabaseMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer valid-token' };

      await authenticate(req, res, next);

      expect(verifyToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual(expect.objectContaining({ ...mockPayload, id: 'user-1' }));
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without auth header', async () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).headers = {};

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request without Bearer prefix', async () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Basic credentials' };

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });

    it('should reject invalid token', async () => {
      vi.mocked(verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer invalid-token' };

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
    });

    it('should reject stale session (token version mismatch)', async () => {
      const mockPayload = { userId: 'user-1', roles: ['admin'], tokenVersion: 1 };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

      const mockUser = { id: 'user-1', token_version: 2, is_active: true };
      const supabaseMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer stale-token' };

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session expired, please log in again'
      });
    });

    it('should reject deactivated account', async () => {
      const mockPayload = { userId: 'user-1', roles: ['admin'], tokenVersion: 1 };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

      const mockUser = { id: 'user-1', token_version: 1, is_active: false };
      const supabaseMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      };
      vi.mocked(getSupabase).mockReturnValue(supabaseMock as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).headers = { authorization: 'Bearer deactivated-token' };

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Account deactivated'
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

      expect(req.user).toEqual(expect.objectContaining(mockPayload));
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
