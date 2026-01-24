/**
 * V2 Resort - Email Rate Limiter
 * Prevents email flooding and ensures deliverability
 */

import Redis from 'ioredis';
import { supabase } from '../lib/supabase';
import { Request, Response, NextFunction } from 'express';

// Redis client for rate limiting
let redis: Redis | null = null;

const getRedis = (): Redis => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }
  return redis;
};

export interface RateLimitConfig {
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  burstLimit: number; // Max emails in 10 seconds
}

// Default rate limits by sender type
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  transactional: {
    maxPerMinute: 30,
    maxPerHour: 500,
    maxPerDay: 5000,
    burstLimit: 10,
  },
  marketing: {
    maxPerMinute: 10,
    maxPerHour: 100,
    maxPerDay: 1000,
    burstLimit: 5,
  },
  system: {
    maxPerMinute: 50,
    maxPerHour: 1000,
    maxPerDay: 10000,
    burstLimit: 20,
  },
};

// Per-user rate limits
const USER_LIMITS: RateLimitConfig = {
  maxPerMinute: 3,
  maxPerHour: 20,
  maxPerDay: 50,
  burstLimit: 3,
};

export type EmailCategory = 'transactional' | 'marketing' | 'system';

class EmailRateLimiter {
  private readonly prefix = 'email_ratelimit';

  /**
   * Check if email can be sent (global rate limit)
   */
  async canSendGlobal(category: EmailCategory): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const limits = DEFAULT_LIMITS[category];
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);

    // Check burst limit (10 second window)
    const burstKey = `${this.prefix}:global:${category}:burst`;
    const burstCount = await redis.incr(burstKey);
    if (burstCount === 1) {
      await redis.expire(burstKey, 10);
    }
    if (burstCount > limits.burstLimit) {
      const ttl = await redis.ttl(burstKey);
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        retryAfter: ttl,
      };
    }

    // Check minute limit
    const minuteKey = `${this.prefix}:global:${category}:minute:${Math.floor(now / 60)}`;
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 120);
    }
    if (minuteCount > limits.maxPerMinute) {
      return {
        allowed: false,
        reason: 'Per-minute limit exceeded',
        retryAfter: 60 - (now % 60),
      };
    }

    // Check hour limit
    const hourKey = `${this.prefix}:global:${category}:hour:${Math.floor(now / 3600)}`;
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 7200);
    }
    if (hourCount > limits.maxPerHour) {
      return {
        allowed: false,
        reason: 'Per-hour limit exceeded',
        retryAfter: 3600 - (now % 3600),
      };
    }

    // Check day limit
    const dayKey = `${this.prefix}:global:${category}:day:${Math.floor(now / 86400)}`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 172800);
    }
    if (dayCount > limits.maxPerDay) {
      return {
        allowed: false,
        reason: 'Daily limit exceeded',
        retryAfter: 86400 - (now % 86400),
      };
    }

    return { allowed: true };
  }

  /**
   * Check if email can be sent to specific user
   */
  async canSendToUser(
    userId: string,
    category: EmailCategory = 'transactional'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    // Marketing emails have stricter per-user limits
    const limits = category === 'marketing'
      ? { ...USER_LIMITS, maxPerDay: 3 }
      : USER_LIMITS;

    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);

    // Check minute limit
    const minuteKey = `${this.prefix}:user:${userId}:minute:${Math.floor(now / 60)}`;
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 120);
    }
    if (minuteCount > limits.maxPerMinute) {
      return {
        allowed: false,
        reason: 'Too many emails sent to this user',
        retryAfter: 60 - (now % 60),
      };
    }

    // Check hour limit
    const hourKey = `${this.prefix}:user:${userId}:hour:${Math.floor(now / 3600)}`;
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 7200);
    }
    if (hourCount > limits.maxPerHour) {
      return {
        allowed: false,
        reason: 'Too many emails sent to this user (hourly limit)',
        retryAfter: 3600 - (now % 3600),
      };
    }

    // Check day limit
    const dayKey = `${this.prefix}:user:${userId}:day:${Math.floor(now / 86400)}`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 172800);
    }
    if (dayCount > limits.maxPerDay) {
      return {
        allowed: false,
        reason: 'Too many emails sent to this user (daily limit)',
        retryAfter: 86400 - (now % 86400),
      };
    }

    return { allowed: true };
  }

  /**
   * Check if email can be sent to specific address (for non-logged-in users)
   */
  async canSendToEmail(
    email: string,
    category: EmailCategory = 'transactional'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const emailHash = Buffer.from(email.toLowerCase()).toString('base64');
    const limits = USER_LIMITS;
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);

    // Check hour limit for this email
    const hourKey = `${this.prefix}:email:${emailHash}:hour:${Math.floor(now / 3600)}`;
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 7200);
    }
    if (hourCount > limits.maxPerHour) {
      return {
        allowed: false,
        reason: 'Too many emails sent to this address',
        retryAfter: 3600 - (now % 3600),
      };
    }

    // Check day limit for this email
    const dayKey = `${this.prefix}:email:${emailHash}:day:${Math.floor(now / 86400)}`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 172800);
    }
    if (dayCount > limits.maxPerDay) {
      return {
        allowed: false,
        reason: 'Too many emails sent to this address (daily limit)',
        retryAfter: 86400 - (now % 86400),
      };
    }

    return { allowed: true };
  }

  /**
   * Combined check for all rate limits
   */
  async checkRateLimit(
    email: string,
    userId: string | null,
    category: EmailCategory
  ): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    // Check global rate limit
    const globalCheck = await this.canSendGlobal(category);
    if (!globalCheck.allowed) {
      return globalCheck;
    }

    // Check user-specific rate limit
    if (userId) {
      const userCheck = await this.canSendToUser(userId, category);
      if (!userCheck.allowed) {
        return userCheck;
      }
    } else {
      // Check email-specific rate limit
      const emailCheck = await this.canSendToEmail(email, category);
      if (!emailCheck.allowed) {
        return emailCheck;
      }
    }

    return { allowed: true };
  }

  /**
   * Record an email send attempt (for tracking without blocking)
   */
  async recordSend(
    email: string,
    userId: string | null,
    category: EmailCategory,
    templateId?: string
  ): Promise<void> {
    // Store in database for analytics
    await supabase.from('email_rate_limit_log').insert({
      email_hash: Buffer.from(email.toLowerCase()).toString('base64'),
      user_id: userId,
      category,
      template_id: templateId,
    });
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(category: EmailCategory): Promise<{
    minute: { used: number; limit: number };
    hour: { used: number; limit: number };
    day: { used: number; limit: number };
  }> {
    const limits = DEFAULT_LIMITS[category];
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);

    const minuteKey = `${this.prefix}:global:${category}:minute:${Math.floor(now / 60)}`;
    const hourKey = `${this.prefix}:global:${category}:hour:${Math.floor(now / 3600)}`;
    const dayKey = `${this.prefix}:global:${category}:day:${Math.floor(now / 86400)}`;

    const [minuteCount, hourCount, dayCount] = await Promise.all([
      redis.get(minuteKey),
      redis.get(hourKey),
      redis.get(dayKey),
    ]);

    return {
      minute: { used: parseInt(minuteCount || '0'), limit: limits.maxPerMinute },
      hour: { used: parseInt(hourCount || '0'), limit: limits.maxPerHour },
      day: { used: parseInt(dayCount || '0'), limit: limits.maxPerDay },
    };
  }

  /**
   * Get user-specific usage
   */
  async getUserUsageStats(userId: string): Promise<{
    minute: number;
    hour: number;
    day: number;
    limits: RateLimitConfig;
  }> {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);

    const minuteKey = `${this.prefix}:user:${userId}:minute:${Math.floor(now / 60)}`;
    const hourKey = `${this.prefix}:user:${userId}:hour:${Math.floor(now / 3600)}`;
    const dayKey = `${this.prefix}:user:${userId}:day:${Math.floor(now / 86400)}`;

    const [minuteCount, hourCount, dayCount] = await Promise.all([
      redis.get(minuteKey),
      redis.get(hourKey),
      redis.get(dayKey),
    ]);

    return {
      minute: parseInt(minuteCount || '0'),
      hour: parseInt(hourCount || '0'),
      day: parseInt(dayCount || '0'),
      limits: USER_LIMITS,
    };
  }

  /**
   * Reset rate limits for testing/admin purposes
   */
  async resetLimits(target: 'global' | 'user', identifier?: string): Promise<void> {
    const redis = getRedis();

    if (target === 'global') {
      const keys = await redis.keys(`${this.prefix}:global:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else if (target === 'user' && identifier) {
      const keys = await redis.keys(`${this.prefix}:user:${identifier}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (redis) {
      await redis.quit();
      redis = null;
    }
  }
}

export const emailRateLimiter = new EmailRateLimiter();

// Middleware factory for Express routes
interface AuthenticatedRequest {
  body?: { email?: string; to?: string };
  user?: { id: string };
}

export function emailRateLimitMiddleware(category: EmailCategory = 'transactional') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const email = req.body?.email || req.body?.to;
    const userId = req.user?.id || null;

    if (!email) {
      return next();
    }

    const result = await emailRateLimiter.checkRateLimit(email, userId, category);

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter || 60));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: result.reason,
        retryAfter: result.retryAfter,
      });
    }

    next();
  };
}
