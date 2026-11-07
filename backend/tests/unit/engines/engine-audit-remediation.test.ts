import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildModulePermissionRows, TEMPLATE_PERMISSION_PRESETS } from '../../../src/security/template-permission-presets';
import { resolveTenant } from '../../../src/middleware/tenantAccess.middleware';

// Mock dependencies for tenant middleware testing
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/cache.js', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';

describe('Engine A & Engine E Remediation Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Engine E: Template Permission Presets', () => {
    it('should register platform_entitlement in canonical presets without throwing', () => {
      expect(TEMPLATE_PERMISSION_PRESETS.platform_entitlement).toBeDefined();
      expect(TEMPLATE_PERMISSION_PRESETS.platform_entitlement.view).toBe(true);
      expect(TEMPLATE_PERMISSION_PRESETS.platform_entitlement.order).toBe(false);
      expect(TEMPLATE_PERMISSION_PRESETS.platform_entitlement.manage).toBe(true);
      expect(TEMPLATE_PERMISSION_PRESETS.platform_entitlement.admin).toBe(true);
    });

    it('should build module permission rows for platform_entitlement', () => {
      const rows = buildModulePermissionRows('saas-billing', 'platform_entitlement');
      expect(rows).toContain('module:saas-billing:view');
      expect(rows).toContain('module:saas-billing:manage');
      expect(rows).toContain('module:saas-billing:admin');
      expect(rows).not.toContain('module:saas-billing:order');
    });

    it('should resolve legacy alias saas_subscription to platform_entitlement', () => {
      const rows = buildModulePermissionRows('v2-platform', 'saas_subscription');
      expect(rows).toContain('module:v2-platform:view');
      expect(rows).toContain('module:v2-platform:admin');
    });
  });

  describe('Engine E: Tenant Access Gatekeeper Isolation', () => {
    it('should strictly return 404 for unknown X-Tenant-Slug and NEVER fall back to platform root in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'tenants') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockImplementation(async () => {
                return { data: null, error: null };
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const req: any = {
        headers: {
          'x-tenant-slug': 'malicious-or-unknown-tenant',
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await resolveTenant(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Tenant not found',
      });
      expect(req.tenant).toBeUndefined();
      expect(next).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
