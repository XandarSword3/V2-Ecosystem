/**
 * V2 Ecosystem - Horizontal Scaling Session Store Configuration
 * Enables stateless backend instances with Redis-backed sessions
 */

import Redis from 'ioredis';
import session from 'express-session';
import { RedisStore } from 'connect-redis';

// Environment configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CLUSTER_NODES = process.env.REDIS_CLUSTER_NODES?.split(',') || [];
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

// Redis connection options
const redisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 100,
  retryDelayOnTryAgain: 100,
  scaleReads: 'slave' as const,
  lazyConnect: true,
  showFriendlyErrorStack: NODE_ENV !== 'production',
};

// Create Redis client (single instance or cluster)
let redisInstance: any = null;

export const createRedisClient = () => {
  if (REDIS_CLUSTER_NODES.length > 0) {
    // Cluster mode for production
    const nodes = REDIS_CLUSTER_NODES.map((node) => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port, 10) };
    });

    return new Redis.Cluster(nodes, {
      redisOptions: {
        ...redisOptions,
      } as any,
      clusterRetryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
    });
  }

  return new Redis(REDIS_URL, redisOptions);
};

export const getRedis = () => {
  if (!REDIS_ENABLED) return null;
  if (!redisInstance) {
    redisInstance = createRedisClient();
  }
  return redisInstance;
};

// Session store for horizontal scaling
export const redisClient = REDIS_ENABLED ? createRedisClient() : null;

// Setup event handlers only if redis is enabled
if (REDIS_ENABLED && redisClient) {
  redisClient.on('connect', () => { console.log('[Redis] Connected to session store'); });
  redisClient.on('error', (err: any) => { console.error('[Redis] Session store error:', err.message); });
  redisClient.on('ready', () => { console.log('[Redis] Session store ready'); });
  redisClient.on('reconnecting', () => { console.log('[Redis] Reconnecting to session store...'); });
}

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

// Graceful shutdown
export const closeSessionStore = async (): Promise<void> => {
  if (!REDIS_ENABLED || !redisClient) return;
  console.log('[Redis] Closing session store connection...');
  await redisClient.quit();
  console.log('[Redis] Session store connection closed');
};
