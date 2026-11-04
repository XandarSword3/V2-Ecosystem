import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import unitsRoutes from '../../../src/routes/units.routes.js';

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

vi.mock('../../../src/middleware/auth.middleware.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.user || { userId: 'user-guest-1', roles: ['customer'] };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: vi.fn(() => ({
    calculatePricing: vi.fn().mockResolvedValue({
      totalAmount: 300,
      currency: 'USD',
      taxAmount: 30,
      netAmount: 270,
    }),
  })),
}));

vi.mock('../../../src/engines/currency-resolver.js', () => ({
  resolveModuleCurrency: vi.fn().mockResolvedValue('USD'),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { createChainableMock } from '../utils.js';

describe('units.routes Unit & Booking Operations', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/units', unitsRoutes);
  });

  describe('GET /units', () => {
    it('should list all active bookable units and normalize price attributes', async () => {
      const mockUnits = [
        {
          id: 'unit-1',
          name: 'Deluxe Suite',
          description: 'Ocean view suite',
          price: 150.0,
          capacity: 4,
          is_active: true,
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'bookable_units') {
            return createChainableMock(mockUnits);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).get('/units');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].base_price).toBe(150.0);
      expect(res.body.data[0].price).toBe(150.0);
    });

    it('should handle database error when fetching units', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => {
          throw new Error('Database cluster unavailable');
        }),
      } as any);

      const res = await request(app).get('/units');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Database cluster unavailable');
    });
  });

  describe('GET /units/availability', () => {
    it('should return availability list of all active units', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'bookable_units') {
            return createChainableMock([{ id: 'unit-2', name: 'Cabin', price: 90, is_active: true }]);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).get('/units/availability');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /units/:id/availability', () => {
    it('should return 400 when startDate or endDate missing', async () => {
      const res = await request(app).get('/units/unit-1/availability');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('startDate and endDate required');
    });

    it('should return 404 when unit does not exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const res = await request(app)
        .get('/units/unit-none/availability')
        .query({ startDate: '2026-12-01', endDate: '2026-12-10' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Unit not found');
    });

    it('should compute blocked dates from existing confirmed transactions', async () => {
      const mockBookings = [
        {
          status: 'confirmed',
          metadata: {
            unit_id: 'unit-1',
            check_in_date: '2026-12-02',
            check_out_date: '2026-12-05',
          },
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'bookable_units') {
            return createChainableMock({ id: 'unit-1' });
          }
          if (table === 'transactions') {
            return createChainableMock(mockBookings);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .get('/units/unit-1/availability')
        .query({ startDate: '2026-12-01', endDate: '2026-12-10' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.blockedDates).toEqual(['2026-12-02', '2026-12-03', '2026-12-04']);
    });
  });

  describe('POST /units/bookings', () => {
    it('should reject missing booking dates with 400', async () => {
      const res = await request(app).post('/units/bookings').send({ unit_id: 'unit-1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unit_id, check_in_date and check_out_date are required');
    });

    it('should reject past booking dates with 400', async () => {
      const res = await request(app).post('/units/bookings').send({
        unit_id: 'unit-1',
        check_in_date: '2020-01-01',
        check_out_date: '2020-01-05',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot book dates in the past');
    });

    it('should calculate pricing through Engine Service and record reservation transaction', async () => {
      const mockUnit = {
        id: 'unit-100',
        name: 'Presidential Suite',
        base_price: 350.0,
        module_id: 'mod-suites',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
      };
      const mockModule = {
        id: 'mod-suites',
        tax_category: 'lodging',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
      };
      const mockCreatedTx = {
        id: 'tx-res-1',
        module_id: 'mod-suites',
        customer_id: 'user-guest-1',
        status: 'pending',
        amount: 300,
        created_at: new Date().toISOString(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'accommodation_units') {
            return createChainableMock(mockUnit);
          }
          if (table === 'modules') {
            return createChainableMock(mockModule);
          }
          if (table === 'transactions') {
            return createChainableMock(mockCreatedTx);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).post('/units/bookings').send({
        unit_id: 'unit-100',
        check_in_date: '2026-12-15',
        check_out_date: '2026-12-18',
        number_of_guests: 2,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('tx-res-1');
      expect(res.body.data.amount).toBe(300);
    });
  });
});
