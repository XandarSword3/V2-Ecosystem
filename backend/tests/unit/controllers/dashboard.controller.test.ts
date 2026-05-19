import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { getSupabase } from '../../../src/database/connection';
import { getDashboard, getRevenueStats } from '../../../src/modules/admin/controllers/dashboard.controller';

describe('DashboardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard statistics successfully', async () => {
      // Source queries 'transactions' table with eq('reference_table',...) or eq('engine_type',...)
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'transactions') {
          const chain = createChainableMock([], null, 5);
          chain.eq = vi.fn().mockImplementation(() => {
            const inner = createChainableMock([], null, 5);
            inner.eq = vi.fn().mockReturnThis();
            inner.gte = vi.fn().mockReturnThis();
            inner.lte = vi.fn().mockReturnThis();
            inner.order = vi.fn().mockReturnThis();
            inner.limit = vi.fn().mockResolvedValue({ data: [], error: null });
            return inner;
          });
          return chain;
        }
        if (table === 'users') {
          return createChainableMock(null, null, 100);
        }
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          revenueByUnit: expect.any(Object),
          breakdown: expect.any(Object),
          trends: expect.any(Object)
        })
      }));
    });

    it('should handle database errors gracefully', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getDashboard(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle empty data sets', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([], null, 0));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes();
      await getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          todayOrders: 0,
          todayRevenue: 0,
          todayBookings: 0,
          todayTickets: 0
        })
      }));
    });
  });

  describe('getRevenueStats', () => {
    it('should return revenue stats for default date range', async () => {
      const mockRevenueData = [
        { total_amount: '100.00', created_at: '2026-01-10T10:00:00Z' },
        { total_amount: '150.00', created_at: '2026-01-11T10:00:00Z' }
      ];

      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockRevenueData));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getRevenueStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          chartData: expect.any(Array),
          totals: expect.any(Object),
          grandTotal: expect.any(Number),
          dateRange: expect.any(Object)
        })
      }));
    });

    it('should accept custom date range', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: {
          startDate: '2026-01-01',
          endDate: '2026-01-15'
        }
      });
      await getRevenueStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          dateRange: expect.any(Object)
        })
      }));
    });

    it('should aggregate revenue by service correctly', async () => {
      // The chain is: from('transactions').select().eq(ref).gte().lte().eq('status','completed')
      // We use a thenable per from() call so the whole chain resolves via Promise.all
      const fromMock = vi.fn().mockImplementation((table: string) => {
        const thenable: Record<string, any> = {};
        if (table === 'modules') {
          thenable.select = vi.fn().mockReturnValue(thenable);
          thenable.then = (resolve: Function) =>
            Promise.resolve({ data: [{ id: 'res-id', slug: 'restaurant' }, { id: 'snack-id', slug: 'snack-bar' }], error: null }).then(resolve as any);
          return thenable;
        }

        let typeVal: string | null = null;
        thenable.select = vi.fn().mockReturnValue(thenable);
        thenable.eq = vi.fn().mockImplementation((col: string, val: string) => {
          if (col === 'module_id' || col === 'engine_type') {
            typeVal = val;
          }
          return thenable;
        });
        ['gte', 'lte', 'filter', 'not', 'order', 'limit'].forEach(m => {
          thenable[m] = vi.fn().mockReturnValue(thenable);
        });
        thenable.then = (resolve: Function, reject?: Function) => {
          let data: any[] = [];
          if (typeVal === 'res-id' || typeVal === 'restaurant') {
            data = [{ total_amount: '200.00', created_at: '2026-01-10T10:00:00Z' }];
          } else if (typeVal === 'snack-id' || typeVal === 'snack-bar') {
            data = [{ total_amount: '50.00',  created_at: '2026-01-10T10:00:00Z' }];
          } else if (typeVal === 'time_exclusive_reservation') {
            data = [{ total_amount: '300.00', created_at: '2026-01-10T10:00:00Z' }];
          } else if (typeVal === 'shared_capacity_access') {
            data = [{ total_amount: '100.00', created_at: '2026-01-10T10:00:00Z' }];
          }
          return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
        };
        return thenable;
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getRevenueStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totals: {
            restaurant: 200,
            snack: 50,
            chalets: 300,
            pool: 100
          },
          grandTotal: 650
        })
      }));
    });

    it('should handle errors gracefully', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('DB Error');
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getRevenueStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
