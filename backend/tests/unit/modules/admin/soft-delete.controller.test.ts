import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  getDeletedRecords,
  restoreRecord,
  permanentDelete,
  softDelete,
} from '../../../../src/modules/admin/controllers/soft-delete.controller.js';

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

describe('SoftDeleteController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // Inject simulated authenticated user & property context
    app.use((req, _res, next) => {
      (req as any).propertyId = 'prop-soft-1';
      (req as any).user = { userId: 'admin-soft-deleter' };
      next();
    });

    app.get('/admin/deleted/:entityType', getDeletedRecords);
    app.post('/admin/deleted/:entityType/:entityId/restore', restoreRecord);
    app.delete('/admin/deleted/:entityType/:entityId/permanent', permanentDelete);
    app.post('/admin/soft-delete/:entityType/:entityId', softDelete);
  });

  describe('getDeletedRecords', () => {
    it('should reject invalid entity type with 400', async () => {
      const res = await request(app).get('/admin/deleted/invalid_entity');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid entity type');
    });

    it('should return soft deleted accommodation units', async () => {
      const mockDeleted = [
        {
          id: 'unit-del-1',
          name: 'Villa 101',
          deleted_at: '2026-11-01T10:00:00Z',
          deleted_by: 'user-admin',
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'accommodation_units') {
            const chain = createChainableMock(mockDeleted, null, 1);
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).get('/admin/deleted/accommodation_units');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].identifier).toBe('Villa 101');
    });
  });

  describe('softDelete', () => {
    it('should soft delete existing active record', async () => {
      const mockExisting = { id: 'unit-active-1', deleted_at: null };
      const mockDeletedRow = { id: 'unit-active-1', deleted_at: '2026-11-04T12:00:00Z', is_active: false };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'accommodation_units') {
            // First select, then update
            return createChainableMock(mockExisting);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).post('/admin/soft-delete/accommodation_units/unit-active-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Record soft deleted successfully');
    });

    it('should return 400 when record is already deleted', async () => {
      const mockAlreadyDeleted = { id: 'unit-del-1', deleted_at: '2026-10-01T00:00:00Z' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockAlreadyDeleted)),
      } as any);

      const res = await request(app).post('/admin/soft-delete/accommodation_units/unit-del-1');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Record is already deleted');
    });
  });

  describe('restoreRecord', () => {
    it('should restore a soft-deleted record', async () => {
      const mockDeleted = { id: 'unit-del-1', deleted_at: '2026-10-01T00:00:00Z' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockDeleted)),
      } as any);

      const res = await request(app).post('/admin/deleted/accommodation_units/unit-del-1/restore');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Record restored successfully');
    });

    it('should return 400 when attempting to restore non-deleted record', async () => {
      const mockActive = { id: 'unit-active-2', deleted_at: null };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockActive)),
      } as any);

      const res = await request(app).post('/admin/deleted/accommodation_units/unit-active-2/restore');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Record is not deleted');
    });
  });

  describe('permanentDelete', () => {
    it('should require force=true query param', async () => {
      const res = await request(app).delete('/admin/deleted/accommodation_units/unit-del-1/permanent');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('force=true query parameter');
    });

    it('should permanently delete soft-deleted record when force=true', async () => {
      const mockDeleted = { id: 'unit-del-1', deleted_at: '2026-10-01T00:00:00Z' };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(mockDeleted)),
      } as any);

      const res = await request(app)
        .delete('/admin/deleted/accommodation_units/unit-del-1/permanent')
        .query({ force: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Record permanently deleted');
    });
  });
});
