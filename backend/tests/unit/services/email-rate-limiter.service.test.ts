import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock ioredis with all required methods
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      incr = vi.fn().mockResolvedValue(1);
      expire = vi.fn().mockResolvedValue(1);
      ttl = vi.fn().mockResolvedValue(10);
      get = vi.fn().mockResolvedValue('0');
      set = vi.fn().mockResolvedValue('OK');
      del = vi.fn().mockResolvedValue(1);
      keys = vi.fn().mockResolvedValue([]);
      quit = vi.fn().mockResolvedValue('OK');
    },
  };
});

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { emailRateLimiter } from '../../../src/services/email-rate-limiter.service';

describe('EmailRateLimiterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canSendGlobal', () => {
    it('should allow transactional email when under limit', async () => {
      const result = await emailRateLimiter.canSendGlobal('transactional');

      expect(result.allowed).toBe(true);
    });

    it('should allow marketing email when under limit', async () => {
      const result = await emailRateLimiter.canSendGlobal('marketing');

      expect(result.allowed).toBe(true);
    });

    it('should allow system email when under limit', async () => {
      const result = await emailRateLimiter.canSendGlobal('system');

      expect(result.allowed).toBe(true);
    });
  });

  describe('canSendToUser', () => {
    it('should allow email to user when under limit', async () => {
      const result = await emailRateLimiter.canSendToUser('user-id', 'transactional');

      expect(result.allowed).toBe(true);
    });
  });

  describe('canSendToEmail', () => {
    it('should allow email to address when under limit', async () => {
      const result = await emailRateLimiter.canSendToEmail('user@example.com');

      expect(result.allowed).toBe(true);
    });
  });

  describe('recordSend', () => {
    it('should record email sent without error', async () => {
      await expect(
        emailRateLimiter.recordSend('user@example.com', 'user-123', 'transactional')
      ).resolves.not.toThrow();
    });
  });

  describe('getUsageStats', () => {
    it('should return usage stats for category', async () => {
      const result = await emailRateLimiter.getUsageStats('transactional');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('minute');
      expect(result).toHaveProperty('hour');
      expect(result).toHaveProperty('day');
    });
  });

  describe('resetLimits', () => {
    it('should reset global limits without error', async () => {
      await expect(emailRateLimiter.resetLimits('global')).resolves.not.toThrow();
    });

    it('should reset user limits without error', async () => {
      await expect(emailRateLimiter.resetLimits('user', 'user@example.com')).resolves.not.toThrow();
    });
  });
});
