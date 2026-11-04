import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
} from '../../../../src/modules/admin/controllers/plans.controller.js';

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('PlansController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY; // Default without Stripe for pure DB path
    app = express();
    app.use(express.json());

    app.get('/admin/plans', getPlans);
    app.get('/admin/plans/:id', getPlan);
    app.post('/admin/plans', createPlan);
    app.put('/admin/plans/:id', updatePlan);
    app.delete('/admin/plans/:id', deletePlan);
  });

  describe('getPlans', () => {
    it('should return all plans ordered by sort_order and created_at', async () => {
      const mockPlans = [
        { id: 'plan-1', code: 'starter', name: 'Starter Plan', price_monthly_cents: 2900 },
        { id: 'plan-2', code: 'growth', name: 'Growth Plan', price_monthly_cents: 9900 },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return createChainableMock(mockPlans);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).get('/admin/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].code).toBe('starter');
    });

    it('should return 500 when database error occurs', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null, { message: 'Database connection failed' })),
      } as any);

      const res = await request(app).get('/admin/plans');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch plans');
    });
  });

  describe('getPlan', () => {
    it('should return single plan by ID', async () => {
      const mockPlan = { id: 'plan-1', code: 'starter', name: 'Starter' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockPlan)),
      } as any);

      const res = await request(app).get('/admin/plans/plan-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('starter');
    });

    it('should return 404 when plan not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const res = await request(app).get('/admin/plans/plan-none');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
    });
  });

  describe('createPlan', () => {
    it('should validate required code and name', async () => {
      const res = await request(app)
        .post('/admin/plans')
        .send({ price_monthly_cents: 1000, price_annual_cents: 10000 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('code and name are required');
    });

    it('should validate numeric prices', async () => {
      const res = await request(app)
        .post('/admin/plans')
        .send({ code: 'free', name: 'Free' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('price_monthly_cents and price_annual_cents must be integers');
    });

    it('should insert plan to database and return 201', async () => {
      const mockCreated = {
        id: 'plan-new',
        code: 'pro',
        name: 'Pro',
        price_monthly_cents: 4900,
        price_annual_cents: 49000,
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return createChainableMock(mockCreated);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).post('/admin/plans').send({
        code: 'pro',
        name: 'Pro',
        price_monthly_cents: 4900,
        price_annual_cents: 49000,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('plan-new');
    });

    it('should return 409 when plan code already exists (23505 unique violation)', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null, { code: '23505', message: 'duplicate key' })),
      } as any);

      const res = await request(app).post('/admin/plans').send({
        code: 'duplicate_code',
        name: 'Duplicate',
        price_monthly_cents: 1000,
        price_annual_cents: 10000,
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('updatePlan', () => {
    it('should return 404 when updating non-existent plan', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const res = await request(app)
        .put('/admin/plans/plan-none')
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
    });

    it('should reject updates with no valid fields', async () => {
      const mockExisting = { id: 'plan-1', code: 'basic', name: 'Basic' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockExisting)),
      } as any);

      const res = await request(app)
        .put('/admin/plans/plan-1')
        .send({ code: 'cannot-change-code', random_field: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No valid fields to update');
    });

    it('should successfully update valid fields in database', async () => {
      const mockExisting = { id: 'plan-1', code: 'basic', name: 'Basic' };
      const mockUpdated = { id: 'plan-1', code: 'basic', name: 'Basic Renamed' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return createChainableMock(mockUpdated);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .put('/admin/plans/plan-1')
        .send({ name: 'Basic Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Basic Renamed');
    });
  });

  describe('deletePlan', () => {
    it('should return 404 if plan does not exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const res = await request(app).delete('/admin/plans/plan-none');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Plan not found');
    });

    it('should delete plan from database and return success message', async () => {
      const mockExisting = { id: 'plan-del', code: 'del', name: 'To Delete' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'plans') {
            return createChainableMock(mockExisting);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).delete('/admin/plans/plan-del');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });
  });
});
