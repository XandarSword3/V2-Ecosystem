import { createMockReqRes } from '../utils';

// Mock dependencies inline to avoid hoisting issues
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
}));

vi.mock('../../../src/services/terminology.service.js', () => ({
  terminologyService: {
    getTerminology: vi.fn().mockResolvedValue({}),
  },
}));

import { getSupabase } from '../../../src/database/connection.js';
import {
  getUnits,
  getUnit,
  getAvailability,
  createBooking,
} from '../../../src/modules/accommodations/accommodation.controller.js';

describe('Accommodation Controller', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(getSupabase).mockReturnValue(mockSupabase);
  });

  describe('getUnits', () => {
    it('should return all active units', async () => {
      const mockUnits = [
        { id: 'unit-1', name: 'Deluxe Cabin', is_active: true },
        { id: 'unit-2', name: 'Family Suite', is_active: true },
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: mockUnits, error: null }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await getUnits(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUnits,
      });
    });

    it('should filter units by moduleId', async () => {
      const mockUnits = [
        { id: 'unit-1', name: 'Pool Cabin', module_id: 'module-1' },
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockUnits, error: null }),
            }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        query: { moduleId: 'module-1' },
      });

      await getUnits(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUnits,
      });
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await getUnits(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUnit', () => {
    it('should return a single unit by ID', async () => {
      const mockUnit = {
        id: 'unit-1',
        name: 'Luxury Suite',
        base_price: 200,
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUnit, error: null }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
      });

      await getUnit(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUnit,
      });
    });

    it('should return 404 if unit not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        params: { id: 'nonexistent' },
      });

      await getUnit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unit not found',
      });
    });

    it('should call next on database error', async () => {
      const error = { code: 'OTHER', message: 'DB error' };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
      });

      await getUnit(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getAvailability', () => {
    it('should return 400 if startDate is missing', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
        query: { endDate: '2024-12-31' },
      });

      await getAvailability(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'startDate and endDate required',
      });
    });

    it('should return 400 if endDate is missing', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
        query: { startDate: '2024-12-01' },
      });

      await getAvailability(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'startDate and endDate required',
      });
    });

    it('should return blocked dates based on existing bookings', async () => {
      const mockBookings = [
        {
          check_in_date: '2024-12-15',
          check_out_date: '2024-12-18',
          status: 'confirmed',
        },
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
        query: { startDate: '2024-12-01', endDate: '2024-12-31' },
      });

      await getAvailability(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          blockedDates: expect.arrayContaining([
            '2024-12-15',
            '2024-12-16',
            '2024-12-17',
          ]),
        },
      });
    });

    it('should exclude cancelled bookings from blocked dates', async () => {
      const mockBookings = [
        {
          check_in_date: '2024-12-15',
          check_out_date: '2024-12-18',
          status: 'cancelled',
        },
      ];

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: mockBookings, error: null }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        params: { id: 'unit-1' },
        query: { startDate: '2024-12-01', endDate: '2024-12-31' },
      });

      await getAvailability(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          blockedDates: [],
        },
      });
    });
  });

  describe('createBooking', () => {
    it('should return 400 if required fields are missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {},
      });

      await createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
      });
    });

    it('should return 404 if unit not found', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }));

      const { req, res, next } = createMockReqRes({
        body: {
          unitId: 'nonexistent-unit',
          checkInDate: '2024-12-15',
          checkOutDate: '2024-12-18',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
        },
      });

      await createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unit not found',
      });
    });

    it('should return 400 if unit is already booked (overlap)', async () => {
      const mockUnit = {
        id: 'unit-1',
        name: 'Deluxe Suite',
        base_price: 150,
      };

      const mockExistingBookings = [
        {
          id: 'booking-1',
          check_in_date: '2024-12-16',
          check_out_date: '2024-12-20',
          status: 'confirmed',
        },
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) {
          // Get unit
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUnit, error: null }),
              }),
            }),
          };
        }
        // Get existing bookings
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: mockExistingBookings, error: null }),
            }),
          }),
        };
      });

      const { req, res, next } = createMockReqRes({
        body: {
          unitId: 'unit-1',
          checkInDate: '2024-12-15',
          checkOutDate: '2024-12-18', // Overlaps with existing booking
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
        },
      });

      await createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unit is already booked',
      });
    });

    it('should create booking successfully when no overlap', async () => {
      const mockUnit = {
        id: 'unit-1',
        name: 'Deluxe Suite',
        base_price: '150.00',
      };

      const mockBooking = {
        id: 'booking-new',
        booking_number: 'B-240615-001',
        unit_id: 'unit-1',
        status: 'pending',
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) {
          // Get unit
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUnit, error: null }),
              }),
            }),
          };
        }
        if (callCount === 2) {
          // Get existing bookings (none)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        // Create booking
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
            }),
          }),
        };
      });

      const { req, res, next } = createMockReqRes({
        body: {
          unitId: 'unit-1',
          checkInDate: '2024-12-25',
          checkOutDate: '2024-12-28',
          customerName: 'Alice Smith',
          customerEmail: 'alice@example.com',
          customerPhone: '+1234567890',
          numberOfGuests: 2,
        },
        user: { userId: 'user-123' },
        ip: '127.0.0.1',
      });

      await createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
      });
    });
  });
});
