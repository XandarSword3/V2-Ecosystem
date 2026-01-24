/**
 * Enhanced Rate Limiter Service
 * Implements token bucket algorithm with Redis support and endpoint-specific limits
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitStore {
  get(key: string): Promise<TokenBucket | null>;
  set(key: string, bucket: TokenBucket, ttlMs: number): Promise<void>;
  increment(key: string): Promise<number>;
}

// In-memory store (for single instance)
class MemoryStore implements RateLimitStore {
  private buckets: Map<string, TokenBucket> = new Map();
  private counters: Map<string, number> = new Map();

  async get(key: string): Promise<TokenBucket | null> {
    return this.buckets.get(key) || null;
  }

  async set(key: string, bucket: TokenBucket, ttlMs: number): Promise<void> {
    this.buckets.set(key, bucket);
    setTimeout(() => this.buckets.delete(key), ttlMs);
  }

  async increment(key: string): Promise<number> {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    return current + 1;
  }
}

// Endpoint-specific configurations
const ENDPOINT_LIMITS: Record<string, Partial<RateLimitConfig>> = {
  // Auth endpoints - stricter limits
  '/api/auth/login': { windowMs: 60000, maxRequests: 5 },
  '/api/auth/register': { windowMs: 60000, maxRequests: 3 },
  '/api/auth/forgot-password': { windowMs: 300000, maxRequests: 3 },
  '/api/auth/reset-password': { windowMs: 300000, maxRequests: 3 },
  '/api/auth/2fa/authenticate': { windowMs: 60000, maxRequests: 5 },
  
  // Payment endpoints - moderate limits
  '/api/payments': { windowMs: 60000, maxRequests: 10 },
  '/api/bookings/chalets': { windowMs: 60000, maxRequests: 20 },
  
  // Admin endpoints - higher limits
  '/api/admin': { windowMs: 60000, maxRequests: 200 },
  
  // API default
  '/api': { windowMs: 60000, maxRequests: 100 },
};

// User tier multipliers
const TIER_MULTIPLIERS: Record<string, number> = {
  anonymous: 1.0,
  customer: 1.5,
  premium: 2.0,
  staff: 3.0,
  admin: 5.0,
};

export class RateLimiterService {
  private store: RateLimitStore;
  private defaultConfig: RateLimitConfig;

  constructor(store?: RateLimitStore, defaultConfig?: Partial<RateLimitConfig>) {
    this.store = store || new MemoryStore();
    this.defaultConfig = {
      windowMs: 60000,
      maxRequests: 100,
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...defaultConfig,
    };
  }

  /**
   * Get configuration for a specific endpoint
   */
  private getEndpointConfig(path: string): RateLimitConfig {
    // Find matching endpoint config (longest match wins)
    let matchedConfig: Partial<RateLimitConfig> = {};
    let matchLength = 0;

    for (const [endpoint, config] of Object.entries(ENDPOINT_LIMITS)) {
      if (path.startsWith(endpoint) && endpoint.length > matchLength) {
        matchedConfig = config;
        matchLength = endpoint.length;
      }
    }

    return { ...this.defaultConfig, ...matchedConfig };
  }

  /**
   * Get user tier from request
   */
  private getUserTier(req: Request): string {
    const user = (req as any).user;
    if (!user) return 'anonymous';
    return user.role || 'customer';
  }

  /**
   * Generate rate limit key
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default: IP + user ID (if authenticated)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anon';
    const path = this.normalizePath(req.path);

    return `ratelimit:${ip}:${userId}:${path}`;
  }

  private normalizePath(path: string): string {
    // Group similar paths
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(req: Request): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    limit: number;
  }> {
    const config = this.getEndpointConfig(req.path);
    const key = this.generateKey(req, config);
    const userTier = this.getUserTier(req);
    const multiplier = TIER_MULTIPLIERS[userTier] || 1.0;
    
    const effectiveLimit = Math.floor(config.maxRequests * multiplier);
    const now = Date.now();

    // Get or create bucket
    let bucket = await this.store.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: effectiveLimit,
        lastRefill: now,
      };
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const refillRate = effectiveLimit / config.windowMs;
    const tokensToAdd = elapsed * refillRate;
    
    bucket.tokens = Math.min(effectiveLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we can consume a token
    const allowed = bucket.tokens >= 1;
    
    if (allowed) {
      bucket.tokens -= 1;
    }

    // Save updated bucket
    await this.store.set(key, bucket, config.windowMs);

    // Calculate reset time
    const tokensNeeded = allowed ? 0 : 1 - bucket.tokens;
    const resetTime = now + (tokensNeeded / refillRate);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTime: Math.ceil(resetTime),
      limit: effectiveLimit,
    };
  }

  /**
   * Express middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const result = await this.checkLimit(req);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetTime);

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        
        const config = this.getEndpointConfig(req.path);
        
        if (config.handler) {
          return config.handler(req, res, next);
        }

        return res.status(429).json({
          error: config.message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      next();
    };
  }

  /**
   * Sliding window counter for more accurate limiting
   */
  async checkSlidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; count: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // This would ideally use Redis sorted sets
    // For in-memory, we'll use a simplified approach
    const count = await this.store.increment(`sliding:${key}:${Math.floor(now / windowMs)}`);

    return {
      allowed: count <= maxRequests,
      count,
    };
  }

  /**
   * IP-based blocking for repeated violations
   */
  private blockedIPs: Map<string, number> = new Map();
  private violationCounts: Map<string, number> = new Map();

  async recordViolation(ip: string): Promise<void> {
    const count = (this.violationCounts.get(ip) || 0) + 1;
    this.violationCounts.set(ip, count);

    // Block IP after 10 violations within 1 hour
    if (count >= 10) {
      const blockUntil = Date.now() + 3600000; // 1 hour
      this.blockedIPs.set(ip, blockUntil);
      this.violationCounts.delete(ip);
    }
  }

  isIPBlocked(ip: string): boolean {
    const blockUntil = this.blockedIPs.get(ip);
    if (!blockUntil) return false;
    
    if (Date.now() > blockUntil) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * DDoS protection middleware
   */
  ddosProtection() {
    const requestCounts: Map<string, number[]> = new Map();
    const WINDOW_SIZE = 1000; // 1 second
    const MAX_REQUESTS_PER_SECOND = 50;

    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Check if IP is blocked
      if (this.isIPBlocked(ip)) {
        return res.status(403).json({
          error: 'Access temporarily blocked due to suspicious activity',
        });
      }

      const now = Date.now();
      const requests = requestCounts.get(ip) || [];
      
      // Remove old requests
      const recentRequests = requests.filter(t => now - t < WINDOW_SIZE);
      recentRequests.push(now);
      requestCounts.set(ip, recentRequests);

      if (recentRequests.length > MAX_REQUESTS_PER_SECOND) {
        this.recordViolation(ip);
        return res.status(429).json({
          error: 'Request rate too high',
        });
      }

      next();
    };
  }
}

// Create and export default rate limiter
export const rateLimiter = new RateLimiterService();

// Convenience middleware functions
export const apiRateLimiter = rateLimiter.middleware();
export const ddosProtection = rateLimiter.ddosProtection();

// Specific limiters for different endpoint types
export const authRateLimiter = new RateLimiterService(undefined, {
  windowMs: 60000,
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again later.',
}).middleware();

export const paymentRateLimiter = new RateLimiterService(undefined, {
  windowMs: 60000,
  maxRequests: 10,
  message: 'Too many payment requests. Please try again later.',
}).middleware();

export const adminRateLimiter = new RateLimiterService(undefined, {
  windowMs: 60000,
  maxRequests: 200,
}).middleware();
