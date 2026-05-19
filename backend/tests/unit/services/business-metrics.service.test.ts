import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase - use inline definition
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock Redis - use inline definition
vi.mock('../../../src/config/session-store', () => ({
  getRedis: () => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  }),
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
import { businessMetricsService } from '../../../src/services/business-metrics.service';
import { supabase } from '../../../src/lib/supabase';

function createQueryMock(mockData: any = [], count: number = 0) {
  const mockObj: any = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'filter'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockImplementation(() => mockObj);
  });
  mockObj.then = (resolve: Function, reject?: Function) => {
    return Promise.resolve({ data: mockData, count, error: null }).then(resolve as any, reject as any);
  };
  return mockObj;
}

describe('BusinessMetricsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBookingMetrics', () => {
    it('should return booking metrics for default period', async () => {
      const mockBookings = [
        { status: 'confirmed', amount: 100, room_type: 'suite', source: 'direct' },
        { status: 'confirmed', amount: 150, room_type: 'standard', source: 'booking.com' },
        { status: 'pending', amount: 80, room_type: 'suite', source: 'direct' },
        { status: 'cancelled', amount: 120, room_type: 'deluxe', source: 'expedia' },
      ];

      vi.mocked(supabase.from).mockReturnValue(createQueryMock(mockBookings));

      const result = await businessMetricsService.getBookingMetrics();

      expect(result.total_bookings).toBe(4);
      expect(result.confirmed_bookings).toBe(2);
      expect(result.pending_bookings).toBe(1);
      expect(result.cancelled_bookings).toBe(1);
      expect(result.total_revenue).toBe(450); // 100 + 150 + 80 + 120
      expect(result.bookings_by_room_type).toHaveProperty('suite');
      expect(result.bookings_by_source).toHaveProperty('direct');
    });

    it('should handle empty bookings', async () => {
      vi.mocked(supabase.from).mockReturnValue(createQueryMock([]));

      const result = await businessMetricsService.getBookingMetrics();

      expect(result.total_bookings).toBe(0);
      expect(result.total_revenue).toBe(0);
    });

    it('should calculate metrics for week period', async () => {
      vi.mocked(supabase.from).mockReturnValue(createQueryMock([]));

      await businessMetricsService.getBookingMetrics('week');

      expect(supabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should calculate metrics for day period', async () => {
      vi.mocked(supabase.from).mockReturnValue(createQueryMock([]));

      await businessMetricsService.getBookingMetrics('day');

      expect(supabase.from).toHaveBeenCalledWith('transactions');
    });
  });

  describe('getRevenueMetrics', () => {
    it('should return revenue metrics', async () => {
      const mockTransactions = [
        { amount: 500, engine_type: 'time_exclusive_reservation', created_at: '2024-01-15T10:00:00Z', status: 'completed' },
        { amount: 100, engine_type: 'instant_transaction', created_at: '2024-01-15T11:00:00Z', status: 'completed' },
        { amount: 50, engine_type: 'shared_capacity_access', created_at: '2024-01-15T12:00:00Z', status: 'completed' },
      ];

      vi.mocked(supabase.from).mockReturnValue(createQueryMock(mockTransactions));

      const result = await businessMetricsService.getRevenueMetrics();

      expect(result.total_revenue).toBe(650);
      expect(result.revenue_by_engine).toHaveProperty('time_exclusive_reservation');
      expect(result.revenue_by_engine).toHaveProperty('instant_transaction');
      expect(result.revenue_by_engine).toHaveProperty('shared_capacity_access');
    });
  });

  describe('getUserMetrics', () => {
    it('should return user metrics', async () => {
      // This method makes multiple parallel queries with different filters
      // Mock to return consistent counts
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockImplementation((_cols?: string, options?: any) => {
          if (options?.count === 'exact') {
            return {
              gte: vi.fn().mockReturnValue({
                data: null,
                count: 5,
                error: null,
              }),
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, count: 2, error: null }),
              }),
            };
          }
          return {
            data: [{ role: 'customer' }, { role: 'admin' }],
            error: null,
          };
        }),
      } as any);

      const result = await businessMetricsService.getUserMetrics();

      expect(result.total_users).toBeDefined();
      expect(result.users_by_role).toBeDefined();
    });
  });

  describe('getOperationalMetrics', () => {
    it('should return operational metrics structure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockImplementation((_cols?: string, options?: any) => {
          if (options?.count === 'exact') {
            return {
              gte: vi.fn().mockResolvedValue({ data: null, count: 10, error: null }),
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, count: 3, error: null }),
              }),
            };
          }
          return {
            gte: vi.fn().mockResolvedValue({ 
              data: [
                { status: 'pending', created_at: '2024-01-15T10:00:00Z' },
                { status: 'completed', created_at: '2024-01-15T09:00:00Z', completed_at: '2024-01-15T09:30:00Z' },
              ], 
              error: null 
            }),
          };
        }),
      } as any);

      const result = await businessMetricsService.getOperationalMetrics();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('transactions_today');
      expect(result).toHaveProperty('transactions_pending');
      expect(result).toHaveProperty('transactions_completed');
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return all dashboard metrics combined', async () => {
      // Mock all the supabase calls - return minimal data to pass
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        // Return exact count mock or standard query mock depending on options
        const mockObj = createQueryMock([]);
        mockObj.select = vi.fn().mockImplementation((_cols?: string, options?: any) => {
          if (options?.count === 'exact') {
            const exactMock = createQueryMock(null, 0);
            return exactMock;
          }
          return mockObj;
        });
        return mockObj;
      });

      const result = await businessMetricsService.getDashboardMetrics();

      expect(result).toHaveProperty('bookings');
      expect(result).toHaveProperty('revenue');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('operational');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
