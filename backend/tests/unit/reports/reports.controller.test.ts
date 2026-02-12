/**
 * Reports Controller Tests - Comprehensive
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createMockReqRes } from '../utils';

// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
    'contains', 'csv', 'head',
  ];
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  const mockRpc = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));

  return {
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => { responseQueue = []; responseIndex = 0; },
    build: () => ({ from: vi.fn().mockReturnValue(builder), rpc: mockRpc }),
    mockRpc,
  };
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    payouts = { list: vi.fn().mockResolvedValue({ data: [] }) };
    charges = { list: vi.fn().mockResolvedValue({ data: [] }) };
    paymentIntents = { list: vi.fn().mockResolvedValue({ data: [] }) };
    balanceTransactions = { list: vi.fn().mockResolvedValue({ data: [] }) };
    constructor() {}
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import { ReportsController, reportsController } from '../../../src/modules/reports/reports.controller';

describe('Reports Controller', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;
  let controller: ReportsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReportsController();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build() as any);
  });

  describe('getDailySalesReport', () => {
    it('should return daily sales data with summary', async () => {
      const mockData = [
        { report_date: '2024-01-01', total_revenue: '500.00', order_count: 10, booking_count: 2, discount_total: '50.00', cash_revenue: '200.00', card_revenue: '300.00' },
        { report_date: '2024-01-02', total_revenue: '750.00', order_count: 15, booking_count: 3, discount_total: '75.00', cash_revenue: '300.00', card_revenue: '450.00' },
      ];
      mockBuilder.queueResponse(mockData);

      const mocks = createMockReqRes({ query: { startDate: '2024-01-01', endDate: '2024-01-31' } });
      await controller.getDailySalesReport(mocks.req as Request, mocks.res as Response);

      expect(mocks.res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          dailyData: expect.any(Array),
          summary: { totalRevenue: 1250, totalOrders: 25, totalBookings: 5, totalDiscounts: 125, cashTotal: 500, cardTotal: 750 },
          dateRange: expect.any(Object),
        },
      });
    });

    it('should handle empty data', async () => {
      mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getDailySalesReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, new Error('Database error'));
      const mocks = createMockReqRes({ query: {} });
      await controller.getDailySalesReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getHourlyMetrics', () => {
    it('should return hourly metrics with peak hours', async () => {
      mockBuilder.queueResponse([
        { hour: 12, revenue: 200, order_count: 15 },
        { hour: 13, revenue: 250, order_count: 20 },
        { hour: 18, revenue: 300, order_count: 25 },
      ]);
      const mocks = createMockReqRes({ query: { date: '2024-01-15' } });
      await controller.getHourlyMetrics(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith({
        success: true,
        data: { hourlyData: expect.any(Array), peakHours: expect.any(Array), date: '2024-01-15' },
      });
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, new Error('DB error'));
      const mocks = createMockReqRes({ query: {} });
      await controller.getHourlyMetrics(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getProductPerformance', () => {
    it('should return grouped product performance', async () => {
      mockBuilder.queueResponse([
        { product_id: 'p1', product_name: 'Coffee', category: 'Drinks', quantity_sold: 100, total_revenue: '400.00', total_cost: '200.00', profit: '200.00' },
      ]);
      const mocks = createMockReqRes({ query: { limit: '10' } });
      await controller.getProductPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ products: expect.any(Array) }),
      }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, new Error('DB error'));
      const mocks = createMockReqRes({ query: {} });
      await controller.getProductPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCashCardVariance', () => {
    it('should return cash/card variance data', async () => {
      mockBuilder.queueResponse([
        { report_date: '2024-01-15', cash_revenue: '600.00', card_revenue: '900.00', total_revenue: '1500.00' },
      ]);
      const mocks = createMockReqRes({ query: { startDate: '2024-01-01', endDate: '2024-01-31' } });
      await controller.getCashCardVariance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, new Error('DB error'));
      const mocks = createMockReqRes({ query: {} });
      await controller.getCashCardVariance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStripeReconciliation', () => {
    it('should return reconciliation data', async () => {
      mockBuilder.queueResponse([
        { id: 'pay-1', amount: '100.00', payment_method: 'card' },
      ]);
      const mocks = createMockReqRes({ query: { startDate: '2024-01-01', endDate: '2024-01-31' } });
      await controller.getStripeReconciliation(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, new Error('DB error'));
      const mocks = createMockReqRes({ query: {} });
      await controller.getStripeReconciliation(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCohortAnalysis', () => {
    it('should return cohort analysis', async () => {
      mockBuilder.queueResponse([
        { id: 'u1', created_at: '2024-01-01T00:00:00Z' },
        { id: 'u2', created_at: '2024-01-15T00:00:00Z' },
      ]);
      mockBuilder.queueResponse([
        { user_id: 'u1', created_at: '2024-01-05T00:00:00Z', total_amount: 50 },
        { user_id: 'u1', created_at: '2024-02-10T00:00:00Z', total_amount: 75 },
      ]);
      const mocks = createMockReqRes({ query: { months: '3' } });
      await controller.getCohortAnalysis(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle user query error', async () => {
      mockBuilder.queueResponse(null, { message: 'DB error' });
      const mocks = createMockReqRes({ query: {} });
      await controller.getCohortAnalysis(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTimeSeries', () => {
    it('should return time series for revenue', async () => {
      mockBuilder.queueResponse([
        { report_date: '2024-01-15', total_revenue: '1500.00' },
        { report_date: '2024-01-14', total_revenue: '1200.00' },
      ]);
      const mocks = createMockReqRes({ query: { metric: 'revenue' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle orders metric', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15', order_count: 30 }]);
      const mocks = createMockReqRes({ query: { metric: 'orders' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle bookings metric', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15', booking_count: 5 }]);
      const mocks = createMockReqRes({ query: { metric: 'bookings' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle aov metric', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15', average_order_value: '50.00' }]);
      const mocks = createMockReqRes({ query: { metric: 'aov' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 for invalid metric', async () => {
      const mocks = createMockReqRes({ query: { metric: 'invalid' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: { metric: 'revenue' } });
      await controller.getTimeSeries(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('triggerDailyAggregation', () => {
    it('should trigger daily aggregation', async () => {
      mockBuilder.queueResponse({ success: true });
      const mocks = createMockReqRes({ body: { date: '2024-01-15' } });
      await controller.triggerDailyAggregation(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle RPC errors', async () => {
      mockBuilder.queueResponse(null, { message: 'RPC error' });
      const mocks = createMockReqRes({ body: {} });
      await controller.triggerDailyAggregation(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('exportReport', () => {
    it('should export daily_sales as JSON', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15', total_revenue: '1500' }]);
      const mocks = createMockReqRes({ query: { reportType: 'daily_sales', format: 'json' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalled();
    });

    it('should export product_performance as JSON', async () => {
      mockBuilder.queueResponse([{ product_name: 'Pizza' }]);
      const mocks = createMockReqRes({ query: { reportType: 'product_performance', format: 'json' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalled();
    });

    it('should export as CSV with headers', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15', total_revenue: '1500' }]);
      const mocks = createMockReqRes({ query: { reportType: 'daily_sales', format: 'csv' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.setHeader).toHaveBeenCalled();
    });

    it('should return 400 for invalid reportType', async () => {
      const mocks = createMockReqRes({ query: { reportType: 'invalid' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 for CSV with no data', async () => {
      mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { reportType: 'daily_sales', format: 'csv' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: { reportType: 'daily_sales' } });
      await controller.exportReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getExecutiveOverview', () => {
    it('should return executive overview', async () => {
      mockBuilder.queueResponse([{ total_revenue: '1500.00', order_count: 30 }]); // today
      mockBuilder.queueResponse([{ total_revenue: '15000.00', order_count: 300 }]); // mtd
      mockBuilder.queueResponse([{ total_revenue: '150000.00', order_count: 3000 }]); // ytd
      mockBuilder.queueResponse([{ total_revenue: '12000.00', order_count: 280 }]); // prev month
      mockBuilder.queueResponse([], null, 50); // active customers
      mockBuilder.queueResponse([], null, 2); // failed orders
      mockBuilder.queueResponse([], null, 1); // failed payments

      const mocks = createMockReqRes({ query: {} });
      await controller.getExecutiveOverview(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getExecutiveOverview(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getOrderFlow', () => {
    it('should return order flow analysis', async () => {
      mockBuilder.queueResponse([
        { id: 'o1', status: 'completed', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:30:00Z', total_amount: 50 },
        { id: 'o2', status: 'cancelled', created_at: '2024-01-15T12:00:00Z', updated_at: '2024-01-15T12:15:00Z', total_amount: 30 },
        { id: 'o3', status: 'pending', created_at: '2024-01-15T14:00:00Z', updated_at: '2024-01-15T14:00:00Z', total_amount: 80 },
      ]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getOrderFlow(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getOrderFlow(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCustomerIntelligence', () => {
    it('should return customer intelligence data', async () => {
      mockBuilder.queueResponse([
        { id: 'u1', created_at: '2024-01-01T00:00:00Z', status: 'active' },
        { id: 'u2', created_at: '2023-06-01T00:00:00Z', status: 'active' },
      ]);
      mockBuilder.queueResponse([
        { user_id: 'u1', created_at: '2024-01-15T00:00:00Z', total_amount: 100, status: 'completed' },
        { user_id: 'u2', created_at: '2024-01-10T00:00:00Z', total_amount: 200, status: 'completed' },
      ]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getCustomerIntelligence(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getCustomerIntelligence(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMenuPerformance', () => {
    it('should return menu performance data', async () => {
      mockBuilder.queueResponse([
        { product_name: 'Burger', product_id: 'p1', quantity: 50, unit_price: 15, total_price: 750, order_id: 'o1', orders: { created_at: '2024-01-15T12:00:00Z', status: 'completed' } },
      ]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getMenuPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getMenuPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPaymentsFinance', () => {
    it('should return payments finance data', async () => {
      mockBuilder.queueResponse([
        { id: 'pay-1', amount: '100.00', payment_method: 'card', status: 'completed', created_at: '2024-01-15T10:00:00Z' },
        { id: 'pay-2', amount: '50.00', payment_method: 'cash', status: 'completed', created_at: '2024-01-15T12:00:00Z' },
      ]);
      mockBuilder.queueResponse([]); // refunds
      mockBuilder.queueResponse([]); // outstanding
      const mocks = createMockReqRes({ query: {} });
      await controller.getPaymentsFinance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getPaymentsFinance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCapacityUtilization', () => {
    it('should return capacity utilization data', async () => {
      mockBuilder.queueResponse([
        { id: 'u1', name: 'Room 101', type: 'standard', capacity: 2, price_per_night: 100 },
      ]);
      mockBuilder.queueResponse([
        { unit_id: 'u1', check_in: '2024-01-10', check_out: '2024-01-12', status: 'confirmed', total_amount: 200 },
      ]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getCapacityUtilization(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getCapacityUtilization(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStaffPerformance', () => {
    it('should return staff performance data', async () => {
      mockBuilder.queueResponse([{ id: 's1', full_name: 'John', roles: ['staff'] }]);
      mockBuilder.queueResponse([{ created_by: 's1', total_amount: 100, status: 'completed' }]);
      mockBuilder.queueResponse([{ user_id: 's1', action: 'LOGIN', created_at: '2024-01-15T08:00:00Z' }]);
      const mocks = createMockReqRes({ query: {} });
      await controller.getStaffPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getStaffPerformance(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getComparativeAnalysis', () => {
    it('should return MoM comparison', async () => {
      mockBuilder.queueResponse([
        { report_date: '2024-01-15', total_revenue: '1500.00', order_count: 30, booking_count: 5, average_order_value: '50.00' },
      ]);
      mockBuilder.queueResponse([
        { report_date: '2023-12-15', total_revenue: '1200.00', order_count: 25, booking_count: 4, average_order_value: '48.00' },
      ]);
      const mocks = createMockReqRes({ query: { compareType: 'mom' } });
      await controller.getComparativeAnalysis(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle WoW comparison', async () => {
      mockBuilder.queueResponse([]);
      mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { compareType: 'wow' } });
      await controller.getComparativeAnalysis(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: {} });
      await controller.getComparativeAnalysis(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAuditReport', () => {
    it('should return audit logs', async () => {
      mockBuilder.queueResponse([
        { id: 'l1', user_id: 'u1', action: 'LOGIN', created_at: '2024-01-15T10:00:00Z' },
        { id: 'l2', user_id: 'u1', action: 'DISCOUNT', created_at: '2024-01-15T11:00:00Z' },
      ]);
      const mocks = createMockReqRes({ query: { startDate: '2024-01-01', endDate: '2024-01-31' } });
      await controller.getAuditReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter by type and userId', async () => {
      mockBuilder.queueResponse([]);
      const mocks = createMockReqRes({ query: { type: 'LOGIN', userId: 'u1' } });
      await controller.getAuditReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should handle errors', async () => {
      mockBuilder.queueResponse(null, { message: 'DB error' });
      const mocks = createMockReqRes({ query: {} });
      await controller.getAuditReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('exportComprehensiveReport', () => {
    it('should export comprehensive report as JSON', async () => {
      mockBuilder.queueResponse([{ report_date: '2024-01-15' }]);
      const mocks = createMockReqRes({ query: { reportTypes: 'daily_sales', format: 'json' } });
      await controller.exportComprehensiveReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.json).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      vi.mocked(getSupabase).mockImplementationOnce(() => { throw new Error('DB error'); });
      const mocks = createMockReqRes({ query: { reportTypes: 'daily_sales' } });
      await controller.exportComprehensiveReport(mocks.req as Request, mocks.res as Response);
      expect(mocks.res.status).toHaveBeenCalledWith(500);
    });
  });
});
