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
import { requireModule, clearModuleCache } from '../../../src/middleware/moduleGuard.middleware';

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

    it('should fail closed when module is not found in database', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const middleware = requireModule('new-feature');
      const { req, res, next } = createMockReqRes({});

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'This feature is currently unavailable',
        code: 'MODULE_DISABLED'
      });
      expect(next).not.toHaveBeenCalled();
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

    it('should block request on database error (fail-closed)', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'NETWORK_ERROR' }))
      } as any);

      const middleware = requireModule('restaurant');
      const { req, res, next } = createMockReqRes({});

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unable to verify module status',
        code: 'MODULE_CHECK_FAILED'
      });
      expect(next).not.toHaveBeenCalled();
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

});

