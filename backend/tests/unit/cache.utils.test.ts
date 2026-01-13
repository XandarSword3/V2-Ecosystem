import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheKeys, CacheTTL } from '../../src/utils/cache';

describe('Cache Utils - Constants', () => {
  describe('CacheKeys', () => {
    it('should have correct MENU prefix', () => {
      expect(CacheKeys.MENU).toBe('menu:');
    });

    it('should have correct MENU_ITEM prefix', () => {
      expect(CacheKeys.MENU_ITEM).toBe('menu:item:');
    });

    it('should have correct MENU_CATEGORY prefix', () => {
      expect(CacheKeys.MENU_CATEGORY).toBe('menu:category:');
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

    it('should have correct CHALET prefix', () => {
      expect(CacheKeys.CHALET).toBe('chalet:');
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
    it('should generate proper menu key with module id', () => {
      const moduleId = 'restaurant';
      const key = `${CacheKeys.MENU}${moduleId}:items`;
      expect(key).toBe('menu:restaurant:items');
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

    it('should generate proper chalet key', () => {
      const chaletId = 'chalet-456';
      const key = `${CacheKeys.CHALET}${chaletId}`;
      expect(key).toBe('chalet:chalet-456');
    });

    it('should generate proper availability key', () => {
      const date = '2024-01-15';
      const key = `${CacheKeys.AVAILABILITY}${date}`;
      expect(key).toBe('availability:2024-01-15');
    });
  });
});

describe('Cache Pattern Utilities', () => {
  it('should create wildcard pattern for menu cache', () => {
    const pattern = `${CacheKeys.MENU}*`;
    expect(pattern).toBe('menu:*');
  });

  it('should create specific pattern for module menu', () => {
    const moduleId = 'restaurant';
    const pattern = `${CacheKeys.MENU}${moduleId}:*`;
    expect(pattern).toBe('menu:restaurant:*');
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
