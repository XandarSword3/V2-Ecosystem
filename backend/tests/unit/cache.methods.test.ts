
// Mock ioredis before importing cache
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    quit: vi.fn(),
    connect: vi.fn(),
    on: vi.fn()
  };
  
  return {
    default: vi.fn(() => mockRedis)
  };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config
vi.mock('../../src/config/index', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' }
  }
}));

// Reset modules to get fresh instance
beforeEach(() => {
  vi.resetModules();
});

describe('Cache - RedisCache Class Methods', () => {
  describe('when Redis is not available', () => {
    it('get should return null when cache unavailable', async () => {
      // Clear REDIS_URL to simulate no Redis
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.get('test-key');
      
      expect(result).toBeNull();
      
      process.env.REDIS_URL = originalUrl;
    });

    it('set should return false when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.set('test-key', { data: 'test' });
      
      expect(result).toBe(false);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('del should return false when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.del('test-key');
      
      expect(result).toBe(false);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('delPattern should return 0 when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.delPattern('test:*');
      
      expect(result).toBe(0);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('incr should return 0 when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.incr('counter');
      
      expect(result).toBe(0);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('exists should return false when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.exists('test-key');
      
      expect(result).toBe(false);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('expire should return false when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.expire('test-key', 60);
      
      expect(result).toBe(false);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('ttl should return -1 when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.ttl('test-key');
      
      expect(result).toBe(-1);
      
      process.env.REDIS_URL = originalUrl;
    });

    it('isAvailable should return false when not connected', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      expect(cache.isAvailable()).toBe(false);
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('getOrSet', () => {
    it('should call fetcher when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
      
      const result = await cache.getOrSet('test-key', fetcher);
      
      expect(fetcher).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fresh' });
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('acquireLock', () => {
    it('should return true when Redis unavailable (fail open)', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      const result = await cache.acquireLock('lock-key');
      
      expect(result).toBe(true);
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('releaseLock', () => {
    it('should not throw when Redis unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      
      await expect(cache.releaseLock('lock-key')).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cache } = await import('../../src/utils/cache');
      
      await expect(cache.disconnect()).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });
});

describe('Cache - Convenience Functions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('checkRateLimit', () => {
    it('should return allowed=true when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { checkRateLimit } = await import('../../src/utils/cache');
      const result = await checkRateLimit('user-123', 100, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
      expect(result.resetIn).toBe(0);
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('cacheMenuItems', () => {
    it('should not throw when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cacheMenuItems } = await import('../../src/utils/cache');
      
      await expect(cacheMenuItems([{ id: 1, name: 'Pizza' }])).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });

    it('should handle module-specific cache key', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cacheMenuItems } = await import('../../src/utils/cache');
      
      await expect(cacheMenuItems([{ id: 1 }], 'menu_service')).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('getCachedMenuItems', () => {
    it('should return null when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { getCachedMenuItems } = await import('../../src/utils/cache');
      const result = await getCachedMenuItems();
      
      expect(result).toBeNull();
      
      process.env.REDIS_URL = originalUrl;
    });

    it('should handle module-specific cache key', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { getCachedMenuItems } = await import('../../src/utils/cache');
      const result = await getCachedMenuItems('menu_service');
      
      expect(result).toBeNull();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('invalidateMenuCache', () => {
    it('should not throw when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { invalidateMenuCache } = await import('../../src/utils/cache');
      
      await expect(invalidateMenuCache()).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });

    it('should handle module-specific invalidation', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { invalidateMenuCache } = await import('../../src/utils/cache');
      
      await expect(invalidateMenuCache('menu_service')).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('cacheSettings', () => {
    it('should not throw when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cacheSettings } = await import('../../src/utils/cache');
      
      await expect(cacheSettings('general', { theme: 'dark' })).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('getCachedSettings', () => {
    it('should return null when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { getCachedSettings } = await import('../../src/utils/cache');
      const result = await getCachedSettings('general');
      
      expect(result).toBeNull();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('cacheUserSession', () => {
    it('should not throw when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { cacheUserSession } = await import('../../src/utils/cache');
      
      await expect(cacheUserSession('user-123', { role: 'admin' })).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('getCachedUserSession', () => {
    it('should return null when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { getCachedUserSession } = await import('../../src/utils/cache');
      const result = await getCachedUserSession('user-123');
      
      expect(result).toBeNull();
      
      process.env.REDIS_URL = originalUrl;
    });
  });

  describe('invalidateUserSession', () => {
    it('should not throw when cache unavailable', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      
      const { invalidateUserSession } = await import('../../src/utils/cache');
      
      await expect(invalidateUserSession('user-123')).resolves.toBeUndefined();
      
      process.env.REDIS_URL = originalUrl;
    });
  });
});
