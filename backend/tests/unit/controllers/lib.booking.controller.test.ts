import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';
import { createBookingController } from '../../../src/lib/controllers/booking.controller';

describe('BookingController', () => {
  let mockBookingService: any;
  let mockLogger: any;
  let controller: ReturnType<typeof createBookingController>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBookingService = {
      createBooking: vi.fn(),
      getAvailability: vi.fn(),
      getBookingById: vi.fn(),
      getBookingByNumber: vi.fn(),
      getBookingsByCustomer: vi.fn(),
      cancelBooking: vi.fn(),
      getBookings: vi.fn(),
      getTodayBookings: vi.fn(),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
      updateStatus: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    controller = createBookingController({
      bookingService: mockBookingService,
      logger: mockLogger,
    });
  });

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      const mockBooking = { id: 'booking-1', bookingNumber: 'BK-001' };
      mockBookingService.createBooking.mockResolvedValue({ booking: mockBooking });

      const { req, res } = createMockReqRes({
        body: {
          chaletId: '123e4567-e89b-12d3-a456-426614174000',
          customerName: 'John Doe',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-17',
          numberOfGuests: 2,
        },
        user: { userId: 'user-1', role: 'customer' },
      });

      await controller.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
        message: 'Booking created successfully',
      });
    });

    it('should reject invalid chalet ID', async () => {
      const { req, res } = createMockReqRes({
        body: {
          chaletId: 'invalid-uuid',
          customerName: 'John Doe',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-17',
          numberOfGuests: 2,
        },
      });

      await controller.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Validation failed',
      }));
    });

    it('should reject invalid date format', async () => {
      const { req, res } = createMockReqRes({
        body: {
          chaletId: '123e4567-e89b-12d3-a456-426614174000',
          customerName: 'John Doe',
          checkInDate: '15-01-2024',
          checkOutDate: '2024-01-17',
          numberOfGuests: 2,
        },
      });

      await controller.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors with statusCode', async () => {
      mockBookingService.createBooking.mockRejectedValue({
        statusCode: 409,
        message: 'Dates not available',
        code: 'DATE_CONFLICT',
      });

      const { req, res } = createMockReqRes({
        body: {
          chaletId: '123e4567-e89b-12d3-a456-426614174000',
          customerName: 'John Doe',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-17',
          numberOfGuests: 2,
        },
      });

      await controller.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Dates not available',
        code: 'DATE_CONFLICT',
      });
    });

    it('should handle generic errors', async () => {
      mockBookingService.createBooking.mockRejectedValue(new Error('Unknown'));

      const { req, res } = createMockReqRes({
        body: {
          chaletId: '123e4567-e89b-12d3-a456-426614174000',
          customerName: 'John Doe',
          checkInDate: '2024-01-15',
          checkOutDate: '2024-01-17',
          numberOfGuests: 2,
        },
      });

      await controller.createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create booking' });
    });
  });

  describe('getAvailability', () => {
    it('should return availability successfully', async () => {
      const mockAvailability = { available: true, dates: [] };
      mockBookingService.getAvailability.mockResolvedValue(mockAvailability);

      const { req, res } = createMockReqRes({
        params: { id: 'chalet-1' },
        query: { startDate: '2024-01-15', endDate: '2024-01-17' },
      });

      await controller.getAvailability(req, res);

      expect(mockBookingService.getAvailability).toHaveBeenCalledWith('chalet-1', '2024-01-15', '2024-01-17');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAvailability,
      });
    });

    it('should require date parameters', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'chalet-1' },
        query: {},
      });

      await controller.getAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'startDate and endDate are required',
      }));
    });

    it('should handle errors', async () => {
      mockBookingService.getAvailability.mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({
        params: { id: 'chalet-1' },
        query: { startDate: '2024-01-15', endDate: '2024-01-17' },
      });

      await controller.getAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getBookingById', () => {
    it('should return booking', async () => {
      const mockBooking = { id: 'booking-1' };
      mockBookingService.getBookingById.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
      });

      await controller.getBookingById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
      });
    });

    it('should return 404 for non-existent booking', async () => {
      mockBookingService.getBookingById.mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { id: 'non-existent' },
      });

      await controller.getBookingById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Booking not found' });
    });
  });

  describe('getBookingByNumber', () => {
    it('should return booking by number', async () => {
      const mockBooking = { id: 'booking-1', bookingNumber: 'BK-001' };
      mockBookingService.getBookingByNumber.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { bookingNumber: 'BK-001' },
      });

      await controller.getBookingByNumber(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
      });
    });

    it('should return 404 for non-existent booking number', async () => {
      mockBookingService.getBookingByNumber.mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { bookingNumber: 'INVALID' },
      });

      await controller.getBookingByNumber(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyBookings', () => {
    it('should return user bookings', async () => {
      const mockBookings = [{ id: 'booking-1' }];
      mockBookingService.getBookingsByCustomer.mockResolvedValue(mockBookings);

      const { req, res } = createMockReqRes({
        user: { userId: 'user-1', role: 'customer' },
      });

      await controller.getMyBookings(req, res);

      expect(mockBookingService.getBookingsByCustomer).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBookings,
      });
    });

    it('should require authentication', async () => {
      const { req, res } = createMockReqRes({});
      // Override user to be undefined for this test
      (req as any).user = undefined;

      await controller.getMyBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const mockBooking = { id: 'booking-1', status: 'cancelled' };
      mockBookingService.cancelBooking.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: { reason: 'Changed plans' },
        user: { userId: 'user-1', role: 'customer' },
      });

      await controller.cancelBooking(req, res);

      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith('booking-1', 'Changed plans', 'user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
        message: 'Booking cancelled',
      });
    });

    it('should require cancellation reason', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: {},
      });

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle not allowed to cancel', async () => {
      mockBookingService.cancelBooking.mockRejectedValue({
        statusCode: 403,
        message: 'Cannot cancel checked-in booking',
        code: 'CANCEL_NOT_ALLOWED',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: { reason: 'Want refund' },
        user: { userId: 'user-1', role: 'customer' },
      });

      await controller.cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getBookings', () => {
    it('should return filtered bookings', async () => {
      const mockBookings = [{ id: 'booking-1' }];
      mockBookingService.getBookings.mockResolvedValue(mockBookings);

      const { req, res } = createMockReqRes({
        query: { status: 'confirmed' },
      });

      await controller.getBookings(req, res);

      expect(mockBookingService.getBookings).toHaveBeenCalledWith({ status: 'confirmed' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBookings,
      });
    });

    it('should reject invalid status', async () => {
      const { req, res } = createMockReqRes({
        query: { status: 'invalid-status' },
      });

      await controller.getBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getTodayBookings', () => {
    it('should return today bookings', async () => {
      const mockResult = { checkIns: [], checkOuts: [] };
      mockBookingService.getTodayBookings.mockResolvedValue(mockResult);

      const { req, res } = createMockReqRes({});

      await controller.getTodayBookings(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should handle errors', async () => {
      mockBookingService.getTodayBookings.mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({});

      await controller.getTodayBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('checkIn', () => {
    it('should check in guest successfully', async () => {
      const mockBooking = { id: 'booking-1', status: 'checked_in' };
      mockBookingService.checkIn.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        user: { userId: 'staff-1', role: 'staff' },
      });

      await controller.checkIn(req, res);

      expect(mockBookingService.checkIn).toHaveBeenCalledWith('booking-1', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
        message: 'Guest checked in',
      });
    });

    it('should require staff authentication', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
      });
      // Override user to be undefined for this test
      (req as any).user = undefined;

      await controller.checkIn(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Staff authentication required' });
    });

    it('should handle invalid check-in', async () => {
      mockBookingService.checkIn.mockRejectedValue({
        statusCode: 400,
        message: 'Booking not confirmed',
        code: 'INVALID_STATUS',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        user: { userId: 'staff-1', role: 'staff' },
      });

      await controller.checkIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('checkOut', () => {
    it('should check out guest successfully', async () => {
      const mockBooking = { id: 'booking-1', status: 'checked_out' };
      mockBookingService.checkOut.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        user: { userId: 'staff-1', role: 'staff' },
      });

      await controller.checkOut(req, res);

      expect(mockBookingService.checkOut).toHaveBeenCalledWith('booking-1', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
        message: 'Guest checked out',
      });
    });

    it('should require staff authentication', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
      });
      // Override user to be undefined for this test
      (req as any).user = undefined;

      await controller.checkOut(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updateStatus', () => {
    it('should update booking status', async () => {
      const mockBooking = { id: 'booking-1', status: 'confirmed' };
      mockBookingService.updateStatus.mockResolvedValue(mockBooking);

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: { status: 'confirmed' },
        user: { userId: 'staff-1', role: 'staff' },
      });

      await controller.updateStatus(req, res);

      expect(mockBookingService.updateStatus).toHaveBeenCalledWith('booking-1', 'confirmed', 'staff-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking,
      });
    });

    it('should reject invalid status', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: { status: 'invalid' },
      });

      await controller.updateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors', async () => {
      mockBookingService.updateStatus.mockRejectedValue({
        statusCode: 400,
        message: 'Invalid status transition',
        code: 'INVALID_TRANSITION',
      });

      const { req, res } = createMockReqRes({
        params: { id: 'booking-1' },
        body: { status: 'confirmed' },
        user: { userId: 'staff-1', role: 'staff' },
      });

      await controller.updateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
