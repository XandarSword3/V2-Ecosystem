import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { getSupabase } from '../../../src/database/connection';
import { requireModule, clearModuleCache, dynamicModuleGuard, moduleRouteMap } from '../../../src/middleware/moduleGuard.middleware';

describe('ModuleGuard Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    clearModuleCache();
  });

  describe('requireModule', () => {
    it('should allow request when module is active', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ is_active: true }))
      } as any);

      const middleware = requireModule('restaurant');
      const { req, res, next } = createMockReqRes({});

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block request when module is disabled', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ is_active: false }))
      } as any);

      const middleware = requireModule('pool');
      const { req, res, next } = createMockReqRes({});
      (req as any).path = '/api/pool/tickets';

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'This feature is currently unavailable',
        code: 'MODULE_DISABLED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should default to active when module not found in database', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const middleware = requireModule('new-feature');
      const { req, res, next } = createMockReqRes({});

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use cached value on subsequent requests', async () => {
      const mockFrom = vi.fn().mockReturnValue(createChainableMock({ is_active: true }));
      vi.mocked(getSupabase).mockReturnValue({ from: mockFrom } as any);

      const middleware = requireModule('restaurant');
      
      const { req: req1, res: res1, next: next1 } = createMockReqRes({});
      await middleware(req1, res1, next1);

      const { req: req2, res: res2, next: next2 } = createMockReqRes({});
      await middleware(req2, res2, next2);

      // Should only call database once due to caching
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });

    it('should allow request on database error (fail-open)', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'NETWORK_ERROR' }))
      } as any);

      const middleware = requireModule('restaurant');
      const { req, res, next } = createMockReqRes({});

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('clearModuleCache', () => {
    it('should clear specific module from cache', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ is_active: true }))
      } as any);

      const middleware = requireModule('restaurant');
      
      const { req: req1, res: res1, next: next1 } = createMockReqRes({});
      await middleware(req1, res1, next1);

      // Clear specific module cache
      clearModuleCache('restaurant');

      const { req: req2, res: res2, next: next2 } = createMockReqRes({});
      await middleware(req2, res2, next2);

      // Database should be called again after cache clear
      expect(getSupabase).toHaveBeenCalled();
    });

    it('should clear all modules from cache when no slug provided', () => {
      // Just verify function doesn't throw
      clearModuleCache();
    });
  });

  describe('dynamicModuleGuard', () => {
    it('should allow request for active module based on path', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ is_active: true }))
      } as any);

      const { req, res, next } = createMockReqRes({});
      (req as any).path = '/restaurant/menu';

      await dynamicModuleGuard(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block request for disabled module based on path', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ is_active: false }))
      } as any);

      // Clear cache to ensure fresh DB call
      clearModuleCache();

      const { req, res, next } = createMockReqRes({});
      (req as any).path = '/pool/tickets';

      await dynamicModuleGuard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request for unmatched path', async () => {
      const { req, res, next } = createMockReqRes({});
      (req as any).path = '/api/admin/settings';

      await dynamicModuleGuard(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('moduleRouteMap', () => {
    it('should have expected module mappings', () => {
      expect(moduleRouteMap).toEqual({
        '/api/restaurant': 'restaurant',
        '/api/pool': 'pool',
        '/api/chalets': 'chalets',
        '/api/snack': 'snack-bar'
      });
    });
  });
});
