import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  blacklistToken,
  isTokenBlacklisted,
  pruneExpiredBlacklistEntries,
} from '../../../src/services/token-blacklist.service.js';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { createChainableMock } from '../utils.js';

describe('TokenBlacklistService (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('blacklistToken', () => {
    it('should upsert token blacklist entry with provided tenantId', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            const chain = createChainableMock(null);
            chain.upsert = mockUpsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const expiry = new Date(Date.now() + 3600000);
      await blacklistToken('jwt-jti-123', 'user-1', expiry, 'tenant-abc');

      expect(mockUpsert).toHaveBeenCalledWith(
        {
          jti: 'jwt-jti-123',
          user_id: 'user-1',
          expires_at: expiry.toISOString(),
          tenant_id: 'tenant-abc',
        },
        { onConflict: 'jti' }
      );
    });

    it('should resolve tenant_id from users table when not provided', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return createChainableMock({ tenant_id: 'tenant-resolved-from-user' });
          }
          if (table === 'token_blacklist') {
            const chain = createChainableMock(null);
            chain.upsert = mockUpsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const expiry = new Date(Date.now() + 3600000);
      await blacklistToken('jwt-jti-456', 'user-2', expiry);

      expect(mockUpsert).toHaveBeenCalledWith(
        {
          jti: 'jwt-jti-456',
          user_id: 'user-2',
          expires_at: expiry.toISOString(),
          tenant_id: 'tenant-resolved-from-user',
        },
        { onConflict: 'jti' }
      );
    });

    it('should handle upsert error non-fatally without throwing', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'DB connection dropped' } });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            const chain = createChainableMock(null);
            chain.upsert = mockUpsert;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const expiry = new Date(Date.now() + 3600000);
      await expect(blacklistToken('jwt-jti-err', 'user-3', expiry, 'tenant-1')).resolves.toBeUndefined();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true when active blacklist entry found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            return createChainableMock({ jti: 'jwt-revoked' });
          }
          return createChainableMock(null);
        }),
      } as any);

      const isRevoked = await isTokenBlacklisted('jwt-revoked');
      expect(isRevoked).toBe(true);
    });

    it('should return false when no active blacklist entry found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            return createChainableMock(null);
          }
          return createChainableMock(null);
        }),
      } as any);

      const isRevoked = await isTokenBlacklisted('jwt-valid');
      expect(isRevoked).toBe(false);
    });

    it('should fail open and return false when database query throws', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => {
          throw new Error('Database unreachable');
        }),
      } as any);

      const isRevoked = await isTokenBlacklisted('jwt-crash');
      expect(isRevoked).toBe(false);
    });
  });

  describe('pruneExpiredBlacklistEntries', () => {
    it('should delete expired entries and return pruned count', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            return createChainableMock([{ jti: 'expired-1' }, { jti: 'expired-2' }, { jti: 'expired-3' }]);
          }
          return createChainableMock(null);
        }),
      } as any);

      const count = await pruneExpiredBlacklistEntries();
      expect(count).toBe(3);
    });

    it('should handle deletion error and return 0', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'token_blacklist') {
            return createChainableMock(null, { message: 'Prune error' });
          }
          return createChainableMock(null);
        }),
      } as any);

      const count = await pruneExpiredBlacklistEntries();
      expect(count).toBe(0);
    });
  });
});
