import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  importCatalogItems,
  importUnits,
  importInventory,
} from '../../../../src/modules/admin/controllers/import.controller.js';

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

vi.mock('../../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { createChainableMock } from '../../utils.js';

describe('ImportController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // Inject simulated authenticated user & property context
    app.use((req, _res, next) => {
      (req as any).propertyId = 'prop-import-1';
      (req as any).user = { userId: 'admin-importer' };
      next();
    });

    app.post('/admin/import/catalog-items', importCatalogItems);
    app.post('/admin/import/units', importUnits);
    app.post('/admin/import/inventory', importInventory);
  });

  describe('importCatalogItems', () => {
    it('should reject requests with empty items array with 400', async () => {
      const res = await request(app)
        .post('/admin/import/catalog-items')
        .send({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No catalog items provided for import');
    });

    it('should bulk insert valid catalog items and return success', async () => {
      const mockInserted = [
        { id: 'ci-1', name: 'Burger', price: 15, category: 'Food' },
        { id: 'ci-2', name: 'Soda', price: 3, category: 'Beverages' },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'catalog_items') {
            return createChainableMock(mockInserted);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .post('/admin/import/catalog-items')
        .send({
          moduleId: 'mod-1',
          items: [
            { name: 'Burger', price: 15, category: 'Food' },
            { name: 'Soda', price: 3, category: 'Beverages' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully imported 2 catalog items');
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('importUnits', () => {
    it('should reject requests with no units provided with 400', async () => {
      const res = await request(app).post('/admin/import/units').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No units provided for import');
    });

    it('should import units and set defaults for missing properties', async () => {
      const mockUnitsInserted = [
        { id: 'unit-imp-1', name: 'Cabin 101', base_price: 120, capacity: 4 },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'accommodation_units') {
            return createChainableMock(mockUnitsInserted);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .post('/admin/import/units')
        .send({
          items: [{ name: 'Cabin 101', price: 120, capacity: 4 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('importInventory', () => {
    it('should reject empty inventory requests with 400', async () => {
      const res = await request(app).post('/admin/import/inventory').send({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No inventory items provided for import');
    });

    it('should resolve categories, insert items and record initial stock', async () => {
      const mockCategory = { id: 'cat-meat', name: 'Meat' };
      const mockItems = [{ id: 'inv-1', name: 'Beef Patties', sku: 'SKU-BEEF' }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'inventory_categories') {
            return createChainableMock(mockCategory);
          }
          if (table === 'inventory_items') {
            return createChainableMock(mockItems);
          }
          if (table === 'inventory_stock') {
            return createChainableMock(null);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .post('/admin/import/inventory')
        .send({
          items: [
            {
              name: 'Beef Patties',
              category: 'Meat',
              unit: 'kg',
              minStock: 10,
              quantity: 50,
              cost: 8.5,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.message).toContain('Successfully imported 1 inventory items');
    });
  });
});
