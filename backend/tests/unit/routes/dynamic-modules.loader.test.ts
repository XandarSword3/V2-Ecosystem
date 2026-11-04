import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  loadDynamicModules,
  getDynamicModulesRouter,
} from '../../../src/routes/dynamic-modules.loader.js';

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

vi.mock('../../../src/routes/dynamic-module.router.js', () => ({
  buildModuleRouter: vi.fn((engineType: string) => {
    const router = express.Router();
    router.get('/ping', (req, res) => {
      res.json({
        engineType,
        mounted: (req as any).mountedModule,
      });
    });
    return router;
  }),
}));

import { getSupabase } from '../../../src/database/connection.js';
import { createChainableMock } from '../utils.js';

describe('dynamic-modules.loader (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load dynamic modules and route requests based on single slug match', async () => {
    const mockModules = [
      {
        id: 'mod-1',
        slug: 'bistro',
        engine_type: 'instant_transaction',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
        require_reservation: false,
      },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'modules') {
          return createChainableMock(mockModules);
        }
        return createChainableMock(null);
      }),
    } as any);

    await loadDynamicModules();

    const app = express();
    app.use('/api/v1', getDynamicModulesRouter());

    const res = await request(app).get('/api/v1/bistro/ping');
    expect(res.status).toBe(200);
    expect(res.body.engineType).toBe('instant_transaction');
    expect(res.body.mounted.id).toBe('mod-1');
  });

  it('should disambiguate multiple tenants sharing the same slug via req.tenant', async () => {
    const mockModules = [
      {
        id: 'mod-tenant-1',
        slug: 'spa',
        engine_type: 'time_exclusive_reservation',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
      },
      {
        id: 'mod-tenant-2',
        slug: 'spa',
        engine_type: 'time_exclusive_reservation',
        property_id: 'prop-2',
        tenant_id: 'tenant-2',
      },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => createChainableMock(mockModules)),
    } as any);

    await loadDynamicModules();

    const app = express();
    // Middleware mocking tenantGate setting req.tenant
    app.use((req, _res, next) => {
      const tId = req.headers['x-tenant-override'] as string;
      if (tId) {
        (req as any).tenant = { id: tId };
      }
      next();
    });
    app.use('/api/v1', getDynamicModulesRouter());

    const res1 = await request(app)
      .get('/api/v1/spa/ping')
      .set('x-tenant-override', 'tenant-1');
    expect(res1.status).toBe(200);
    expect(res1.body.mounted.id).toBe('mod-tenant-1');

    const res2 = await request(app)
      .get('/api/v1/spa/ping')
      .set('x-tenant-override', 'tenant-2');
    expect(res2.status).toBe(200);
    expect(res2.body.mounted.id).toBe('mod-tenant-2');
  });

  it('should fall through when tenant has no match among shared slugs', async () => {
    const mockModules = [
      {
        id: 'mod-tenant-1',
        slug: 'golf',
        engine_type: 'time_exclusive_reservation',
        tenant_id: 'tenant-1',
      },
      {
        id: 'mod-tenant-2',
        slug: 'golf',
        engine_type: 'time_exclusive_reservation',
        tenant_id: 'tenant-2',
      },
    ];

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => createChainableMock(mockModules)),
    } as any);

    await loadDynamicModules();

    const app = express();
    app.use((req, _res, next) => {
      (req as any).tenant = { id: 'tenant-3-unknown' };
      next();
    });
    app.use('/api/v1', getDynamicModulesRouter());

    const res = await request(app).get('/api/v1/golf/ping');
    expect(res.status).toBe(404);
  });

  it('should throw error when database query fails during loadDynamicModules', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => createChainableMock(null, { message: 'Database query failed' })),
    } as any);

    await expect(loadDynamicModules()).rejects.toThrow();
  });
});
