import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the cache constants and class from source
import { CacheKeys, CacheTTL } from '../../src/utils/cache';

describe('Cache Module (Source)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CacheKeys', () => {
    it('should have MENU prefix', () => {
      expect(CacheKeys.MENU).toBe('menu:');
    });

    it('should have MENU_ITEM prefix', () => {
      expect(CacheKeys.MENU_ITEM).toBe('menu:item:');
    });

    it('should have MENU_CATEGORY prefix', () => {
      expect(CacheKeys.MENU_CATEGORY).toBe('menu:category:');
    });

    it('should have SETTINGS prefix', () => {
      expect(CacheKeys.SETTINGS).toBe('settings:');
    });

    it('should have SESSION prefix', () => {
      expect(CacheKeys.SESSION).toBe('session:');
    });

    it('should have USER prefix', () => {
      expect(CacheKeys.USER).toBe('user:');
    });

    it('should have RATE_LIMIT prefix', () => {
      expect(CacheKeys.RATE_LIMIT).toBe('rate:');
    });

    it('should have CHALET prefix', () => {
      expect(CacheKeys.CHALET).toBe('chalet:');
    });

    it('should have AVAILABILITY prefix', () => {
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

  describe('Cache key generation patterns', () => {
    it('should generate proper menu key with module id', () => {
      const moduleId = 'mod-123';
      const key = `${CacheKeys.MENU}${moduleId}`;
      expect(key).toBe('menu:mod-123');
    });

    it('should generate proper menu item key', () => {
      const itemId = 'item-456';
      const key = `${CacheKeys.MENU_ITEM}${itemId}`;
      expect(key).toBe('menu:item:item-456');
    });

    it('should generate proper menu category key', () => {
      const categoryId = 'cat-789';
      const key = `${CacheKeys.MENU_CATEGORY}${categoryId}`;
      expect(key).toBe('menu:category:cat-789');
    });

    it('should generate proper settings key', () => {
      const settingKey = 'general';
      const key = `${CacheKeys.SETTINGS}${settingKey}`;
      expect(key).toBe('settings:general');
    });

    it('should generate proper session key', () => {
      const sessionId = 'sess-abc';
      const key = `${CacheKeys.SESSION}${sessionId}`;
      expect(key).toBe('session:sess-abc');
    });

    it('should generate proper user key', () => {
      const userId = 'user-def';
      const key = `${CacheKeys.USER}${userId}`;
      expect(key).toBe('user:user-def');
    });

    it('should generate proper rate limit key', () => {
      const clientIp = '192.168.1.1';
      const key = `${CacheKeys.RATE_LIMIT}${clientIp}`;
      expect(key).toBe('rate:192.168.1.1');
    });

    it('should generate proper chalet key', () => {
      const chaletId = 'chalet-ghi';
      const key = `${CacheKeys.CHALET}${chaletId}`;
      expect(key).toBe('chalet:chalet-ghi');
    });

    it('should generate proper availability key', () => {
      const date = '2024-07-15';
      const key = `${CacheKeys.AVAILABILITY}${date}`;
      expect(key).toBe('availability:2024-07-15');
    });
  });

  describe('Cache wildcard patterns', () => {
    it('should create wildcard pattern for all menus', () => {
      const pattern = `${CacheKeys.MENU}*`;
      expect(pattern).toBe('menu:*');
    });

    it('should create wildcard pattern for all menu items', () => {
      const pattern = `${CacheKeys.MENU_ITEM}*`;
      expect(pattern).toBe('menu:item:*');
    });

    it('should create wildcard pattern for all sessions', () => {
      const pattern = `${CacheKeys.SESSION}*`;
      expect(pattern).toBe('session:*');
    });

    it('should create wildcard pattern for all rate limits', () => {
      const pattern = `${CacheKeys.RATE_LIMIT}*`;
      expect(pattern).toBe('rate:*');
    });
  });

  describe('TTL calculations', () => {
    it('should convert SHORT TTL to minutes correctly', () => {
      const minutes = CacheTTL.SHORT / 60;
      expect(minutes).toBe(1);
    });

    it('should convert MEDIUM TTL to minutes correctly', () => {
      const minutes = CacheTTL.MEDIUM / 60;
      expect(minutes).toBe(5);
    });

    it('should convert LONG TTL to hours correctly', () => {
      const hours = CacheTTL.LONG / 3600;
      expect(hours).toBe(1);
    });

    it('should convert VERY_LONG TTL to days correctly', () => {
      const days = CacheTTL.VERY_LONG / 86400;
      expect(days).toBe(1);
    });

    it('should convert SESSION TTL to days correctly', () => {
      const days = CacheTTL.SESSION / 86400;
      expect(days).toBe(7);
    });
  });
});
