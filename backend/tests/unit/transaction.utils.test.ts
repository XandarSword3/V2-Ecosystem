import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabaseClient = {
  from: vi.fn()
};

// Mock getSupabase
vi.mock('../../src/database/supabase', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient)
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { withTransaction, TransactionContext } from '../../src/utils/transaction';

describe('Transaction Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withTransaction', () => {
    it('should execute operation successfully without rollback', async () => {
      const result = await withTransaction(async (ctx) => {
        return { success: true, value: 'test' };
      });

      expect(result).toEqual({ success: true, value: 'test' });
    });

    it('should provide TransactionContext with supabase client', async () => {
      let capturedCtx: TransactionContext | null = null;

      await withTransaction(async (ctx) => {
        capturedCtx = ctx;
        return null;
      });

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.rollbackHandlers).toEqual([]);
    });

    it('should execute rollback handlers in reverse order on error', async () => {
      const executionOrder: number[] = [];

      const handler1 = vi.fn(async () => {
        executionOrder.push(1);
      });
      const handler2 = vi.fn(async () => {
        executionOrder.push(2);
      });
      const handler3 = vi.fn(async () => {
        executionOrder.push(3);
      });

      await expect(
        withTransaction(async (ctx) => {
          ctx.rollbackHandlers.push(handler1);
          ctx.rollbackHandlers.push(handler2);
          ctx.rollbackHandlers.push(handler3);
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      // Should execute in reverse order: 3, 2, 1
      expect(executionOrder).toEqual([3, 2, 1]);
    });

    it('should continue rollback even if one handler fails', async () => {
      const handler1 = vi.fn(async () => {});
      const handler2 = vi.fn(async () => {
        throw new Error('Rollback 2 failed');
      });
      const handler3 = vi.fn(async () => {});

      await expect(
        withTransaction(async (ctx) => {
          ctx.rollbackHandlers.push(handler1);
          ctx.rollbackHandlers.push(handler2);
          ctx.rollbackHandlers.push(handler3);
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // All handlers should be called even if one fails
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should not execute rollback handlers on success', async () => {
      const handler = vi.fn();

      const result = await withTransaction(async (ctx) => {
        ctx.rollbackHandlers.push(handler);
        return 'success';
      });

      expect(result).toBe('success');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should propagate the original error after rollback', async () => {
      const originalError = new Error('Original transaction error');

      await expect(
        withTransaction(async () => {
          throw originalError;
        })
      ).rejects.toThrow('Original transaction error');
    });

    it('should handle empty rollback handlers array', async () => {
      await expect(
        withTransaction(async () => {
          throw new Error('Error with no handlers');
        })
      ).rejects.toThrow('Error with no handlers');
    });

    it('should handle async operations within transaction', async () => {
      const asyncOperation = vi.fn().mockResolvedValue({ data: 'async result' });

      const result = await withTransaction(async (ctx) => {
        const data = await asyncOperation();
        return data;
      });

      expect(asyncOperation).toHaveBeenCalled();
      expect(result).toEqual({ data: 'async result' });
    });

    it('should support nested data structures in return value', async () => {
      const result = await withTransaction(async () => {
        return {
          booking: { id: '1', status: 'confirmed' },
          payment: { id: '2', amount: 100 },
          items: [{ name: 'item1' }, { name: 'item2' }]
        };
      });

      expect(result.booking).toEqual({ id: '1', status: 'confirmed' });
      expect(result.payment).toEqual({ id: '2', amount: 100 });
      expect(result.items).toHaveLength(2);
    });
  });
});
