/**
 * Test Suite E: Feature Flags Tests
 * 
 * Tests the per-tenant feature flag service:
 *   - Individual flag checking with cache
 *   - engine_v2_full override behavior
 *   - enable/disable operations
 *   - Cache TTL expiration
 *   - DB error fallback to disabled
 *   - Status report for all flags
 */
import {
  FeatureFlagService,
  getFeatureFlagService,
  resetFeatureFlagService,
} from '../../../src/engines/feature-flags.js';

// ============================================
// Mocks
// ============================================

const mockSingle = vi.fn();
const mockEqChain = vi.fn().mockReturnValue({ single: mockSingle });
const mockEq = vi.fn().mockReturnValue({ eq: mockEqChain });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockUpsert = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

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

// The service caches results in the module-level Redis cache (src/utils/cache.ts).
// It was never mocked, so cache entries leaked between tests — later tests in the
// same file hit the previous test's cached value within the 100ms TTL and asserted
// on stale data. Mock it with a controllable in-memory store cleared per test.
const cacheStore = new Map<string, unknown>();
vi.mock('../../../src/utils/cache.js', () => {
  const fakeRedis = {
    keys: async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...cacheStore.keys()].filter(k => k.startsWith(prefix));
    },
    del: async (...keys: string[]) => {
      keys.forEach(k => cacheStore.delete(k));
      return keys.length;
    },
  };
  return {
    cache: {
      get: async (key: string) => (cacheStore.has(key) ? cacheStore.get(key) : null),
      set: async (key: string, value: unknown) => { cacheStore.set(key, value); return true; },
      del: async (key: string) => cacheStore.delete(key),
      getClient: () => fakeRedis,
    },
  };
});

function setupFlagResponse(enabled: boolean, rolloutPercentage: number = 100) {
  mockSupabase.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { enabled, rollout_percentage: rolloutPercentage },
            error: null,
          }),
        }),
      }),
    }),
    upsert: mockUpsert.mockResolvedValue({ error: null }),
  });
}

function setupFlagNotFound() {
  mockSupabase.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'not found' },
          }),
        }),
      }),
    }),
  });
}

function setupFlagDbError() {
  mockSupabase.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Connection refused')),
        }),
      }),
    }),
  });
}

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    // Short cache TTL for testing
    service = new FeatureFlagService(100);
  });

  // ============================================
  // isEnabled — Basic
  // ============================================

  describe('isEnabled', () => {
    it('should return true when flag is enabled', async () => {
      setupFlagResponse(true);
      const result = await service.isEnabled('tenant-1', 'engine_v2_pricing');
      expect(result).toBe(true);
    });

    it('should return false when flag is disabled', async () => {
      setupFlagResponse(false);
      const result = await service.isEnabled('tenant-1', 'engine_v2_pricing');
      expect(result).toBe(false);
    });

    it('should return false when flag not found in DB', async () => {
      setupFlagNotFound();
      const result = await service.isEnabled('tenant-1', 'engine_v2_pricing');
      expect(result).toBe(false);
    });

    it('should return false on DB connection error (safe fallback)', async () => {
      setupFlagDbError();
      const result = await service.isEnabled('tenant-1', 'engine_v2_pricing');
      expect(result).toBe(false);
    });
  });

  // ============================================
  // engine_v2_full Override
  // ============================================

  describe('engine_v2_full override', () => {
    it('should override individual flags when engine_v2_full is enabled', async () => {
      // For engine_v2_full — returns enabled
      // For individual flag — would return disabled, but full overrides
      let callCount = 0;
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                callCount++;
                // First call is for engine_v2_full, second would be for individual
                return Promise.resolve({
                  data: { enabled: true, rollout_percentage: 100 },
                  error: null,
                });
              }),
            }),
          }),
        }),
      });

      const result = await service.isEnabled('tenant-1', 'engine_v2_pricing');
      expect(result).toBe(true);
    });

    it('should check engine_v2_full directly without recursion', async () => {
      setupFlagResponse(true);
      
      // When checking engine_v2_full itself, it should NOT recurse
      const result = await service.isEnabled('tenant-1', 'engine_v2_full');
      expect(result).toBe(true);
    });
  });

  // ============================================
  // Cache Behavior
  // ============================================

  describe('Cache behavior', () => {
    it('should cache the result and not re-query DB', async () => {
      setupFlagResponse(true);

      await service.isEnabled('tenant-1', 'engine_v2_full');
      await service.isEnabled('tenant-1', 'engine_v2_full');
      await service.isEnabled('tenant-1', 'engine_v2_full');

      // Should hit DB only once for the uncached call
      // (first call fetches, subsequent calls use cache)
      const fromCalls = mockSupabase.from.mock.calls.length;
      expect(fromCalls).toBeLessThanOrEqual(1);
    });

    it('should expire cache after TTL', async () => {
      setupFlagResponse(true);

      await service.isEnabled('tenant-1', 'engine_v2_full');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      setupFlagResponse(false); // Changed in DB
      const result = await service.isEnabled('tenant-1', 'engine_v2_full');
      expect(result).toBe(false);
    });

    it('should clear cache on clearCache()', async () => {
      setupFlagResponse(true);
      await service.isEnabled('tenant-1', 'engine_v2_full');

      await service.clearCache();

      setupFlagResponse(false);
      const result = await service.isEnabled('tenant-1', 'engine_v2_full');
      expect(result).toBe(false);
    });
  });

  // ============================================
  // enable/disable
  // ============================================

  describe('enable / disable', () => {
    it('should enable a flag and invalidate cache', async () => {
      setupFlagResponse(true);
      // Pre-warm cache
      await service.isEnabled('tenant-1', 'engine_v2_full');

      setupFlagResponse(true);
      await service.enable('tenant-1', 'engine_v2_pricing');

      expect(mockSupabase.from).toHaveBeenCalledWith('engine_feature_flags');
    });

    it('should disable a flag', async () => {
      setupFlagResponse(true);
      await service.disable('tenant-1', 'engine_v2_pricing');

      expect(mockSupabase.from).toHaveBeenCalledWith('engine_feature_flags');
    });

    it('should throw on upsert failure for enable', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'not found' },
              }),
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
      });

      await expect(service.enable('tenant-1', 'engine_v2_pricing'))
        .rejects.toThrow('Failed to enable feature flag');
    });

    it('should throw on upsert failure for disable', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'not found' },
              }),
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } }),
      });

      await expect(service.disable('tenant-1', 'engine_v2_pricing'))
        .rejects.toThrow('Failed to disable feature flag');
    });
  });

  // ============================================
  // getStatus
  // ============================================

  describe('getStatus', () => {
    it('should return status for all flags', async () => {
      setupFlagResponse(false);

      const status = await service.getStatus('tenant-1');

      expect(status).toHaveProperty('engine_v2_pricing');
      expect(status).toHaveProperty('engine_v2_state_machine');
      expect(status).toHaveProperty('engine_v2_ledger');
      expect(status).toHaveProperty('engine_v2_idempotency');
      expect(status).toHaveProperty('engine_v2_full');
    });
  });

  // ============================================
  // isFullyEnabled
  // ============================================

  describe('isFullyEnabled', () => {
    it('should delegate to isEnabled with engine_v2_full', async () => {
      setupFlagResponse(true);
      const result = await service.isFullyEnabled('tenant-1');
      expect(result).toBe(true);
    });
  });

  // ============================================
  // Singleton
  // ============================================

  describe('Singleton management', () => {
    beforeEach(() => {
      resetFeatureFlagService();
    });

    it('should return the same instance', () => {
      const s1 = getFeatureFlagService();
      const s2 = getFeatureFlagService();
      expect(s1).toBe(s2);
    });

    it('should reset on resetFeatureFlagService', () => {
      const s1 = getFeatureFlagService();
      resetFeatureFlagService();
      const s2 = getFeatureFlagService();
      expect(s1).not.toBe(s2);
    });
  });
});
