/**
 * V2 Ecosystem - Horizontal Scaling Session Store Configuration
 * Enables stateless backend instances with Redis-backed sessions
 */

import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { cache } from '../utils/cache.js';

// Environment configuration
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!SESSION_SECRET && NODE_ENV === 'production') {
  console.warn(
    'WARN: SESSION_SECRET is not set in production. Using a generated secret. ' +
    'Sessions will be invalidated on restart.'
  );
}

// Generate a random secret if one isn't provided (for fallback)
const FALLBACK_SECRET = require('crypto').randomBytes(32).toString('hex');
const FINAL_SESSION_SECRET = SESSION_SECRET || FALLBACK_SECRET;

// Shared Redis client — see utils/cache.ts. Session store no longer opens
// its own connection; it reuses the single backend-wide client so we don't
// multiply persistent TLS connections to Upstash per instance.
export const getRedis = () => {
  if (!REDIS_ENABLED) return null;
  return cache.getClient();
};

export const redisClient = getRedis();

// Create Redis session store
export const createSessionStore = () => {
  if (REDIS_ENABLED && redisClient) {
    return new RedisStore({
      client: redisClient,
      prefix: 'v2ecosystem:session:',
      ttl: 86400, // 24 hours default
    });
  }
  return undefined; // Use default MemoryStore
};

// Session middleware configuration
export const sessionConfig = {
  store: createSessionStore(),
  secret: FINAL_SESSION_SECRET,
  name: 'v2ecosystem.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  proxy: true, // Trust first proxy
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: NODE_ENV === 'production' ? '.v2ecosystem.com' : undefined,
  },
};

// Create configured session middleware
export const sessionMiddleware = session(sessionConfig);

// Session utilities for horizontal scaling
export const sessionUtils = {
  /**
   * Get session by ID (for debugging/admin)
   */
  async getSession(sessionId: string): Promise<any | null> {
    if (!REDIS_ENABLED || !redisClient) return null;
    const data = await redisClient.get(`v2ecosystem:session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Destroy session by ID (force logout)
   */
  async destroySession(sessionId: string): Promise<boolean> {
    if (!REDIS_ENABLED || !redisClient) return false;
    const result = await redisClient.del(`v2ecosystem:session:${sessionId}`);
    return result > 0;
  },

  /**
   * Destroy all sessions for a user (logout everywhere)
   */
  async destroyUserSessions(userId: string): Promise<number> {
    if (!REDIS_ENABLED || !redisClient) return 0;
    const pattern = 'v2ecosystem:session:*';
    let cursor = '0';
    let count = 0;

    do {
      const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            await redisClient.del(key);
            count++;
          }
        }
      }
    } while (cursor !== '0');

    return count;
  },

  /**
   * Get active session count for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    if (!REDIS_ENABLED || !redisClient) return 0;
    const pattern = 'v2ecosystem:session:*';
    let cursor = '0';
    let count = 0;

    do {
      const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            count++;
          }
        }
      }
    } while (cursor !== '0');

    return count;
  },

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, ttlSeconds: number): Promise<boolean> {
    if (!REDIS_ENABLED || !redisClient) return false;
    const result = await redisClient.expire(`v2ecosystem:session:${sessionId}`, ttlSeconds);
    return result === 1;
  },

  /**
   * Get total active sessions (for monitoring)
   */
  async getTotalSessionCount(): Promise<number> {
    if (!REDIS_ENABLED || !redisClient) return 0;
    const pattern = 'v2ecosystem:session:*';
    let cursor = '0';
    let count = 0;

    do {
      const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      count += keys.length;
    } while (cursor !== '0');

    return count;
  },
};

// Health check for session store
export const checkSessionStoreHealth = async (): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> => {
  const start = Date.now();
  if (!REDIS_ENABLED || !redisClient) {
    return { healthy: true, latencyMs: 0 };
  }
  try {
    await redisClient.ping();
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Graceful shutdown — delegates to the shared client owner (utils/cache.ts).
// Does NOT call redisClient.quit() directly: this is the same connection
// used by the cache layer and rate limiters, so only cache.disconnect()
// (called once, from index.ts's shutdown sequence) should close it.
export const closeSessionStore = async (): Promise<void> => {
  if (!REDIS_ENABLED) return;
  await cache.disconnect();
};
