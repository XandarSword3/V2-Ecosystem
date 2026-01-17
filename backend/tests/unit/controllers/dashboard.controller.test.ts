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
      const mockOrderData = [{ total_amount: '100.00' }, { total_amount: '50.00' }];
      const mockRecentOrders = [
        { id: 'order-1', order_number: 'R-001', customer_name: 'John', status: 'completed', total_amount: '100.00', created_at: '2026-01-15T10:00:00Z', items: [{ id: 'i-1' }] }
      ];

      const queryBuilder = createChainableMock([]);
      // Override from to return different results for different tables
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') {
          // For count queries (head: true)
          const mock = createChainableMock(null, null, 5);
          mock.select = vi.fn().mockImplementation((_, opts) => {
            if (opts?.head) return createChainableMock(null, null, 5);
            if (_ && _.includes('items')) return createChainableMock(mockRecentOrders);
            return createChainableMock(mockOrderData);
          });
          return mock;
        }
        if (table === 'snack_orders') {
          const mock = createChainableMock(null, null, 3);
          mock.select = vi.fn().mockImplementation((_, opts) => {
            if (opts?.head) return createChainableMock(null, null, 3);
            return createChainableMock([{ total_amount: '30.00' }]);
          });
          return mock;
        }
        if (table === 'chalet_bookings') {
          const mock = createChainableMock(null, null, 2);
          mock.select = vi.fn().mockImplementation((_, opts) => {
            if (opts?.head) return createChainableMock(null, null, 2);
            return createChainableMock([{ total_amount: '200.00' }]);
          });
          return mock;
        }
        if (table === 'pool_tickets') {
          const mock = createChainableMock(null, null, 10);
          mock.select = vi.fn().mockImplementation((_, opts) => {
            if (opts?.head) return createChainableMock(null, null, 10);
            return createChainableMock([{ total_amount: '80.00' }]);
          });
          return mock;
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
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') {
          return createChainableMock([{ total_amount: '200.00', created_at: '2026-01-10T10:00:00Z' }]);
        }
        if (table === 'snack_orders') {
          return createChainableMock([{ total_amount: '50.00', created_at: '2026-01-10T10:00:00Z' }]);
        }
        if (table === 'chalet_bookings') {
          return createChainableMock([{ total_amount: '300.00', created_at: '2026-01-10T10:00:00Z' }]);
        }
        if (table === 'pool_tickets') {
          return createChainableMock([{ total_amount: '100.00', created_at: '2026-01-10T10:00:00Z' }]);
        }
        return createChainableMock([]);
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
