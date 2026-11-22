/**
 * Test Suite B: Idempotency Guard Tests
 * 
 * Tests the idempotency key system:
 *   - First-time execution
 *   - Duplicate detection and cached result return
 *   - Conflict handling (concurrent processing)
 *   - Failed operation retry
 *   - Key generation
 *   - Cleanup of expired keys
 */
import { IdempotencyGuard, IdempotencyConflictError } from '../../../src/engines/idempotency-guard.js';

// ============================================
// Mock Setup
// ============================================

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockLt = vi.fn();

// Chain builders
function chainableUpdate() {
  // The guard's failure path is `.update({...}).eq('key', ...).eq('status', ...)`.
  // Make `eq` return the same thenable chain so any number of filters work and
  // awaiting the final link resolves the write result.
  const chain: any = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  chain.eq = vi.fn(() => chain);
  return chain;
}

function setupSelectChain(data: unknown, error: unknown = null) {
  mockSupabase.from.mockReturnValue({
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        single: mockSingle.mockResolvedValue({ data, error }),
      }),
    }),
    upsert: mockUpsert.mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue(chainableUpdate()),
    delete: mockDelete.mockReturnValue({
      lt: mockLt.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  });
}

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('IdempotencyGuard', () => {
  let guard: IdempotencyGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new IdempotencyGuard(24 * 60 * 60 * 1000); // 24h TTL
  });

  // ============================================
  // Key Generation
  // ============================================

  describe('generateKey', () => {
    it('should generate a deterministic key from components', () => {
      const key = guard.generateKey('tenant-1', 'instant_transaction', 'order-1', 'confirm');
      expect(key).toBe('tenant-1:instant_transaction:order-1:confirm');
    });

    it('should include nonce when provided', () => {
      const key = guard.generateKey('tenant-1', 'instant_transaction', 'order-1', 'confirm', 'stripe_pi_123');
      expect(key).toBe('tenant-1:instant_transaction:order-1:confirm:stripe_pi_123');
    });

    it('should produce different keys for different actions', () => {
      const key1 = guard.generateKey('t', 'e', 'id', 'confirm');
      const key2 = guard.generateKey('t', 'e', 'id', 'cancel');
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different entities', () => {
      const key1 = guard.generateKey('t', 'e', 'id1', 'confirm');
      const key2 = guard.generateKey('t', 'e', 'id2', 'confirm');
      expect(key1).not.toBe(key2);
    });
  });

  // ============================================
  // First-Time Execution
  // ============================================

  describe('executeOnce — first time', () => {
    it('should claim the key, execute the operation, and cache the result', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { claimed: true, status: 'processing', claim_token: 'token-1' },
        error: null,
      });

      const update = vi.fn().mockReturnValue(chainableUpdate());
      mockSupabase.from = vi.fn().mockReturnValue({
        update,
      });

      let executed = false;
      const result = await guard.executeOnce(
        'test-key',
        'tenant-1',
        'instant_transaction',
        'order-1',
        'confirm',
        async () => {
          executed = true;
          return { orderId: 'order-1', total: 100 };
        },
      );

      expect(executed).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'claim_engine_idempotency_key',
        expect.objectContaining({
          p_key: 'test-key',
          p_tenant_id: 'tenant-1',
          p_engine_type: 'instant_transaction',
          p_entity_id: 'order-1',
          p_action: 'confirm',
        }),
      );
      expect(result.isNew).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.result).toEqual({ orderId: 'order-1', total: 100 });
      expect(result.key).toBe('test-key');
    });

    it('fails closed when the claim RPC errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'db down' },
      });

      await expect(
        guard.executeOnce('test-key', 't', 'e', 'id', 'a', async () => 'result'),
      ).rejects.toThrow(/Idempotency claim failed/);
    });

    it('marks the key failed when the operation throws, so a retry can re-run', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { claimed: true, status: 'processing', claim_token: 'token-1' },
        error: null,
      });

      const update = vi.fn().mockReturnValue(chainableUpdate());
      mockSupabase.from = vi.fn().mockReturnValue({ update });

      await expect(
        guard.executeOnce('test-key', 't', 'e', 'id', 'a', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });

  // ============================================
  // Duplicate Detection
  // ============================================

  describe('executeOnce — duplicate', () => {
    it('should return cached result for completed key', async () => {
      const cachedData = { orderId: 'order-1', total: 100 };

      mockSupabase.rpc.mockResolvedValue({
        data: { claimed: false, status: 'completed', result_data: cachedData },
        error: null,
      });

      let executed = false;
      const result = await guard.executeOnce(
        'test-key',
        'tenant-1',
        'instant_transaction',
        'order-1',
        'confirm',
        async () => {
          executed = true;
          return { orderId: 'new', total: 200 };
        },
      );

      expect(executed).toBe(false); // Operation NOT re-executed
      expect(result.isNew).toBe(false);
      expect(result.isDuplicate).toBe(true);
      expect(result.result).toEqual(cachedData);
    });
  });

  // ============================================
  // Conflict Handling
  // ============================================

  describe('executeOnce — conflict', () => {
    it('should throw IdempotencyConflictError for processing key', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { claimed: false, status: 'processing' },
        error: null,
      });

      await expect(
        guard.executeOnce(
          'test-key',
          'tenant-1',
          'instant_transaction',
          'order-1',
          'confirm',
          async () => 'result',
        ),
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it('should include key in conflict error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { claimed: false, status: 'processing' },
        error: null,
      });

      try {
        await guard.executeOnce('my-key', 't', 'e' as any, 'id', 'a', async () => 'r');
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(IdempotencyConflictError);
        expect((err as IdempotencyConflictError).key).toBe('my-key');
        expect((err as IdempotencyConflictError).statusCode).toBe(409);
      }
    });
  });

  // ============================================
  // isProcessed
  // ============================================

  describe('isProcessed', () => {
    it('should return true for completed key', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'completed' },
              error: null,
            }),
          }),
        }),
      });

      const result = await guard.isProcessed('test-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await guard.isProcessed('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for processing key', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { status: 'processing' },
              error: null,
            }),
          }),
        }),
      });

      const result = await guard.isProcessed('test-key');
      expect(result).toBe(false);
    });
  });

  // ============================================
  // Error Types
  // ============================================

  describe('IdempotencyConflictError', () => {
    it('should have correct properties', () => {
      const error = new IdempotencyConflictError('test message', 'test-key');
      expect(error.name).toBe('IdempotencyConflictError');
      expect(error.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.key).toBe('test-key');
      expect(error.message).toBe('test message');
    });
  });
});
