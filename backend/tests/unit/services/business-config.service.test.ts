import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('../../../src/database/connection', () => ({
  getSupabase: () => mockSupabaseClient,
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/services/terminology.service', () => ({
  terminologyService: {
    bulkUpdateTerminology: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/config/business-types', () => ({
  BUSINESS_TYPES: {
    hotel: {
      id: 'hotel',
      name: 'Hotel',
      terminologyOverrides: {
        room: 'Room',
        guest: 'Guest',
      },
    },
    spa: {
      id: 'spa',
      name: 'Spa Resort',
      terminologyOverrides: {
        room: 'Treatment Room',
        guest: 'Client',
      },
    },
  },
}));

// Import after mocks
import { businessConfigService, BusinessConfigService } from '../../../src/services/business-config.service';
import { terminologyService } from '../../../src/services/terminology.service';

describe('BusinessConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('switchBusinessType', () => {
    it('should successfully switch to a valid business type', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await businessConfigService.switchBusinessType('hotel');

      expect(result).toBe(true);
      expect(terminologyService.bulkUpdateTerminology).toHaveBeenCalledWith(
        'hotel',
        'en',
        expect.objectContaining({
          room: 'Room',
          guest: 'Guest',
        })
      );
    });

    it('should throw error for invalid business type', async () => {
      await expect(businessConfigService.switchBusinessType('invalid')).rejects.toThrow(
        'Invalid business type: invalid'
      );
    });

    it('should return false on database error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: new Error('DB Error') }),
      });

      const result = await businessConfigService.switchBusinessType('hotel');

      expect(result).toBe(false);
    });

    it('should update site settings with business type', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        upsert: upsertMock,
      });

      await businessConfigService.switchBusinessType('spa');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('site_settings');
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'business_type',
          value: expect.objectContaining({
            id: 'spa',
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('exported instance', () => {
    it('should export businessConfigService singleton', () => {
      expect(businessConfigService).toBeInstanceOf(BusinessConfigService);
    });
  });
});
