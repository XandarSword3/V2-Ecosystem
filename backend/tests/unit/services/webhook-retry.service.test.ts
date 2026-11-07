/**
 * Webhook Retry Service Unit Tests
 * 
 * Verifies real business logic of webhook-retry.service:
 * - Recording initial failures with exponential backoff scheduling
 * - Handler registration and dispatching retries to registered handlers
 * - Handling missing handlers by routing to manual_review
 * - Handling retry successes by marking resolved and logging activity
 * - Handling retry failures by advancing retry_count and scheduling next delay
 * - Manual retry triggering by admin
 * - Fetching failure stats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSupabaseClient } = vi.hoisted(() => {
  const chain: any = {};
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'is', 'lte', 'order', 'limit', 'single'];
  methods.forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return {
    mockSupabaseClient: chain,
  };
});

vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: mockSupabaseClient,
  getSupabase: () => mockSupabaseClient,
  getSupabaseAdmin: () => mockSupabaseClient,
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { webhookRetryService, WebhookFailure } from '../../../src/services/webhook-retry.service';

describe('WebhookRetryService (Real Execution & Branches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFailure', () => {
    it('records a webhook failure and sets next_retry_at', async () => {
      const mockInserted = {
        id: 'fail-1',
        event_type: 'payment_intent.succeeded',
        event_id: 'evt_123',
        source: 'stripe',
        status: 'pending',
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockInserted,
        error: null,
      });

      const res = await webhookRetryService.recordFailure(
        'stripe',
        'payment_intent.succeeded',
        'evt_123',
        { amount: 1500 },
        new Error('Payment gateway timeout')
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('webhook_failures');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'payment_intent.succeeded',
          event_id: 'evt_123',
          source: 'stripe',
          error_message: 'Payment gateway timeout',
          retry_count: 0,
          status: 'pending',
          next_retry_at: expect.any(String),
        })
      );
      expect(res.id).toBe('fail-1');
    });

    it('throws error when database insert fails', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: new Error('DB write failure'),
      });

      await expect(
        webhookRetryService.recordFailure(
          'twilio',
          'sms.delivered',
          'msg_999',
          {},
          new Error('Delivery error')
        )
      ).rejects.toThrow('DB write failure');
    });
  });

  describe('processFailure and Handler Dispatch', () => {
    const sampleFailure: WebhookFailure = {
      id: 'fail-100',
      event_type: 'order.fulfilled',
      event_id: 'evt_order_1',
      source: 'other',
      payload: { orderId: 'ord-1' },
      error_message: 'Service unavailable',
      retry_count: 0,
      max_retries: 5,
      next_retry_at: new Date().toISOString(),
      status: 'pending',
      processed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('marks for manual review when no handler is registered for event_type', async () => {
      mockSupabaseClient.eq.mockResolvedValue({ error: null });

      const success = await webhookRetryService.processFailure(sampleFailure);

      expect(success).toBe(false);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'manual_review',
        })
      );
    });

    it('calls registered handler and updates status to resolved on success', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      webhookRetryService.registerHandler('order.fulfilled', mockHandler);

      mockSupabaseClient.eq.mockResolvedValue({ error: null });

      const success = await webhookRetryService.processFailure(sampleFailure);

      expect(mockHandler).toHaveBeenCalledWith({ orderId: 'ord-1' });
      expect(success).toBe(true);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          processed_at: expect.any(String),
        })
      );
    });

    it('increments retry_count and reschedules next retry on handler failure', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Still failing'));
      webhookRetryService.registerHandler('order.failing', failingHandler);

      const failingSample = {
        ...sampleFailure,
        event_type: 'order.failing',
        retry_count: 1,
      };

      mockSupabaseClient.eq.mockResolvedValue({ error: null });

      const success = await webhookRetryService.processFailure(failingSample);

      expect(success).toBe(false);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          retry_count: 2,
          error_message: 'Still failing',
          next_retry_at: expect.any(String),
        })
      );
    });
  });

  describe('manualRetry & Stats', () => {
    it('allows admin to trigger manual retry', async () => {
      const failureRow: WebhookFailure = {
        id: 'fail-manual',
        event_type: 'custom.ping',
        event_id: 'evt_ping_1',
        source: 'other',
        payload: { ping: true },
        error_message: 'network issue',
        retry_count: 3,
        max_retries: 5,
        next_retry_at: null,
        status: 'manual_review',
        processed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const handler = vi.fn().mockResolvedValue(undefined);
      webhookRetryService.registerHandler('custom.ping', handler);

      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: failureRow,
        error: null,
      });

      const res = await webhookRetryService.manualRetry('fail-manual', 'admin-user-1');

      expect(res).toBe(true);
      expect(handler).toHaveBeenCalledWith({ ping: true });
    });

    it('returns structured stats from failure counts', async () => {
      mockSupabaseClient.select.mockResolvedValueOnce({
        data: [
          { status: 'pending', source: 'stripe', event_type: 'payment.failed' },
          { status: 'pending', source: 'stripe', event_type: 'payment.failed' },
          { status: 'resolved', source: 'stripe', event_type: 'payment.succeeded' },
          { status: 'failed', source: 'twilio', event_type: 'sms.failed' },
          { status: 'manual_review', source: 'other', event_type: 'unknown' },
        ],
        error: null,
      });

      const stats = await webhookRetryService.getStats();

      expect(stats.pending).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.manual_review).toBe(1);
      expect(stats.by_source.stripe).toBe(3);
      expect(stats.by_source.twilio).toBe(1);
    });
  });
});
