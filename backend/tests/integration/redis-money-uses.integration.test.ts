/**
 * Redis inventory proofs for the money-related uses.
 *
 * Requires a reachable Redis at REDIS_URL (integration `.env.test` points at
 * the local container on 127.0.0.1:6380). Real Redis, no mocks.
 *
 * Money-related Redis dependencies covered:
 *   1. Payment-route rate limiting (`rateLimits.write` / `rateLimits.sensitive`
 *      on every payment mutation) stores its window counter in Redis.
 *   2. Financial dashboard metrics (`businessMetricsService`) cache revenue
 *      figures in Redis under `metrics:*`.
 *
 * Non-money Redis uses (sessions, permissions, tenant/property lookup,
 * catalogs, translations, feature flags, Socket.IO pub/sub, email quotas,
 * login lockout) are inventoried in docs/audit-evidence/TASK7_REDIS_INVENTORY.md;
 * losing them causes re-login/recompute/realtime reconnects, not lost money.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { cache } from '../../src/utils/cache';
import { userRateLimit } from '../../src/middleware/userRateLimit.middleware';
import { businessMetricsService } from '../../src/services/business-metrics.service';

describe('Redis money-related uses (real Redis)', () => {
  const run = randomUUID().slice(0, 8);
  const ratePrefix = `test:money-rate:${run}:`;
  let client: ReturnType<typeof cache.getClient> = null;

  beforeAll(async () => {
    if (!cache.getClient()) {
      await cache.connect();
    }
    client = cache.getClient();
    if (!client) throw new Error('Redis client unavailable');
    await client.ping();
  });

  afterAll(async () => {
    if (client) {
      const keys = await client.keys(`${ratePrefix}*`);
      if (keys.length > 0) await client.del(...keys);
      await client.del('metrics:revenue:month');
    }
  });

  it('payment-route rate limiter persists its window counter in Redis and blocks over the limit', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/api/v1/payments/record-cash',
      userRateLimit({
        windowMs: 60_000,
        maxRequests: 2,
        keyPrefix: ratePrefix,
        message: 'payment rate limit',
      }),
      (_req, res) => res.status(201).json({ success: true }),
    );

    const first = await request(app).post('/api/v1/payments/record-cash').send({});
    const second = await request(app).post('/api/v1/payments/record-cash').send({});
    const third = await request(app).post('/api/v1/payments/record-cash').send({});

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(third.body?.error).toBe('payment rate limit');

    const keys = await client!.keys(`${ratePrefix}*`);
    expect(keys.length).toBe(1);
    const stored = JSON.parse((await client!.get(keys[0])) as string) as { count: number };
    // The over-limit request is rejected before the counter is written, so
    // Redis holds the last accepted count (2) while still proving the window
    // is shared/persisted.
    expect(stored.count).toBe(2);
    expect(await client!.ttl(keys[0])).toBeGreaterThan(0);
  });

  it('financial dashboard revenue metrics are served from the Redis cache', async () => {
    // Warm the cache from the real database.
    const fresh = await businessMetricsService.getRevenueMetrics('month');
    expect(fresh).toBeDefined();
    expect(await client!.exists('metrics:revenue:month')).toBe(1);

    // If the next read returns the sentinel, it came from Redis, not the DB.
    const sentinel = {
      total_revenue: 987654.32,
      revenue_by_engine: {},
      revenue_by_day: [],
      average_transaction_value: 141093.47,
      refunds_total: 0,
    };
    await client!.set('metrics:revenue:month', JSON.stringify(sentinel), 'EX', 60);

    const cached = await businessMetricsService.getRevenueMetrics('month');
    expect(cached.total_revenue).toBe(sentinel.total_revenue);
    expect(cached.average_transaction_value).toBe(sentinel.average_transaction_value);
  });
});
