import { CacheKeys, CacheTTL } from '../../src/utils/cache';

describe('Cache Utils - Constants', () => {
  describe('CacheKeys', () => {
    it('should have correct CATALOG prefix', () => {
      expect(CacheKeys.CATALOG).toBe('catalog:');
    });

    it('should have correct CATALOG_ITEM prefix', () => {
      expect(CacheKeys.CATALOG_ITEM).toBe('catalog:item:');
    });

    it('should have correct CATALOG_CATEGORY prefix', () => {
      expect(CacheKeys.CATALOG_CATEGORY).toBe('catalog:category:');
    });

    it('should have correct SETTINGS prefix', () => {
      expect(CacheKeys.SETTINGS).toBe('settings:');
    });

    it('should have correct SESSION prefix', () => {
      expect(CacheKeys.SESSION).toBe('session:');
    });

    it('should have correct USER prefix', () => {
      expect(CacheKeys.USER).toBe('user:');
    });

    it('should have correct RATE_LIMIT prefix', () => {
      expect(CacheKeys.RATE_LIMIT).toBe('rate:');
    });

    it('should have correct UNIT prefix', () => {
      expect(CacheKeys.UNIT).toBe('unit:');
    });

    it('should have correct AVAILABILITY prefix', () => {
      expect(CacheKeys.AVAILABILITY).toBe('availability:');
    });
  });

  describe('CacheTTL', () => {
    it('should have SHORT TTL of 60 seconds', () => {
      expect(CacheTTL.SHORT).toBe(60);
    });

    it('should have MEDIUM TTL of 300 seconds (5 minutes)', () => {
      expect(CacheTTL.MEDIUM).toBe(300);
    });

    it('should have LONG TTL of 3600 seconds (1 hour)', () => {
      expect(CacheTTL.LONG).toBe(3600);
    });

    it('should have VERY_LONG TTL of 86400 seconds (24 hours)', () => {
      expect(CacheTTL.VERY_LONG).toBe(86400);
    });

    it('should have SESSION TTL of 604800 seconds (7 days)', () => {
      expect(CacheTTL.SESSION).toBe(604800);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate proper catalog key with module id', () => {
      const moduleId = 'menu_service';
      const key = `${CacheKeys.CATALOG}${moduleId}:items`;
      expect(key).toBe('catalog:menu_service:items');
    });

    it('should generate proper settings key', () => {
      const settingKey = 'general';
      const key = `${CacheKeys.SETTINGS}${settingKey}`;
      expect(key).toBe('settings:general');
    });

    it('should generate proper session key', () => {
      const userId = 'user-123';
      const key = `${CacheKeys.SESSION}${userId}`;
      expect(key).toBe('session:user-123');
    });

    it('should generate proper rate limit key', () => {
      const identifier = 'ip:192.168.1.1';
      const key = `${CacheKeys.RATE_LIMIT}${identifier}`;
      expect(key).toBe('rate:ip:192.168.1.1');
    });

    it('should generate proper accommodation unit key', () => {
      const unitId = 'unit-456';
      const key = `${CacheKeys.UNIT}${unitId}`;
      expect(key).toBe('unit:unit-456');
    });

    it('should generate proper availability key', () => {
      const date = '2024-01-15';
      const key = `${CacheKeys.AVAILABILITY}${date}`;
      expect(key).toBe('availability:2024-01-15');
    });
  });
});

describe('Cache Pattern Utilities', () => {
  it('should create wildcard pattern for catalog cache', () => {
    const pattern = `${CacheKeys.CATALOG}*`;
    expect(pattern).toBe('catalog:*');
  });

  it('should create specific pattern for module catalog', () => {
    const moduleId = 'menu_service';
    const pattern = `${CacheKeys.CATALOG}${moduleId}:*`;
    expect(pattern).toBe('catalog:menu_service:*');
  });

  it('should create pattern for user sessions', () => {
    const pattern = `${CacheKeys.SESSION}*`;
    expect(pattern).toBe('session:*');
  });

  it('should create pattern for rate limiting by type', () => {
    const type = 'api';
    const pattern = `${CacheKeys.RATE_LIMIT}${type}:*`;
    expect(pattern).toBe('rate:api:*');
  });
});
