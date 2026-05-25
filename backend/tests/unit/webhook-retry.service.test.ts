/**
 * Webhook Retry Service Tests
 *
 * Tests src/services/webhook-retry.service.ts with mocked DB, activity logger, and logger.
 */


vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/activityLogger.js', () => ({
  activityLogger: { log: vi.fn().mockResolvedValue(undefined) },
}));

// email.service is only used in alertMaxRetriesExceeded (dynamic import) — no top-level mock needed

const mockChain = {
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  lte: vi.fn(),
  gte: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  range: vi.fn(),
};
Object.keys(mockChain).forEach((k) => {
  (mockChain as any)[k].mockReturnValue(mockChain);
});

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

import { webhookRetryService, type WebhookFailure } from '../../src/services/webhook-retry.service.js';

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockChain).forEach((k) => {
    (mockChain as any)[k].mockReturnValue(mockChain);
  });
  webhookRetryService.stopBackgroundProcessing();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('registerHandler', () => {
  it('registers a handler without throwing', () => {
    expect(() =>
      webhookRetryService.registerHandler('payment.succeeded', vi.fn())
    ).not.toThrow();
  });
});

describe('recordFailure', () => {
  it('inserts a record and returns it', async () => {
    const fakeRecord: WebhookFailure = {
      id: 'wh-1',
      event_type: 'payment.succeeded',
      event_id: 'evt_123',
      source: 'stripe',
      payload: { amount: 100 },
      error_message: 'handler threw',
      retry_count: 0,
      max_retries: 5,
      next_retry_at: new Date().toISOString(),
      status: 'pending',
      processed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockChain.single.mockResolvedValueOnce({ data: fakeRecord, error: null });

    const result = await webhookRetryService.recordFailure(
      'stripe',
      'payment.succeeded',
      'evt_123',
      { amount: 100 },
      new Error('handler threw')
    );

    expect(result.id).toBe('wh-1');
    expect(result.event_type).toBe('payment.succeeded');
    expect(mockChain.from).toHaveBeenCalledWith('webhook_failures');
    expect(mockChain.insert).toHaveBeenCalled();
  });

  it('throws when insert fails', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: new Error('insert failed') });

    await expect(
      webhookRetryService.recordFailure('stripe', 'ev', 'id', {}, new Error('x'))
    ).rejects.toThrow('insert failed');
  });
});

describe('processFailure', () => {
  const failure: WebhookFailure = {
    id: 'wh-1',
    event_type: 'payment.succeeded',
    event_id: 'evt_123',
    source: 'stripe',
    payload: { amount: 100 },
    error_message: '',
    retry_count: 0,
    max_retries: 5,
    next_retry_at: null,
    status: 'pending',
    processed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('returns false and marks for manual review when no handler registered', async () => {
    // update → retrying
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // markForManualReview update
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const result = await webhookRetryService.processFailure({
      ...failure,
      event_type: 'unregistered.event',
    });

    expect(result).toBe(false);
  });

  it('returns true and marks resolved when handler succeeds', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    webhookRetryService.registerHandler('test.event', handler);

    // update to retrying
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // update to resolved
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const result = await webhookRetryService.processFailure({
      ...failure,
      event_type: 'test.event',
    });

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(failure.payload);
  });

  it('returns false and increments retry on handler failure', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('handler error'));
    webhookRetryService.registerHandler('failing.event', failingHandler);

    // update to retrying
    mockChain.eq.mockResolvedValueOnce({ error: null });
    // schedule next retry update
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const result = await webhookRetryService.processFailure({
      ...failure,
      event_type: 'failing.event',
      retry_count: 1,
    });

    expect(result).toBe(false);
    expect(failingHandler).toHaveBeenCalled();
  });
});

describe('processPendingRetries', () => {
  it('returns zero counts when no retries are due', async () => {
    mockChain.limit.mockResolvedValueOnce({ data: [], error: null });

    const result = await webhookRetryService.processPendingRetries();

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
  });

  it('processes available retries', async () => {
    const failure: WebhookFailure = {
      id: 'wh-2',
      event_type: 'test.event2',
      event_id: 'evt_456',
      source: 'stripe',
      payload: {},
      error_message: '',
      retry_count: 0,
      max_retries: 5,
      next_retry_at: new Date().toISOString(),
      status: 'pending',
      processed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockChain.limit.mockResolvedValueOnce({ data: [failure], error: null });

    const handler = vi.fn().mockResolvedValue(undefined);
    webhookRetryService.registerHandler('test.event2', handler);

    // processFailure internals: update to retrying, update to resolved
    mockChain.eq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    const result = await webhookRetryService.processPendingRetries();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
  });
});

describe('getStats', () => {
  it('aggregates counts by status and source', async () => {
    const rows = [
      { status: 'pending', source: 'stripe', event_type: 'payment.succeeded' },
      { status: 'pending', source: 'stripe', event_type: 'payment.failed' },
      { status: 'resolved', source: 'stripe', event_type: 'payment.succeeded' },
      { status: 'failed', source: 'twilio', event_type: 'sms.delivery' },
      { status: 'manual_review', source: 'sendgrid', event_type: 'email.bounce' },
    ];
    mockChain.select.mockResolvedValueOnce({ data: rows, error: null });

    const stats = await webhookRetryService.getStats();

    expect(stats.pending).toBe(2);
    expect(stats.resolved).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.manual_review).toBe(1);
    expect(stats.by_source['stripe']).toBe(3);
    expect(stats.by_source['twilio']).toBe(1);
    // Resolved events should NOT appear in by_event_type
    expect(stats.by_event_type['payment.succeeded']).toBe(1); // only the pending one
  });

  it('returns zero counts on empty data', async () => {
    mockChain.select.mockResolvedValueOnce({ data: [], error: null });

    const stats = await webhookRetryService.getStats();

    expect(stats.pending).toBe(0);
    expect(stats.resolved).toBe(0);
    expect(Object.keys(stats.by_source)).toHaveLength(0);
  });

  it('throws on DB error', async () => {
    mockChain.select.mockResolvedValueOnce({ data: null, error: new Error('DB down') });

    await expect(webhookRetryService.getStats()).rejects.toThrow('DB down');
  });
});

describe('list', () => {
  it('returns data and total', async () => {
    const fakeData = [{ id: 'wh-1', status: 'pending' }];
    mockChain.range.mockResolvedValueOnce({ data: fakeData, count: 1, error: null });

    const result = await webhookRetryService.list({ status: 'pending' });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns empty result when nothing matches', async () => {
    mockChain.range.mockResolvedValueOnce({ data: [], count: 0, error: null });

    const result = await webhookRetryService.list({});

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
