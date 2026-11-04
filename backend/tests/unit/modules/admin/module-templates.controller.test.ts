import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  getModuleTemplates,
  getModuleTemplate,
} from '../../../../src/modules/admin/controllers/module-templates.controller.js';

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

describe('ModuleTemplatesController (Unit Tests)', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.get('/admin/module-templates', getModuleTemplates);
    app.get('/admin/module-templates/:id', getModuleTemplate);
  });

  describe('getModuleTemplates', () => {
    it('should return active templates with optional filtering by engine_type and category', async () => {
      const mockTemplates = [
        {
          id: 'tmpl-1',
          name: 'Restaurant Bistro',
          engine_type: 'instant_transaction',
          category: 'f&b',
          is_official: true,
          usage_count: 42,
        },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'module_templates') {
            return createChainableMock(mockTemplates);
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app)
        .get('/admin/module-templates')
        .query({ engine_type: 'instant_transaction', category: 'f&b' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Restaurant Bistro');
    });

    it('should return 500 when database query encounters an error', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null, { message: 'Database query failed' })),
      } as any);

      const res = await request(app).get('/admin/module-templates');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Failed to fetch module templates');
    });
  });

  describe('getModuleTemplate', () => {
    it('should return a single template by id and increment usage_count', async () => {
      const mockTemplate = {
        id: 'tmpl-100',
        name: 'Pool Cabana Access',
        engine_type: 'shared_capacity_access',
        usage_count: 5,
        is_active: true,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'module_templates') {
            const chain = createChainableMock(mockTemplate);
            chain.update = mockUpdate;
            return chain;
          }
          return createChainableMock(null);
        }),
      } as any);

      const res = await request(app).get('/admin/module-templates/tmpl-100');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('tmpl-100');
      expect(mockUpdate).toHaveBeenCalledWith({ usage_count: 6 });
    });

    it('should return 404 when template not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn(() => createChainableMock(null)),
      } as any);

      const res = await request(app).get('/admin/module-templates/tmpl-none');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Module template not found');
    });
  });
});
