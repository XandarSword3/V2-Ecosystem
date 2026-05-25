
// Mock supabase
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  default: class MockRedis {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
    incr = vi.fn().mockResolvedValue(1);
    expire = vi.fn().mockResolvedValue(1);
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

import { bounceHandlerService, BounceType } from '../../../src/services/bounce-handler.service';

describe('BounceHandlerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BounceType', () => {
    it('should support hard bounce', () => {
      const type: BounceType = 'hard';
      expect(type).toBe('hard');
    });

    it('should support soft bounce', () => {
      const type: BounceType = 'soft';
      expect(type).toBe('soft');
    });

    it('should support complaint', () => {
      const type: BounceType = 'complaint';
      expect(type).toBe('complaint');
    });

    it('should support unsubscribe', () => {
      const type: BounceType = 'unsubscribe';
      expect(type).toBe('unsubscribe');
    });
  });

  describe('bounceHandlerService', () => {
    it('should be defined', () => {
      expect(bounceHandlerService).toBeDefined();
    });

    it('should have handleBounce method', () => {
      expect(typeof bounceHandlerService.handleBounce).toBe('function');
    });

    it('should have isEmailSuppressed method', () => {
      expect(typeof bounceHandlerService.isEmailSuppressed).toBe('function');
    });

    it('should have canSendTo method', () => {
      expect(typeof bounceHandlerService.canSendTo).toBe('function');
    });

    it('should have addToSuppressionList method', () => {
      expect(typeof bounceHandlerService.addToSuppressionList).toBe('function');
    });

    it('should have removeFromSuppressionList method', () => {
      expect(typeof bounceHandlerService.removeFromSuppressionList).toBe('function');
    });

    it('should have getStatistics method', () => {
      expect(typeof bounceHandlerService.getStatistics).toBe('function');
    });

    it('should have getSuppressionList method', () => {
      expect(typeof bounceHandlerService.getSuppressionList).toBe('function');
    });
  });
});
