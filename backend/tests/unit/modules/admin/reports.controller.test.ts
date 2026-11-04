import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  getOverviewReport,
  getOccupancyReport,
  getCustomersReport,
} from '../../../../src/modules/admin/controllers/reports.controller.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
  getPool: vi.fn(),
}));

import { getPool, getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('ReportsController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      (req as any).propertyId = 'prop-rep-1';
      next();
    });

    app.get('/admin/reports/overview', getOverviewReport);
    app.get('/admin/reports/occupancy', getOccupancyReport);
    app.get('/admin/reports/customers', getCustomersReport);
  });

  describe('getOverviewReport', () => {
    it('should aggregate dynamic modules, compute revenue, orders, bookings, and customer counts via pool', async () => {
      const mockCurrentAgg = {
        rows: [
          {
            metadata_id: 'mod-1',
            name: 'Bistro',
            slug: 'bistro',
            engine_type: 'instant_transaction',
            count: 10,
            revenue: '250.00',
          },
          {
            metadata_id: 'mod-2',
            name: 'Chalets',
            slug: 'chalets',
            engine_type: 'time_exclusive_reservation',
            count: 2,
            revenue: '800.00',
          },
        ],
      };

      const mockPrevAgg = {
        rows: [
          {
            metadata_id: 'mod-1',
            name: 'Bistro',
            slug: 'bistro',
            engine_type: 'instant_transaction',
            count: 8,
            revenue: '200.00',
          },
        ],
      };

      const mockMonthlyRevenue = {
        rows: [{ month_key: '2026-10', revenue: '1050.00' }],
      };

      const mockTopItems = {
        rows: [
          { id: 'item-1', catalog_item_id: 'ci-1', quantity: 15, unit_price: '12.50', name: 'Club Sandwich' },
        ],
      };

      const mockUsers = {
        rows: [{ count: 25 }],
      };

      const mockQuery = vi.fn()
        .mockResolvedValueOnce(mockCurrentAgg)
        .mockResolvedValueOnce(mockPrevAgg)
        .mockResolvedValueOnce(mockMonthlyRevenue)
        .mockResolvedValueOnce(mockTopItems)
        .mockResolvedValueOnce(mockUsers);

      vi.mocked(getPool).mockReturnValue({
        query: mockQuery,
      } as any);

      const res = await request(app)
        .get('/admin/reports/overview')
        .query({ range: 'month' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview.totalRevenue).toBe(1050);
      expect(res.body.data.overview.totalOrders).toBe(10);
      expect(res.body.data.overview.totalBookings).toBe(2);
      expect(res.body.data.overview.totalUsers).toBe(25);
      expect(res.body.data.revenueByModule).toHaveLength(2);
    });

    it('should fallback to Supabase query path when pool throws an error', async () => {
      vi.mocked(getPool).mockReturnValue({
        query: vi.fn().mockRejectedValue(new Error('Pool unavailable')),
      } as any);

      const mockTxs = [
        { id: 't-1', amount: 50, created_at: new Date().toISOString(), engine_type: 'instant_transaction', metadata_id: 'm-1' },
      ];
      const mockModules = [{ id: 'm-1', slug: 'bistro', name: 'Bistro' }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'transactions') return createChainableMock(mockTxs);
          if (table === 'modules') return createChainableMock(mockModules);
          if (table === 'user_property_access') return createChainableMock(null, null, 10);
          return createChainableMock([]);
        }),
      } as any);

      const res = await request(app).get('/admin/reports/overview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview.totalRevenue).toBe(50);
      expect(res.body.data.overview.totalOrders).toBe(1);
    });
  });

  describe('getOccupancyReport', () => {
    it('should calculate booked nights, active units, and shared capacity occupancy', async () => {
      const mockBookings = [
        {
          id: 'b-1',
          metadata: {
            check_in_date: '2026-11-01',
            check_out_date: '2026-11-04',
          },
        },
      ];
      const mockTickets = [
        {
          id: 'tk-1',
          metadata: { number_of_guests: 4 },
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'accommodation_units') {
            return createChainableMock([], null, 10); // 10 active units
          }
          if (table === 'transactions') {
            return createChainableMock(mockBookings);
          }
          return createChainableMock([]);
        }),
      } as any);

      const res = await request(app).get('/admin/reports/occupancy');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.units).toBeDefined();
      expect(res.body.data.units.activeUnits).toBe(10);
    });
  });

  describe('getCustomersReport', () => {
    it('should aggregate customer transaction volume and identify top customers', async () => {
      const mockOrderData = [
        { customer_id: 'cust-1', amount: 100, metadata: { customer_name: 'Alice' } },
        { customer_id: 'cust-1', amount: 50, metadata: { customer_name: 'Alice' } },
        { customer_id: 'cust-2', amount: 300, metadata: { customer_name: 'Bob' } },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            return createChainableMock(mockOrderData);
          }
          return createChainableMock([]);
        }),
      } as any);

      const res = await request(app).get('/admin/reports/customers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.topCustomers).toBeDefined();
      expect(res.body.data.customerRetention).toBeDefined();
      expect(res.body.data.topCustomers).toHaveLength(2);
    });
  });
});
