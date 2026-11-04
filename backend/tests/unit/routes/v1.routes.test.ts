import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import v1Routes from '../../../src/routes/v1.routes.js';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// Mock sub-routers to avoid deep sub-tree initialization
vi.mock('../../../src/modules/auth/auth.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/users/user.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/payments/payment.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/admin/admin.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/reviews/reviews.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/support/support.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/loyalty/loyalty.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/giftcards/giftcard.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/coupons/coupon.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/housekeeping/housekeeping.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/inventory/inventory.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/manager/manager.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/staff/module-staff.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/devices/devices.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/promotions/promotions.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/finance/finance.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/modules/fiscal/fiscal.routes.js', () => ({ default: express.Router() }));
vi.mock('../../../src/routes/terminology.routes.js', () => ({ default: express.Router() }));

import { getSupabase } from '../../../src/database/connection.js';

describe('v1.routes (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/ should return API version info and documentation links', async () => {
    const app = express();
    app.use('/api/v1', v1Routes);

    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.apiVersion).toBe('v1');
    expect(res.body.status).toBe('stable');
    expect(res.body.documentation).toBe('/api/docs');
    expect(res.body.endpoints).toBeDefined();
  });

  it('GET /api/v1/assets/* should stream public asset from Supabase storage', async () => {
    const mockBuffer = Buffer.from('test-asset-data');
    const mockDownload = vi.fn().mockResolvedValue({
      data: {
        type: 'image/png',
        arrayBuffer: async () => mockBuffer,
      },
      error: null,
    });

    vi.mocked(getSupabase).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: mockDownload,
        })),
      },
    } as any);

    const app = express();
    app.use('/api/v1', v1Routes);

    const res = await request(app).get('/api/v1/assets/logos/brand.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(mockDownload).toHaveBeenCalledWith('logos/brand.png');
  });

  it('GET /api/v1/assets/* should reject path traversal attempts', async () => {
    const app = express();
    app.use('/api/v1', v1Routes);

    const res = await request(app).get('/api/v1/assets/docs/..%2fsecret.env');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid asset path');
  });

  it('GET /api/v1/assets/* should return 404 when file not found in storage', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({ data: null, error: { message: 'Object not found' } }),
        })),
      },
    } as any);

    const app = express();
    app.use('/api/v1', v1Routes);

    const res = await request(app).get('/api/v1/assets/missing.png');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Asset not found');
  });
});
