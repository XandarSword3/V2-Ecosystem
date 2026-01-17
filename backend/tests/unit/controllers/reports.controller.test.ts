import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../src/database/connection';
import { getOverviewReport, exportReport } from '../../../src/modules/admin/controllers/reports.controller';

describe('ReportsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOverviewReport', () => {
    it('should return overview report with all metrics', async () => {
      const mockRestaurantOrders = [
        { id: 'r-1', status: 'completed', total_amount: '100.00', created_at: '2026-01-10T10:00:00Z' },
        { id: 'r-2', status: 'completed', total_amount: '50.00', created_at: '2026-01-10T11:00:00Z' }
      ];
      const mockSnackOrders = [
        { id: 's-1', status: 'completed', total_amount: '25.00', created_at: '2026-01-10T12:00:00Z' }
      ];
      const mockChaletBookings = [
        { id: 'c-1', payment_status: 'paid', total_amount: '200.00', created_at: '2026-01-10T08:00:00Z' }
      ];
      const mockPoolTickets = [
        { id: 'p-1', payment_status: 'paid', total_amount: '30.00', created_at: '2026-01-10T09:00:00Z' }
      ];
      const mockOrderItems = [
        { quantity: 2, unit_price: 25, menu_items: { name: 'Burger' } }
      ];
      const mockSnackItems = [
        { quantity: 3, unit_price: 5, snack_items: { name: 'Chips' } }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockRestaurantOrders);
        if (table === 'snack_orders') return createChainableMock(mockSnackOrders);
        if (table === 'chalet_bookings') return createChainableMock(mockChaletBookings);
        if (table === 'pool_tickets') return createChainableMock(mockPoolTickets);
        if (table === 'users') return createChainableMock(null, null, 50);
        if (table === 'restaurant_order_items') return createChainableMock(mockOrderItems);
        if (table === 'snack_order_items') return createChainableMock(mockSnackItems);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: { range: 'month' } });
      await getOverviewReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          overview: expect.objectContaining({
            totalRevenue: expect.any(Number),
            totalOrders: expect.any(Number),
            totalBookings: expect.any(Number),
            totalUsers: 50
          }),
          revenueByService: expect.objectContaining({
            restaurant: 150,
            snackBar: 25,
            chalets: 200,
            pool: 30
          }),
          topItems: expect.any(Array)
        })
      }));
    });

    it('should calculate revenue correctly', async () => {
      const mockOrders = [
        { id: 'r-1', status: 'completed', total_amount: '100.00', created_at: '2026-01-10T10:00:00Z' },
        { id: 'r-2', status: 'pending', total_amount: '50.00', created_at: '2026-01-10T11:00:00Z' } // Not completed, should be excluded
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_orders') return createChainableMock(mockOrders);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getOverviewReport(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.revenueByService.restaurant).toBe(100); // Only completed
    });

    it('should handle week range', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: { range: 'week' } });
      await getOverviewReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should handle year range', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: { range: 'year' } });
      await getOverviewReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should sort top items by revenue', async () => {
      const mockOrderItems = [
        { quantity: 1, unit_price: 10, menu_items: { name: 'Cheap Item' } },
        { quantity: 5, unit_price: 50, menu_items: { name: 'Expensive Item' } }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_order_items') return createChainableMock(mockOrderItems);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getOverviewReport(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.topItems[0].name).toBe('Expensive Item');
    });

    it('should limit top items to 5', async () => {
      const mockOrderItems = Array.from({ length: 10 }, (_, i) => ({
        quantity: 1,
        unit_price: 10 * (i + 1),
        menu_items: { name: `Item ${i}` }
      }));

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'restaurant_order_items') return createChainableMock(mockOrderItems);
        return createChainableMock([]);
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getOverviewReport(req, res, next);

      const response = (res.json as any).mock.calls[0][0];
      expect(response.data.topItems.length).toBeLessThanOrEqual(5);
    });

    it('should handle errors gracefully', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('DB Error');
      });
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({ query: {} });
      await getOverviewReport(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('exportReport', () => {
    it('should require report type', async () => {
      const { req, res, next } = createMockReqRes({ query: {} });
      await exportReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Report type is required'
      });
    });

    it('should export restaurant report', async () => {
      const mockOrders = [
        {
          order_number: 'R-001',
          customer_name: 'John Doe',
          order_type: 'dine-in',
          status: 'completed',
          subtotal: '85.00',
          tax_amount: '8.50',
          total_amount: '93.50',
          payment_status: 'paid',
          payment_method: 'card',
          created_at: '2026-01-10T10:00:00Z'
        }
      ];

      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockOrders));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'restaurant', format: 'csv' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('restaurant')
      );
    });

    it('should export snack report', async () => {
      const mockOrders = [
        {
          order_number: 'S-001',
          customer_name: 'Jane Smith',
          status: 'completed',
          total_amount: '15.00',
          payment_status: 'paid',
          created_at: '2026-01-10T11:00:00Z'
        }
      ];

      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockOrders));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'snack', format: 'csv' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should export chalet report', async () => {
      const mockBookings = [
        {
          booking_number: 'C-001',
          customer_name: 'Bob Wilson',
          customer_email: 'bob@test.com',
          check_in_date: '2026-01-15',
          check_out_date: '2026-01-17',
          number_of_guests: 2,
          number_of_nights: 2,
          base_amount: '250.00',
          total_amount: '300.00',
          status: 'confirmed',
          payment_status: 'paid',
          created_at: '2026-01-10T09:00:00Z'
        }
      ];

      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockBookings));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'chalets', format: 'csv' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should export pool report', async () => {
      const mockTickets = [
        {
          ticket_number: 'P-001',
          guest_name: 'Alice Brown',
          ticket_date: '2026-01-15',
          adults: 2,
          children: 1,
          total_amount: '45.00',
          payment_status: 'paid',
          created_at: '2026-01-10T08:00:00Z'
        }
      ];

      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockTickets));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'pool', format: 'csv' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should handle week range in export', async () => {
      const mockData = [{ order_number: 'R-001', customer_name: 'Test', order_type: 'dine-in', status: 'completed', subtotal: '10', tax_amount: '1', total_amount: '11', payment_status: 'paid', payment_method: 'card', created_at: '2026-01-10T10:00:00Z' }];
      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockData));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'restaurant', range: 'week' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should handle year range in export', async () => {
      const mockData = [{ order_number: 'R-001', customer_name: 'Test', order_type: 'dine-in', status: 'completed', subtotal: '10', tax_amount: '1', total_amount: '11', payment_status: 'paid', payment_method: 'card', created_at: '2026-01-10T10:00:00Z' }];
      const fromMock = vi.fn().mockImplementation(() => createChainableMock(mockData));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'restaurant', range: 'year' }
      });
      await exportReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should handle database errors', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock(null, new Error('DB Error')));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'restaurant' }
      });
      await exportReport(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle empty data gracefully', async () => {
      const fromMock = vi.fn().mockImplementation(() => createChainableMock([]));
      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        query: { type: 'restaurant', format: 'csv' }
      });
      await exportReport(req, res, next);

      // When empty, returns JSON with message
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringContaining('No data')
      }));
    });
  });
});
