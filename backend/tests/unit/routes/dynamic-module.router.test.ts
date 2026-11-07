import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildModuleRouter } from '../../../src/routes/dynamic-module.router.js';
import { createChainableMock } from '../utils.js';

// Mock dependencies for the dynamic module router
vi.mock('../../../src/middleware/auth.middleware.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = req.user || { userId: 'user-1', roles: ['admin'], tenantId: 'tenant-1' };
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/middleware/moduleGuard.middleware.js', () => ({
  getModuleStatus: vi.fn().mockResolvedValue(true),
  requireModule: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/middleware/propertyAccess.middleware.js', () => ({
  requirePropertyAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../src/engines/currency-resolver.js', () => ({
  resolveModuleCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({
    calculatePricing: vi.fn().mockResolvedValue({
      totalAmount: 100,
      totalDiscount: 10,
      taxAmount: 5,
      discounts: [],
    }),
  }),
}));

vi.mock('../../../src/utils/qr-security.js', () => ({
  validatePayload: vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-token') {
      return { valid: true, payload: { id: 'order-123' } };
    }
    return { valid: false, error: 'Invalid or expired token' };
  }),
  generateQRCodeImage: vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,mockqr' }),
}));

vi.mock('../../../src/engines/order-status.service.js', () => ({
  actorForUser: vi.fn().mockReturnValue('staff'),
  resolveAction: vi.fn(),
  changeInstantTransactionOrderStatus: vi.fn().mockImplementation((_supabase, params) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      order: { id: params.orderId, status: params.requestedStatus },
    });
  }),
}));

import { getSupabase } from '../../../src/database/connection.js';

describe('DynamicModuleRouter (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Router Preset Selection & Fallbacks', () => {
    it('should reject unknown template types with HTTP 501', async () => {
      const app = express();
      app.use(express.json());

      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-1',
          slug: 'unknown-module',
          engine_type: 'completely_unknown_type',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const router = buildModuleRouter('completely_unknown_type');
      app.use('/api/v1/test-module', router);

      const res = await request(app).get('/api/v1/test-module/any-path');
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No dynamic route preset exists');
    });

    it('should reject platform_entitlement with HTTP 403', async () => {
      const app = express();
      app.use(express.json());

      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-platform',
          slug: 'platform-billing',
          engine_type: 'platform_entitlement',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const router = buildModuleRouter('platform_entitlement');
      app.use('/api/v1/platform-billing', router);

      const res = await request(app).get('/api/v1/platform-billing/plans');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('platform_entitlement is a platform-level engine');
    });

    it('should return 500 if mounted module context is missing', async () => {
      const app = express();
      app.use(express.json());

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/restaurant', router);

      const res = await request(app).get('/api/v1/restaurant/items');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Mounted module context is missing');
    });
  });

  describe('Instant Transaction Presets (Catalog & Service Locations)', () => {
    it('GET /categories lists categories for mounted module', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'catalog_categories') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'cat-1', name: 'Drinks', sort_order: 1 }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).get('/api/v1/bistro/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Drinks');
    });

    it('POST /admin/categories validates category name and creates record', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'cat-new-1', name: 'Desserts' },
            error: null,
          }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'catalog_categories') return { insert: mockInsert };
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      // Name missing -> 400
      const resMissing = await request(app).post('/api/v1/bistro/admin/categories').send({});
      expect(resMissing.status).toBe(400);

      // Valid name -> 201
      const resValid = await request(app).post('/api/v1/bistro/admin/categories').send({ name: 'Desserts' });
      expect(resValid.status).toBe(201);
      expect(resValid.body.data.name).toBe('Desserts');
    });

    it('GET /items lists active catalog items for module', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'catalog_items') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'item-1', name: 'Cheeseburger', price: 14.5, is_available: true }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).get('/api/v1/bistro/items');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].name).toBe('Cheeseburger');
    });

    it('Service location CRUD enforces validation and updates database', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'loc-1', name: 'Table 10', is_active: true, sort_order: 1 },
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'loc-1', name: 'Table 10 Updated' },
            error: null,
          }),
        }),
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'service_locations') {
            return {
              insert: mockInsert,
              update: mockUpdate,
              delete: mockDelete,
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      // POST Create
      const resPost = await request(app)
        .post('/api/v1/bistro/admin/service-locations')
        .send({ name: 'Table 10', sort_order: 1 });
      expect(resPost.status).toBe(201);
      expect(resPost.body.data.name).toBe('Table 10');

      // PUT Update
      const resPut = await request(app)
        .put('/api/v1/bistro/admin/service-locations/loc-1')
        .send({ name: 'Table 10 Updated' });
      expect(resPut.status).toBe(200);
      expect(resPut.body.data.name).toBe('Table 10 Updated');

      // DELETE
      const resDel = await request(app)
        .delete('/api/v1/bistro/admin/service-locations/loc-1');
      expect(resDel.status).toBe(200);
      expect(resDel.body.success).toBe(true);
    });

    it('GET /public/orders/:id/status validates token and returns order status', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'order-123', status: 'preparing', metadata: { estimated_ready_time: '15m' }, created_at: '2026-11-04' },
                error: null,
              }),
            };
          }
          if (table === 'order_items') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'oi-1', catalog_item_id: 'cat-item-1', quantity: 2, status: 'cooking' }],
                error: null,
              }),
            };
          }
          if (table === 'catalog_items') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'cat-item-1', name: 'Pizza' }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).get('/api/v1/bistro/public/orders/order-123/status?token=valid-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe('order-123');
      expect(res.body.data.items[0].name).toBe('Pizza');
    });

    it('POST /orders rejects empty items payload', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).post('/api/v1/bistro/orders').send({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('At least one item is required');
    });

    it('PATCH /orders/:id/status updates order status via engine state machine', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.user = { userId: 'staff-1', roles: ['staff'], tenantId: 'tenant-1' };
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      // Rejects missing status
      const badRes = await request(app)
        .patch('/api/v1/bistro/orders/ord-1/status')
        .send({});
      expect(badRes.status).toBe(400);
      expect(badRes.body.error).toBe('status is required');

      // Successfully updates status
      const okRes = await request(app)
        .patch('/api/v1/bistro/orders/ord-1/status')
        .send({ status: 'ready' });
      expect(okRes.status).toBe(200);
      expect(okRes.body.success).toBe(true);
      expect(okRes.body.data.status).toBe('ready');
    });

    it('DELETE /orders/:id rejects cancellation if order is not owned by the requesting customer', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.user = { userId: 'customer-attacker', roles: ['customer'], tenantId: 'tenant-1' };
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      // Mock transactions table returning order owned by someone else
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'transactions') {
            return createChainableMock({ id: 'ord-123', customer_id: 'customer-victim' });
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).delete('/api/v1/bistro/orders/ord-123');
      // Returns 404 to avoid leaking existence of another customer's order
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Order not found');
    });

    it('DELETE /orders/:id successfully cancels order owned by customer', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.user = { userId: 'customer-owner', roles: ['customer'], tenantId: 'tenant-1' };
        req.mountedModule = {
          id: 'mod-rest-1',
          slug: 'bistro',
          engine_type: 'instant_transaction',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      // Mock transactions table returning order owned by this customer
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'transactions') {
            return createChainableMock({ id: 'ord-123', customer_id: 'customer-owner' });
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('instant_transaction');
      app.use('/api/v1/bistro', router);

      const res = await request(app).delete('/api/v1/bistro/orders/ord-123');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });
  });

  describe('Time Exclusive Reservation Presets', () => {
    it('GET /availability queries bookable_units within dates', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-res-1',
          slug: 'chalets',
          engine_type: 'time_exclusive_reservation',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'bookable_units') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'unit-1', name: 'Cabin Alpha', base_price: 150 }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('time_exclusive_reservation');
      app.use('/api/v1/chalets', router);

      const res = await request(app).get('/api/v1/chalets/availability');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].name).toBe('Cabin Alpha');
    });

    it('POST /bookings validates required booking parameters', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-res-1',
          slug: 'chalets',
          engine_type: 'time_exclusive_reservation',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      const router = buildModuleRouter('time_exclusive_reservation');
      app.use('/api/v1/chalets', router);

      const resMissing = await request(app).post('/api/v1/chalets/bookings').send({ unit_id: 'unit-1' });
      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error).toContain('required');

      const resInvalidDates = await request(app).post('/api/v1/chalets/bookings').send({
        unit_id: 'unit-1',
        check_in_date: '2026-11-10',
        check_out_date: '2026-11-05',
      });
      expect(resInvalidDates.status).toBe(400);
      expect(resInvalidDates.body.error).toContain('Invalid check-in/check-out dates');
    });
  });

  describe('Shared Capacity Access & Ongoing Entitlement Presets', () => {
    it('shared_capacity_access GET /staff/bracelets/active lists active bracelets', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-pool-1',
          slug: 'pool',
          engine_type: 'shared_capacity_access',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'transactions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 'tx-pool-1', metadata: { bracelet_number: 'BR-101' }, status: 'in_use' }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('shared_capacity_access');
      app.use('/api/v1/pool', router);

      const res = await request(app).get('/api/v1/pool/staff/bracelets/active');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].metadata.bracelet_number).toBe('BR-101');
    });

    it('ongoing_entitlement GET /plans returns active membership plans', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-gym-1',
          slug: 'gym',
          engine_type: 'ongoing_entitlement',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'membership_plans') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'plan-1', name: 'Gold Annual', price: 600, interval: 'year' }],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('ongoing_entitlement');
      app.use('/api/v1/gym', router);

      const res = await request(app).get('/api/v1/gym/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].name).toBe('Gold Annual');
    });

    it('ongoing_entitlement POST /subscriptions creates new membership subscription', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.mountedModule = {
          id: 'mod-gym-1',
          slug: 'gym',
          engine_type: 'ongoing_entitlement',
          property_id: 'prop-1',
          tenant_id: 'tenant-1',
        };
        next();
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'membership_plans') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'plan-1', price: 600 },
                error: null,
              }),
            };
          }
          if (table === 'modules') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { tax_category: 'standard' },
                error: null,
              }),
            };
          }
          if (table === 'memberships') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'mem-sub-1', plan_id: 'plan-1', status: 'pending', amount: 100 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return createChainableMock(null);
        }),
      } as any);

      const router = buildModuleRouter('ongoing_entitlement');
      app.use('/api/v1/gym', router);

      const res = await request(app).post('/api/v1/gym/subscriptions').send({ plan_id: 'plan-1' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('mem-sub-1');
    });
  });
});
