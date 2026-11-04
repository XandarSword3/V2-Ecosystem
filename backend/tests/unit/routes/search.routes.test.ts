import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import searchRoutes from '../../../src/routes/search.routes.js';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// Mock authentication/authorization middleware to pass through
vi.mock('../../../src/middleware/auth.middleware.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { createChainableMock } from '../utils.js';

describe('search.routes (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query all three engine types and return sorted unified transactions', async () => {
    const mockOrder = {
      id: 'tx-1',
      customer_id: 'cust-1',
      status: 'confirmed',
      amount: 45.0,
      created_at: '2026-11-01T10:00:00Z',
      module_id: 'mod-1',
      engine_type: 'instant_transaction',
    };
    const mockBooking = {
      id: 'tx-2',
      customer_id: 'cust-1',
      status: 'confirmed',
      amount: 250.0,
      created_at: '2026-11-03T12:00:00Z',
      module_id: 'mod-2',
      engine_type: 'time_exclusive_reservation',
    };
    const mockTicket = {
      id: 'tx-3',
      customer_id: 'cust-1',
      status: 'completed',
      amount: 30.0,
      created_at: '2026-11-02T08:00:00Z',
      module_id: 'mod-3',
      engine_type: 'shared_capacity_access',
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'transactions') {
          // In search.routes.ts buildQuery filters by engine_type
          const chain = createChainableMock([mockOrder, mockBooking, mockTicket]);
          chain.eq = vi.fn((field: string, val: string) => {
            if (field === 'engine_type') {
              if (val === 'instant_transaction') return createChainableMock([mockOrder]);
              if (val === 'time_exclusive_reservation') return createChainableMock([mockBooking]);
              if (val === 'shared_capacity_access') return createChainableMock([mockTicket]);
            }
            return chain;
          });
          return chain;
        }
        return createChainableMock(null);
      }),
    } as any);

    const app = express();
    app.use('/search', searchRoutes);

    const res = await request(app)
      .get('/search/orders')
      .query({ customer_id: 'cust-1', status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    // Verified descending sort by created_at:
    expect(res.body.data[0].id).toBe('tx-2'); // 2026-11-03
    expect(res.body.data[0].type).toBe('booking');
    expect(res.body.data[1].id).toBe('tx-3'); // 2026-11-02
    expect(res.body.data[1].type).toBe('ticket');
    expect(res.body.data[2].id).toBe('tx-1'); // 2026-11-01
    expect(res.body.data[2].type).toBe('order');
  });

  it('should handle search errors gracefully and return 500', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => {
        throw new Error('Supabase cluster error');
      }),
    } as any);

    const app = express();
    app.use('/search', searchRoutes);

    const res = await request(app).get('/search/orders');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Supabase cluster error');
  });
});
