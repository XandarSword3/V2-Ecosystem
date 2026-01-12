/**
 * User-Based Rate Limiting Middleware
 * 
 * Provides per-user rate limiting for authenticated requests.
 * Uses Redis for distributed rate limiting across multiple instances.
 * Falls back to IP-based limiting if Redis is unavailable.
 */

import { Request, Response, NextFunction } from 'express';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Redis key prefix
  message?: string;      // Error message when rate limited
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

/**
 * Creates a rate limiter that tracks by user ID for authenticated requests
 * and falls back to IP for unauthenticated requests.
 */
export function userRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'user-rate:',
    message = 'Too many requests. Please try again later.'
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine the rate limit key
      // Use user ID if authenticated, otherwise fall back to IP
      const userId = (req as { user?: { userId: string } }).user?.userId;
      const identifier = userId || req.ip || 'unknown';
      const key = `${keyPrefix}${identifier}`;

      // Try to get current count from Redis
      const now = Date.now();
      let info: RateLimitInfo | null = null;

      try {
        const cached = await cache.get<RateLimitInfo>(key);
        if (cached) {
          info = cached;
        }
      } catch {
        // Redis unavailable, skip user-based limiting
        // The IP-based express-rate-limit middleware will handle it
        return next();
      }

      // Initialize or update rate limit info
      if (!info || now > info.resetTime) {
        // New window
        info = {
          count: 1,
          resetTime: now + windowMs
        };
      } else {
        // Increment count in current window
        info.count++;
      }

      // Calculate remaining requests and time
      const remaining = Math.max(0, maxRequests - info.count);
      const retryAfter = Math.ceil((info.resetTime - now) / 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000));

      // Check if rate limited
      if (info.count > maxRequests) {
        res.setHeader('Retry-After', retryAfter);
        
        logger.warn(`Rate limit exceeded for ${userId ? `user ${userId}` : `IP ${identifier}`}`);
        
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter
        });
      }

      // Store updated count
      const ttl = Math.ceil((info.resetTime - now) / 1000);
      await cache.set(key, info, ttl);

      next();
    } catch (error) {
      // On any error, allow the request through
      // The global rate limiter will still apply
      logger.error('User rate limit error:', error);
      next();
    }
  };
}

/**
 * Preset rate limiters for common use cases
 */
export const rateLimits = {
  // Standard API rate limit per user
  standard: userRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyPrefix: 'rate:api:',
    message: 'API rate limit exceeded. Please try again in a few minutes.'
  }),

  // Stricter limit for expensive operations (reports, exports)
  expensive: userRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyPrefix: 'rate:expensive:',
    message: 'Too many report requests. Please try again later.'
  }),

  // Very strict limit for sensitive operations (password change, etc.)
  sensitive: userRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: 'rate:sensitive:',
    message: 'Too many sensitive operation attempts. Please try again later.'
  }),

  // Write operations limit
  write: userRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'rate:write:',
    message: 'Too many write requests. Please slow down.'
  })
};

export default userRateLimit;
