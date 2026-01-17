import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/supabase', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { getSupabase } from '../../../src/database/supabase';
import {
  isEventProcessed,
  markEventProcessed,
  processWithIdempotency,
  hashPayload,
  cleanupOldEvents,
  getWebhookStats
} from '../../../src/services/webhookIdempotency.service';

describe('WebhookIdempotency Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isEventProcessed', () => {
    it('should return true when event exists', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'existing' }))
      } as any);

      const result = await isEventProcessed('event-123');

      expect(result).toBe(true);
    });

    it('should return false when event does not exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const result = await isEventProcessed('new-event');

      expect(result).toBe(false);
    });

    it('should throw on database error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'DATABASE_ERROR', message: 'DB failed' }))
      } as any);

      await expect(isEventProcessed('event-123')).rejects.toThrow();
    });
  });

  describe('markEventProcessed', () => {
    it('should return true when event newly marked', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'new-record' }))
      } as any);

      const result = await markEventProcessed('event-123', 'payment.completed');

      expect(result).toBe(true);
    });

    it('should return false on unique constraint violation (duplicate)', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: '23505' }))
      } as any);

      const result = await markEventProcessed('event-123', 'payment.completed');

      expect(result).toBe(false);
    });

    it('should throw on other database errors', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'OTHER_ERROR' }))
      } as any);

      await expect(markEventProcessed('event-123', 'payment.completed')).rejects.toThrow();
    });

    it('should accept result parameter', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'new-record' }))
      } as any);

      const result = await markEventProcessed('event-123', 'payment.completed', { orderId: 'order-1' });

      expect(result).toBe(true);
    });
  });

  describe('processWithIdempotency', () => {
    it('should skip processing if already processed', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock({ id: 'existing' }))
      } as any);

      const handler = vi.fn().mockResolvedValue({ success: true });

      const result = await processWithIdempotency('event-123', 'payment.completed', handler);

      expect(result).toEqual({
        processed: false,
        result: null,
        alreadyProcessed: true
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should process new event and mark as processed', async () => {
      // First call: isEventProcessed - not found
      // Second call: markEventProcessed - success
      let callCount = 0;
      vi.mocked(getSupabase).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // isEventProcessed - not found
              return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
            }
            // markEventProcessed - success
            return Promise.resolve({ data: { id: 'new' }, error: null });
          })
        })
      } as any));

      const handler = vi.fn().mockResolvedValue({ orderId: 'order-1' });

      const result = await processWithIdempotency('event-123', 'payment.completed', handler);

      expect(result.processed).toBe(true);
      expect(result.result).toEqual({ orderId: 'order-1' });
      expect(result.alreadyProcessed).toBe(false);
      expect(handler).toHaveBeenCalled();
    });

    it('should rethrow errors from handler', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { code: 'PGRST116' }))
      } as any);

      const handler = vi.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(processWithIdempotency('event-123', 'payment.completed', handler)).rejects.toThrow('Processing failed');
    });
  });

  describe('hashPayload', () => {
    it('should generate consistent hash for same payload', () => {
      const payload = { amount: 100, currency: 'USD' };

      const hash1 = hashPayload(payload);
      const hash2 = hashPayload(payload);

      expect(hash1).toBe(hash2);
    });

    it('should generate same hash regardless of property order', () => {
      const payload1 = { amount: 100, currency: 'USD' };
      const payload2 = { currency: 'USD', amount: 100 };

      expect(hashPayload(payload1)).toBe(hashPayload(payload2));
    });

    it('should generate different hash for different payloads', () => {
      const payload1 = { amount: 100 };
      const payload2 = { amount: 200 };

      expect(hashPayload(payload1)).not.toBe(hashPayload(payload2));
    });

    it('should return 64-character hex hash', () => {
      const hash = hashPayload({ test: 'data' });

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('cleanupOldEvents', () => {
    it('should delete old events and return count', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock([{ id: '1' }, { id: '2' }]))
      } as any);

      const count = await cleanupOldEvents(30);

      expect(count).toBe(2);
    });

    it('should return 0 when no events to delete', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock([]))
      } as any);

      const count = await cleanupOldEvents();

      expect(count).toBe(0);
    });

    it('should throw on error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { message: 'DB error' }))
      } as any);

      await expect(cleanupOldEvents()).rejects.toThrow();
    });
  });

  describe('getWebhookStats', () => {
    it('should return stats', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const mockEvents = [
        { event_type: 'payment.completed', processed_at: new Date().toISOString() },
        { event_type: 'payment.completed', processed_at: new Date().toISOString() },
        { event_type: 'payment.failed', processed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockEvents))
      } as any);

      const stats = await getWebhookStats();

      expect(stats.totalProcessed).toBe(3);
      expect(stats.byType['payment.completed']).toBe(2);
      expect(stats.byType['payment.failed']).toBe(1);
      expect(stats.last24Hours).toBe(2);
    });

    it('should handle empty result', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock([]))
      } as any);

      const stats = await getWebhookStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.last24Hours).toBe(0);
    });

    it('should throw on error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null, { message: 'DB error' }))
      } as any);

      await expect(getWebhookStats()).rejects.toThrow();
    });
  });
});
