import { createMockReqRes, createChainableMock } from '../utils';

// Mock getSupabase
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../src/database/connection';
import {
  validatePropertyAccess,
  requirePropertyAccess,
  requireModulePropertyAccess
} from '../../../src/middleware/propertyAccess.middleware';

describe('Property Access Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePropertyAccess', () => {
    it('should bypass check if x-property-id header is missing', async () => {
      const { req, res, next } = createMockReqRes({
        headers: {}
      });

      await validatePropertyAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should ignore invalid x-property-id format and call next (graceful fallback)', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'invalid-uuid-format' }
      });

      await validatePropertyAccess(req, res, next);

      // Middleware intentionally ignores malformed headers instead of blocking
      // (PWA service workers may send stale/placeholder values)
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('should bypass check if user is super_admin', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      req.user!.roles = ['super_admin'];

      await validatePropertyAccess(req, res, next);

      expect((req as any).propertyId).toBe(propertyId);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if req.user is missing', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId }
      });
      (req as any).user = undefined;

      await validatePropertyAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required for property access'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access if user_property_access table is empty (backward compatibility)', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_property_access') {
          // Mock count check to return 0
          return createChainableMock(null, null, 0);
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await validatePropertyAccess(req, res, next);

      expect((req as any).propertyId).toBe(propertyId);
      expect(next).toHaveBeenCalled();
    });

    it('should allow access if user has direct access entry', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_property_access') {
          // Count check returns non-zero, direct query returns matching access row
          const queryMock = createChainableMock([{ id: 'access-1' }], null, 5);
          return queryMock;
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await validatePropertyAccess(req, res, next);

      expect((req as any).propertyId).toBe(propertyId);
      expect(next).toHaveBeenCalled();
    });

    it('should allow access if user has group hierarchy access', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_property_access') {
          // count returns 5, directAccess returns empty list (no direct access)
          return createChainableMock([], null, 5);
        }
        if (table === 'user_group_access') {
          return createChainableMock([{ id: 'group-entry-1', group_id: 'group-1' }]);
        }
        if (table === 'properties') {
          return createChainableMock([{ id: propertyId }]);
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await validatePropertyAccess(req, res, next);

      expect((req as any).propertyId).toBe(propertyId);
      expect(next).toHaveBeenCalled();
    });

    it('should deny access if user has no direct or group access', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': propertyId },
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_property_access') {
          return createChainableMock([], null, 5);
        }
        if (table === 'user_group_access') {
          return createChainableMock([]);
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await validatePropertyAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied for this property'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requirePropertyAccess', () => {
    it('should bypass if propertyId is empty', async () => {
      const middleware = requirePropertyAccess('');
      const { req, res, next } = createMockReqRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      const middleware = requirePropertyAccess('some-property');
      const { req, res, next } = createMockReqRes({});
      (req as any).user = undefined;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow super_admin', async () => {
      const middleware = requirePropertyAccess('some-property');
      const { req, res, next } = createMockReqRes({
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });
      req.user!.roles = ['super_admin'];

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow authorized user', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const middleware = requirePropertyAccess(propertyId);
      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation(() => {
        return createChainableMock(null, null, 0); // Empty access table
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny unauthorized user', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const middleware = requirePropertyAccess(propertyId);
      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_property_access') {
          return createChainableMock([], null, 5);
        }
        return createChainableMock([]);
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireModulePropertyAccess', () => {
    it('should return 401 if user is not authenticated', async () => {
      const middleware = requireModulePropertyAccess('restaurant');
      const { req, res, next } = createMockReqRes({});
      (req as any).user = undefined;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 if module lookup fails', async () => {
      const middleware = requireModulePropertyAccess('restaurant');
      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation(() => {
        return createChainableMock(null, new Error('Database lookup error'));
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });

    it('should bypass if module has no property scoping', async () => {
      const middleware = requireModulePropertyAccess('restaurant');
      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation(() => {
        return createChainableMock({ property_id: null });
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow if user has access to module property', async () => {
      const propertyId = '12345678-1234-4567-a123-1234567890ab';
      const middleware = requireModulePropertyAccess('restaurant');
      const { req, res, next } = createMockReqRes({
        user: { id: 'user-1', role: 'staff', userId: 'user-1' }
      });

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'modules') {
          return createChainableMock({ property_id: propertyId });
        }
        if (table === 'user_property_access') {
          return createChainableMock(null, null, 0); // Empty access count => allows access
        }
        return createChainableMock([]);
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
