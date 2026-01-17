import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock cache
vi.mock('../../../src/utils/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { cache } from '../../../src/utils/cache.js';
import { userRateLimit, rateLimits } from '../../../src/middleware/userRateLimit.middleware';

describe('UserRateLimit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('userRateLimit', () => {
    it('should allow first request', async () => {
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(cache.set).mockResolvedValue(undefined);

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer', id: 'user-1' }
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    });

    it('should track request count', async () => {
      const now = Date.now();
      vi.mocked(cache.get).mockResolvedValue({
        count: 5,
        resetTime: now + 30000
      });
      vi.mocked(cache.set).mockResolvedValue(undefined);

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer', id: 'user-1' }
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });

    it('should block when rate limit exceeded', async () => {
      const now = Date.now();
      vi.mocked(cache.get).mockResolvedValue({
        count: 15,
        resetTime: now + 30000
      });

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10,
        message: 'Too many requests'
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer', id: 'user-1' }
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Too many requests'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should use IP when user not authenticated', async () => {
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(cache.set).mockResolvedValue(undefined);

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'rate:'
      });

      const { req, res, next } = createMockReqRes({});
      (req as any).user = undefined;
      (req as any).ip = '192.168.1.1';

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // The cache key should include the IP
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1'),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should skip rate limiting on Redis error', async () => {
      vi.mocked(cache.get).mockRejectedValue(new Error('Redis unavailable'));

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer', id: 'user-1' }
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should start new window when reset time passed', async () => {
      const now = Date.now();
      vi.mocked(cache.get).mockResolvedValue({
        count: 100,
        resetTime: now - 1000 // Window expired
      });
      vi.mocked(cache.set).mockResolvedValue(undefined);

      const middleware = userRateLimit({
        windowMs: 60000,
        maxRequests: 10
      });

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer', id: 'user-1' }
      });

      await middleware(req, res, next);

      // Should allow request (new window starts at count 1)
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    });
  });

  describe('rateLimits presets', () => {
    it('should have standard preset', () => {
      expect(rateLimits.standard).toBeDefined();
      expect(typeof rateLimits.standard).toBe('function');
    });

    it('should have expensive preset', () => {
      expect(rateLimits.expensive).toBeDefined();
      expect(typeof rateLimits.expensive).toBe('function');
    });

    it('should have sensitive preset', () => {
      expect(rateLimits.sensitive).toBeDefined();
      expect(typeof rateLimits.sensitive).toBe('function');
    });

    it('should have write preset', () => {
      expect(rateLimits.write).toBeDefined();
      expect(typeof rateLimits.write).toBe('function');
    });
  });
});
