import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';
import * as gdprController from '../../../src/modules/users/gdpr.controller';
import { getSupabase } from '../../../src/database/connection';
import { logActivity } from '../../../src/utils/activityLogger';

// Mock dependencies
vi.mock('../../../src/database/connection');
vi.mock('../../../src/utils/activityLogger');
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('GDPR Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logActivity).mockResolvedValue(undefined);
  });

  describe('exportUserData', () => {
    it('should export all user data', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', full_name: 'Test User', created_at: '2024-01-01' };
      const mockTransactions = [
        { id: 'tx-1', engine_type: 'instant_transaction', amount: 50 },
        { id: 'tx-2', engine_type: 'time_exclusive_reservation', amount: 200 },
      ];

      // Build a fully chainable thenable — every method returns the same object,
      // and the object itself is awaitable (Promise.all resolves it via .then).
      const makeOrderChain = (data: unknown[]) => {
        const chain: Record<string, unknown> = {};
        ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'filter', 'not', 'or', 'in', 'contains'].forEach(m => {
          chain[m] = vi.fn().mockReturnValue(chain);
        });
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        // Make the chain itself awaitable
        chain.then = (resolve: Function, reject?: Function) =>
          Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
        return chain;
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            };
          }
          if (table === 'transactions') return makeOrderChain(mockTransactions);
          // All other tables return empty arrays
          return makeOrderChain([]);
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' }
      });

      await gdprController.exportUserData(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          profile: mockUser,
          orders: expect.any(Object),
          reservations: expect.any(Object)
        }),
        exportedAt: expect.any(String)
      }));
      expect(logActivity).toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          const chain: Record<string, unknown> = {};
          ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'filter', 'not', 'or', 'in', 'contains'].forEach(m => {
            chain[m] = vi.fn().mockReturnValue(chain);
          });
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          // users table: single() returns 404 error; all other tables: single() returns null,null
          chain.single = table === 'users'
            ? vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            : vi.fn().mockResolvedValue({ data: null, error: null });
          chain.then = (resolve: Function, reject?: Function) =>
            Promise.resolve({ data: [], error: null }).then(resolve as any, reject as any);
          return chain;
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-999' }
      });

      await gdprController.exportUserData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      const error = new Error('Database error');
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw error;
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' }
      });

      await gdprController.exportUserData(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data when confirmed', async () => {
      const mockUser = { email: 'test@test.com', full_name: 'Test User' };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          const baseChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ error: null, count: 1 })
          };

          baseChain.delete = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
            in: vi.fn().mockResolvedValue({ error: null, count: 0 })
          });

          baseChain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null, count: 1 })
          });

          return baseChain;
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' },
        body: { confirmDeletion: true }
      });

      await gdprController.deleteUserData(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.any(String)
      }));
    });

    it('should return 400 if deletion not confirmed', async () => {
      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' },
        body: {}
      });

      await gdprController.deleteUserData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Deletion must be explicitly confirmed',
        message: 'Set confirmDeletion: true in the request body to proceed with account deletion'
      });
    });

    it('should return 404 if user not found during deletion', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-999' },
        body: { confirmDeletion: true }
      });

      await gdprController.deleteUserData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
    });
  });

  describe('getPortableData', () => {
    const makePortableChain = (data: unknown[], singleData: unknown = null) => {
      const chain: Record<string, unknown> = {};
      ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'filter', 'not', 'or', 'in', 'contains'].forEach(m => {
        chain[m] = vi.fn().mockReturnValue(chain);
      });
      chain.single = vi.fn().mockResolvedValue({ data: singleData, error: singleData ? null : { code: 'PGRST116' } });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.then = (resolve: Function, reject?: Function) =>
        Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
      return chain;
    };

    it('should return data in portable JSON format', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', full_name: 'Test' };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') return makePortableChain([], mockUser);
          return makePortableChain([]);
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' },
        query: { format: 'json' }
      });

      await gdprController.getPortableData(req, res, next);

      expect(res.setHeader).toHaveBeenCalled();
    });

    it('should return data in CSV format', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', full_name: 'Test' };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') return makePortableChain([], mockUser);
          return makePortableChain([]);
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        user: { userId: 'user-1' },
        query: { format: 'csv' }
      });

      await gdprController.getPortableData(req, res, next);

      expect(res.setHeader).toHaveBeenCalled();
    });
  });
});
