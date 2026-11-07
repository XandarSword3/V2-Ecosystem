import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { RateLimiterService, rateLimiter } from '../../../src/services/rate-limiter.service';

// Helper to create mock request/response
function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    ip: '127.0.0.1',
    path: '/api/test',
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RateLimiterService();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const limiter = new RateLimiterService();
      expect(limiter).toBeInstanceOf(RateLimiterService);
    });

    it('should create with custom config', () => {
      const limiter = new RateLimiterService(undefined, {
        windowMs: 30000,
        maxRequests: 50,
        message: 'Custom message',
      });
      expect(limiter).toBeInstanceOf(RateLimiterService);
    });
  });

  describe('checkLimit', () => {
    it('should allow request when under limit', async () => {
      const req = createMockReq() as Request;
      
      const result = await service.checkLimit(req);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.limit).toBeGreaterThan(0);
    });

    it('should apply tier multiplier for authenticated users', async () => {
      const req = createMockReq({
        user: { id: 'user-1', roles: ['admin'] },
      } as any) as Request;
      
      const result = await service.checkLimit(req);
      
      // Admin gets 5x multiplier (100 * 5 = 500)
      expect(result.limit).toBe(500);
    });

    it('should apply customer tier multiplier', async () => {
      const req = createMockReq({
        user: { id: 'user-1', role: 'customer' },
      } as any) as Request;
      
      const result = await service.checkLimit(req);
      
      // Customer gets 1.5x multiplier (100 * 1.5 = 150)
      expect(result.limit).toBe(150);
    });

    it('should apply stricter limits for auth endpoints', async () => {
      const req = createMockReq({ path: '/api/auth/login' }) as Request;
      
      const result = await service.checkLimit(req);
      
      // Auth login has 5 max requests
      expect(result.limit).toBe(5);
    });

    it('should apply stricter limits for register endpoint', async () => {
      const req = createMockReq({ path: '/api/auth/register' }) as Request;
      
      const result = await service.checkLimit(req);
      
      expect(result.limit).toBe(3);
    });

    it('should use higher limits for admin endpoints', async () => {
      const req = createMockReq({ path: '/api/admin/users' }) as Request;
      
      const result = await service.checkLimit(req);
      
      expect(result.limit).toBe(200);
    });

    it('should decrement tokens on each request', async () => {
      const req = createMockReq({ path: '/api/test' }) as Request;
      
      const result1 = await service.checkLimit(req);
      const result2 = await service.checkLimit(req);
      
      expect(result2.remaining).toBeLessThan(result1.remaining);
    });

    it('should normalize UUIDs in path', async () => {
      const req1 = createMockReq({ 
        path: '/api/users/550e8400-e29b-41d4-a716-446655440000' 
      }) as Request;
      const req2 = createMockReq({ 
        path: '/api/users/660e8400-e29b-41d4-a716-446655440001' 
      }) as Request;
      
      // Both should be treated as same endpoint pattern
      await service.checkLimit(req1);
      const result = await service.checkLimit(req2);
      
      // Second request should still be allowed (same rate limit bucket)
      expect(result.allowed).toBe(true);
    });
  });

  describe('middleware', () => {
    it('should allow request and set headers', async () => {
      const middleware = service.middleware();
      const req = createMockReq() as Request;
      const res = createMockRes() as Response;
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
      expect(next).toHaveBeenCalled();
    });

    it('should block request when limit exceeded', async () => {
      // Use custom key generator to ensure isolated bucket
      const strictService = new RateLimiterService(undefined, {
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'test-strict-bucket',
      });

      const middleware = strictService.middleware();
      const req = createMockReq({ path: '/custom/strictly-limited' }) as Request;

      // First request consumes the 1 token
      const res1 = createMockRes() as Response;
      const next1 = vi.fn();
      await middleware(req, res1, next1);
      expect(next1).toHaveBeenCalled();

      // Second request immediately exceeds the 1-request token bucket
      const res2 = createMockRes() as Response;
      const next2 = vi.fn();
      await middleware(req, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(429);
      expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Too many requests'),
      }));
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('checkSlidingWindow', () => {
    it('should allow requests within limit', async () => {
      const result = await service.checkSlidingWindow('test-key', 60000, 10);
      
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should increment counter', async () => {
      await service.checkSlidingWindow('test-key-2', 60000, 10);
      const result = await service.checkSlidingWindow('test-key-2', 60000, 10);
      
      expect(result.count).toBe(2);
    });
  });

  describe('recordViolation and isIPBlocked', () => {
    it('should not block IP on first violation', async () => {
      await service.recordViolation('192.168.1.1');
      
      expect(service.isIPBlocked('192.168.1.1')).toBe(false);
    });

    it('should block IP after 10 violations', async () => {
      const ip = '192.168.1.100';
      
      for (let i = 0; i < 10; i++) {
        await service.recordViolation(ip);
      }
      
      expect(service.isIPBlocked(ip)).toBe(true);
    });

    it('should return false for non-blocked IP', () => {
      expect(service.isIPBlocked('10.0.0.1')).toBe(false);
    });
  });

  describe('ddosProtection', () => {
    it('should allow normal request rate', () => {
      const middleware = service.ddosProtection();
      const req = createMockReq() as Request;
      const res = createMockRes() as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block blocked IPs', async () => {
      const ip = '192.168.100.100';
      
      // Block the IP first
      for (let i = 0; i < 10; i++) {
        await service.recordViolation(ip);
      }

      const middleware = service.ddosProtection();
      const req = createMockReq({ ip }) as Request;
      const res = createMockRes() as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('blocked'),
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('exported instances', () => {
    it('should export default rateLimiter', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiterService);
    });
  });
});
