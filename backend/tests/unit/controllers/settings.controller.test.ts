import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/socket/index', () => ({
  emitToAll: vi.fn()
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { getSupabase } from '../../../src/database/connection';
import { getSettings, updateSettings } from '../../../src/modules/admin/controllers/settings.controller';

describe('SettingsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return all settings successfully', async () => {
      const mockSettings = [
        { key: 'general', value: { resortName: 'V2 Resort', tagline: 'Paradise Awaits' } },
        { key: 'contact', value: { phone: '+1234567890', email: 'info@v2resort.com' } },
        { key: 'appearance', value: { theme: 'light', animationsEnabled: true } }
      ];

      const queryBuilder = createChainableMock(mockSettings);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes();
      await getSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          resortName: 'V2 Resort',
          tagline: 'Paradise Awaits',
          phone: '+1234567890',
          email: 'info@v2resort.com',
          theme: 'light',
          animationsEnabled: true
        })
      }));
    });

    it('should handle empty settings', async () => {
      const queryBuilder = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes();
      await getSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {}
      });
    });

    it('should handle database errors', async () => {
      const queryBuilder = createChainableMock(null, new Error('Database error'));
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes();
      await getSettings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should flatten chalet settings correctly', async () => {
      const mockSettings = [
        { key: 'chalets', value: { checkIn: '14:00', checkOut: '11:00', depositPercent: 30 } }
      ];

      const queryBuilder = createChainableMock(mockSettings);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes();
      await getSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          chaletCheckIn: '14:00',
          chaletCheckOut: '11:00',
          chaletDeposit: 30
        })
      }));
    });

    it('should flatten pool settings correctly', async () => {
      const mockSettings = [
        { key: 'pool', value: { adultPrice: 25, childPrice: 15, infantPrice: 0, capacity: 100 } }
      ];

      const queryBuilder = createChainableMock(mockSettings);
      vi.mocked(getSupabase).mockReturnValue({ from: vi.fn().mockReturnValue(queryBuilder) } as any);

      const { req, res, next } = createMockReqRes();
      await getSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          poolAdultPrice: 25,
          poolChildPrice: 15,
          poolInfantPrice: 0,
          poolCapacity: 100
        })
      }));
    });
  });

  describe('updateSettings', () => {
    it('should update appearance settings', async () => {
      const existingAppearance = { theme: 'dark' };
      const singleQueryBuilder = createChainableMock({ value: existingAppearance });
      const upsertQueryBuilder = createChainableMock([{ key: 'appearance', value: { theme: 'light', animationsEnabled: true } }]);

      const fromMock = vi.fn().mockImplementation((table: string) => {
        const mock = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => Promise.resolve({ data: { value: existingAppearance }, error: null })),
          upsert: vi.fn().mockReturnValue(upsertQueryBuilder)
        };
        return mock;
      });

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: {
          theme: 'light',
          animationsEnabled: true
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should update general settings', async () => {
      const fromMock = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: { value: {} }, error: null })),
        upsert: vi.fn().mockReturnValue(createChainableMock([]))
      }));

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: {
          resortName: 'New Resort Name',
          tagline: 'New Tagline'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should update contact settings', async () => {
      const fromMock = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: { value: {} }, error: null })),
        upsert: vi.fn().mockReturnValue(createChainableMock([]))
      }));

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: {
          phone: '+9876543210',
          email: 'new@email.com',
          address: '123 Main St'
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should handle errors during update', async () => {
      const fromMock = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.reject(new Error('Update failed'))),
        upsert: vi.fn().mockReturnValue(createChainableMock(null, new Error('Update failed')))
      }));

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: { theme: 'dark' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateSettings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should skip undefined values in settings', async () => {
      const fromMock = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: { value: {} }, error: null })),
        upsert: vi.fn().mockReturnValue(createChainableMock([]))
      }));

      vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

      const { req, res, next } = createMockReqRes({
        body: {
          resortName: 'Name',
          tagline: undefined, // Should be skipped
          description: undefined // Should be skipped
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });
});
