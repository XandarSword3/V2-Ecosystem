import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assertModuleLimit,
  assertPropertyLimit,
  assertStaffUserLimit,
  assertFeatureEnabled,
} from '../../../src/services/feature-limits.service.js';
import { AppError } from '../../../src/utils/errors.js';
import type { Request } from 'express';

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../../src/database/connection.js';

describe('FeatureLimitsService (Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertModuleLimit', () => {
    it('should pass without error when req.tenant is undefined (single tenant/legacy mode)', async () => {
      const req = {} as Request;
      await expect(assertModuleLimit(req)).resolves.toBeUndefined();
    });

    it('should pass when maxModules is unlimited (-1)', async () => {
      const req = {
        tenant: {
          id: 'tenant-1',
          subscription_tier: 'enterprise',
          property_group_id: 'group-1',
          feature_limits: { maxModules: -1 },
        },
      } as unknown as Request;

      await expect(assertModuleLimit(req)).resolves.toBeUndefined();
    });

    it('should pass when current module count is strictly below limit', async () => {
      const req = {
        tenant: {
          id: 'tenant-1',
          subscription_tier: 'starter',
          property_group_id: 'group-1',
          feature_limits: { maxModules: 3 },
        },
      } as unknown as Request;

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'properties') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'prop-1' }, { id: 'prop-2' }],
                }),
              }),
            };
          }
          if (table === 'modules') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  count: 2,
                }),
              }),
            };
          }
          return {} as any;
        }),
      } as any);

      await expect(assertModuleLimit(req)).resolves.toBeUndefined();
    });

    it('should throw AppError 402 with MODULE_LIMIT_REACHED when count equals or exceeds limit', async () => {
      const req = {
        tenant: {
          id: 'tenant-1',
          subscription_tier: 'starter',
          property_group_id: 'group-1',
          feature_limits: { maxModules: 2 },
        },
      } as unknown as Request;

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'properties') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'prop-1' }],
                }),
              }),
            };
          }
          if (table === 'modules') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  count: 2,
                }),
              }),
            };
          }
          return {} as any;
        }),
      } as any);

      await expect(assertModuleLimit(req)).rejects.toThrow(AppError);
      await expect(assertModuleLimit(req)).rejects.toMatchObject({
        statusCode: 402,
        code: 'MODULE_LIMIT_REACHED',
      });
    });
  });

  describe('assertPropertyLimit', () => {
    it('should throw AppError 402 with PROPERTY_LIMIT_REACHED when property count exceeds limit', async () => {
      const req = {
        tenant: {
          id: 'tenant-1',
          subscription_tier: 'basic',
          property_group_id: 'group-1',
          feature_limits: { maxProperties: 1 },
        },
      } as unknown as Request;

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 1,
            }),
          }),
        }),
      } as any);

      await expect(assertPropertyLimit(req)).rejects.toMatchObject({
        statusCode: 402,
        code: 'PROPERTY_LIMIT_REACHED',
      });
    });
  });

  describe('assertStaffUserLimit', () => {
    it('should throw AppError 402 with STAFF_LIMIT_REACHED when staff user count reaches limit', async () => {
      const req = {
        tenant: {
          id: 'tenant-1',
          subscription_tier: 'basic',
          feature_limits: { maxStaffUsers: 5 },
        },
      } as unknown as Request;

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  count: 5,
                }),
              }),
            }),
          }),
        }),
      } as any);

      await expect(assertStaffUserLimit(req)).rejects.toMatchObject({
        statusCode: 402,
        code: 'STAFF_LIMIT_REACHED',
      });
    });
  });

  describe('assertFeatureEnabled', () => {
    it('should allow feature when enabled or not explicitly false', () => {
      const req = {
        tenant: {
          subscription_tier: 'pro',
          feature_limits: { customDomain: true, whiteLabel: undefined },
        },
      } as unknown as Request;

      expect(() => assertFeatureEnabled(req, 'customDomain')).not.toThrow();
      expect(() => assertFeatureEnabled(req, 'whiteLabel')).not.toThrow();
    });

    it('should throw AppError 402 FEATURE_NOT_AVAILABLE when feature flag is explicitly false', () => {
      const req = {
        tenant: {
          subscription_tier: 'starter',
          feature_limits: { apiAccess: false },
        },
      } as unknown as Request;

      expect(() => assertFeatureEnabled(req, 'apiAccess')).toThrow(AppError);
      expect(() => assertFeatureEnabled(req, 'apiAccess')).toThrow(
        expect.objectContaining({
          statusCode: 402,
          code: 'FEATURE_NOT_AVAILABLE',
        })
      );
    });
  });
});
