/**
 * Redis Cache Service
 * 
 * Provides caching functionality using Redis for:
 * - Menu items
 * - User sessions
 * - Settings
 * - Rate limiting
 * 
 * Falls back gracefully if Redis is unavailable.
 */

import Redis from 'ioredis';
import { logger } from './logger.js';
import { config } from '../config/index.js';

// Cache key prefixes for organization
export const CacheKeys = {
  MENU: 'menu:',
  MENU_ITEM: 'menu:item:',
  MENU_CATEGORY: 'menu:category:',
  SETTINGS: 'settings:',
  SESSION: 'session:',
  USER: 'user:',
  RATE_LIMIT: 'rate:',
  CHALET: 'chalet:',
  AVAILABILITY: 'availability:'
} as const;

// Default TTLs in seconds
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  VERY_LONG: 86400,    // 24 hours
  SESSION: 604800      // 7 days
} as const;

class RedisCache {
  private client: Redis | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxRetries = 3;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('REDIS_URL not configured. Caching will be disabled.');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
        connectTimeout: 5000,
        retryStrategy: (times: number) => Math.min(times * 1000, 5000)
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (err: Error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', err.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        this.connectionAttempts++;
        logger.info(`Redis reconnecting (attempt ${this.connectionAttempts})`);
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.client = null;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number = CacheTTL.MEDIUM): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client!.set(key, serialized, 'EX', ttlSeconds);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client!.del(...keys);
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlSeconds: number = CacheTTL.MEDIUM
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();
    
    // Store in cache (don't await, fire and forget)
    this.set(key, fresh, ttlSeconds).catch(() => {});
    
    return fresh;
  }

  /**
   * Increment a counter (useful for rate limiting)
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const count = await this.client!.incr(key);
      if (ttlSeconds && count === 1) {
        await this.client!.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get TTL remaining on a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) return -1;

    try {
      return await this.client!.ttl(key);
    } catch (error) {
      return -1;
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

// Singleton instance
export const cache = new RedisCache();

// Initialize on module load if REDIS_URL is set
if (process.env.REDIS_URL) {
  cache.connect().catch(err => {
    logger.error('Redis initial connection failed:', err);
  });
}

// ============================================
// Convenience functions for specific use cases
// ============================================

/**
 * Cache menu items
 */
export async function cacheMenuItems(items: unknown[], moduleId?: string): Promise<void> {
  const key = moduleId 
    ? `${CacheKeys.MENU}${moduleId}:items` 
    : `${CacheKeys.MENU}all`;
  await cache.set(key, items, CacheTTL.MEDIUM);
}

/**
 * Get cached menu items
 */
export async function getCachedMenuItems<T>(moduleId?: string): Promise<T[] | null> {
  const key = moduleId 
    ? `${CacheKeys.MENU}${moduleId}:items` 
    : `${CacheKeys.MENU}all`;
  return cache.get<T[]>(key);
}

/**
 * Invalidate menu cache
 */
export async function invalidateMenuCache(moduleId?: string): Promise<void> {
  if (moduleId) {
    await cache.del(`${CacheKeys.MENU}${moduleId}:items`);
  } else {
    await cache.delPattern(`${CacheKeys.MENU}*`);
  }
}

/**
 * Cache settings
 */
export async function cacheSettings(key: string, settings: unknown): Promise<void> {
  await cache.set(`${CacheKeys.SETTINGS}${key}`, settings, CacheTTL.LONG);
}

/**
 * Get cached settings
 */
export async function getCachedSettings<T>(key: string): Promise<T | null> {
  return cache.get<T>(`${CacheKeys.SETTINGS}${key}`);
}

/**
 * Cache user session data
 */
export async function cacheUserSession(userId: string, sessionData: unknown): Promise<void> {
  await cache.set(`${CacheKeys.SESSION}${userId}`, sessionData, CacheTTL.SESSION);
}

/**
 * Get cached user session
 */
export async function getCachedUserSession<T>(userId: string): Promise<T | null> {
  return cache.get<T>(`${CacheKeys.SESSION}${userId}`);
}

/**
 * Invalidate user session
 */
export async function invalidateUserSession(userId: string): Promise<void> {
  await cache.del(`${CacheKeys.SESSION}${userId}`);
}

/**
 * Rate limit check using Redis
 */
export async function checkRateLimit(
  identifier: string, 
  maxRequests: number, 
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = `${CacheKeys.RATE_LIMIT}${identifier}`;
  
  if (!cache.isAvailable()) {
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }

  const count = await cache.incr(key, windowSeconds);
  const ttl = await cache.ttl(key);

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetIn: ttl > 0 ? ttl : windowSeconds
  };
}
