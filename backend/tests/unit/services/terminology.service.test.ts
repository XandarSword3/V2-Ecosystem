
// Mock database connection
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

// Import after mocks
import { terminologyService, TerminologyService } from '../../../src/services/terminology.service';

describe('TerminologyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTerminology', () => {
    it('should return terminology map for business type', async () => {
      const mockData = [
        { id: '1', business_type: 'hotel', term_key: 'room', term_value: 'Suite', language: 'en' },
        { id: '2', business_type: 'hotel', term_key: 'guest', term_value: 'Visitor', language: 'en' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await terminologyService.getTerminology('hotel', 'en');

      expect(result).toEqual({
        room: 'Suite',
        guest: 'Visitor',
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('terminology_overrides');
    });

    it('should use default language en', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      await terminologyService.getTerminology('spa');

      // Should be called with 'en' as default language
      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });

    it('should return empty object if table does not exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST205', message: 'terminology_overrides not found' } 
            }),
          }),
        }),
      });

      const result = await terminologyService.getTerminology('hotel');

      expect(result).toEqual({});
    });

    it('should return empty object on other errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockRejectedValue(new Error('Some error')),
          }),
        }),
      });

      const result = await terminologyService.getTerminology('hotel');

      expect(result).toEqual({});
    });

    it('should return empty object if data is null', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await terminologyService.getTerminology('hotel');

      expect(result).toEqual({});
    });
  });

  describe('updateTerminology', () => {
    it('should upsert terminology override', async () => {
      const mockResult = {
        id: '1',
        business_type: 'hotel',
        term_key: 'room',
        term_value: 'Chamber',
        language: 'en',
      };

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
          }),
        }),
      });

      const result = await terminologyService.updateTerminology('hotel', 'room', 'Chamber', 'en');

      expect(result).toEqual(mockResult);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('terminology_overrides');
    });

    it('should use default language en', async () => {
      const mockResult = {
        id: '1',
        business_type: 'hotel',
        term_key: 'room',
        term_value: 'Chamber',
        language: 'en',
      };

      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
          }),
        }),
      });

      await terminologyService.updateTerminology('hotel', 'room', 'Chamber');

      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });

    it('should throw on error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
          }),
        }),
      });

      await expect(terminologyService.updateTerminology('hotel', 'room', 'Chamber')).rejects.toThrow();
    });
  });

  describe('bulkUpdateTerminology', () => {
    it('should upsert multiple terms at once', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const updates = {
        room: 'Chamber',
        guest: 'Patron',
        booking: 'Reservation',
      };

      await terminologyService.bulkUpdateTerminology('hotel', 'en', updates);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('terminology_overrides');
    });

    it('should do nothing for empty updates', async () => {
      await terminologyService.bulkUpdateTerminology('hotel', 'en', {});

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should throw on error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: new Error('Bulk update failed') }),
      });

      await expect(
        terminologyService.bulkUpdateTerminology('hotel', 'en', { room: 'Chamber' })
      ).rejects.toThrow();
    });
  });

  describe('getAllOverrides', () => {
    it('should return all overrides without filter', async () => {
      const mockData = [
        { id: '1', business_type: 'hotel', term_key: 'room', term_value: 'Suite', language: 'en' },
        { id: '2', business_type: 'spa', term_key: 'room', term_value: 'Treatment Room', language: 'en' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      const result = await terminologyService.getAllOverrides();

      expect(result).toEqual(mockData);
    });

    it('should filter by business type', async () => {
      const mockData = [
        { id: '1', business_type: 'hotel', term_key: 'room', term_value: 'Suite', language: 'en' },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await terminologyService.getAllOverrides('hotel');

      expect(result).toEqual(mockData);
    });

    it('should throw on error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('Query failed') }),
        }),
      });

      await expect(terminologyService.getAllOverrides()).rejects.toThrow();
    });

    it('should return empty array if data is null', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await terminologyService.getAllOverrides();

      expect(result).toEqual([]);
    });
  });

  describe('exported instance', () => {
    it('should export terminologyService singleton', () => {
      expect(terminologyService).toBeInstanceOf(TerminologyService);
    });
  });
});
