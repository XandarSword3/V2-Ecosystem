/**
 * Booking Controller Factory
 * 
 * Creates thin HTTP handlers for chalet booking routes.
 * All business logic lives in BookingService.
 */

import { z } from 'zod';
import type { Request, Response } from 'express';
import type { BookingService } from '../services/booking.service.js';
import type { LoggerService } from '../container/types.js';
import { isErrorWithStatusCode, getErrorMessage } from '../../types/index.js';

// Extended error type for service errors with code
interface ServiceError {
  statusCode: number;
  message: string;
  code?: string;
}

function isServiceError(error: unknown): error is ServiceError {
  return (
    isErrorWithStatusCode(error) &&
    (!(error as { code?: unknown }).code || typeof (error as { code?: unknown }).code === 'string')
  );
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createBookingSchema = z.object({
  chaletId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numberOfGuests: z.number().int().positive(),
  addOns: z.array(z.object({
    addOnId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional(),
  specialRequests: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'whish', 'online']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
});

const cancelBookingSchema = z.object({
  reason: z.string().min(1).max(500),
});

const getBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']).optional(),
  chaletId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const availabilityQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ============================================
// CONTROLLER TYPES
// ============================================

export interface BookingControllerDeps {
  bookingService: BookingService;
  logger: LoggerService;
}

export interface BookingController {
  // Public
  createBooking: (req: Request, res: Response) => Promise<void>;
  getAvailability: (req: Request, res: Response) => Promise<void>;
  
  // Customer
  getBookingById: (req: Request, res: Response) => Promise<void>;
  getBookingByNumber: (req: Request, res: Response) => Promise<void>;
  getMyBookings: (req: Request, res: Response) => Promise<void>;
  cancelBooking: (req: Request, res: Response) => Promise<void>;
  
  // Staff
  getBookings: (req: Request, res: Response) => Promise<void>;
  getTodayBookings: (req: Request, res: Response) => Promise<void>;
  checkIn: (req: Request, res: Response) => Promise<void>;
  checkOut: (req: Request, res: Response) => Promise<void>;
  updateStatus: (req: Request, res: Response) => Promise<void>;
}

// ============================================
// CONTROLLER FACTORY
// ============================================

export function createBookingController(deps: BookingControllerDeps): BookingController {
  const { bookingService, logger } = deps;

  return {
    /**
     * Create a new booking
     * POST /api/chalets/bookings
     */
    async createBooking(req: Request, res: Response): Promise<void> {
      try {
        const validation = createBookingSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const userId = req.user?.userId;
        const input = {
          ...validation.data,
          chaletId: validation.data.chaletId,
          customerId: userId || validation.data.customerId!,
        };

        const result = await bookingService.createBooking(input as any);

        res.status(201).json({
          success: true,
          data: result.booking,
          message: 'Booking created successfully',
        });
      } catch (error: unknown) {
        logger.error('Create booking failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to create booking' });
      }
    },

    /**
     * Get chalet availability
     * GET /api/chalets/:id/availability
     */
    async getAvailability(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const validation = availabilityQuerySchema.safeParse(req.query);
        
        if (!validation.success) {
          res.status(400).json({
            error: 'startDate and endDate are required',
            details: validation.error.issues,
          });
          return;
        }

        const result = await bookingService.getAvailability(
          id,
          validation.data.startDate,
          validation.data.endDate
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        logger.error('Get availability failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get availability' });
      }
    },

    /**
     * Get booking by ID
     * GET /api/chalets/bookings/:id
     */
    async getBookingById(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const booking = await bookingService.getBookingById(id);

        if (!booking) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        res.json({
          success: true,
          data: booking,
        });
      } catch (error: unknown) {
        logger.error('Get booking failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get booking' });
      }
    },

    /**
     * Get booking by booking number
     * GET /api/chalets/bookings/number/:bookingNumber
     */
    async getBookingByNumber(req: Request, res: Response): Promise<void> {
      try {
        const { bookingNumber } = req.params;
        const booking = await bookingService.getBookingByNumber(bookingNumber);

        if (!booking) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        res.json({
          success: true,
          data: booking,
        });
      } catch (error: unknown) {
        logger.error('Get booking by number failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get booking' });
      }
    },

    /**
     * Get current user's bookings
     * GET /api/chalets/bookings/mine
     */
    async getMyBookings(req: Request, res: Response): Promise<void> {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const bookings = await bookingService.getBookingsByCustomer(userId);

        res.json({
          success: true,
          data: bookings,
        });
      } catch (error: unknown) {
        logger.error('Get my bookings failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get bookings' });
      }
    },

    /**
     * Cancel a booking
     * POST /api/chalets/bookings/:id/cancel
     */
    async cancelBooking(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const validation = cancelBookingSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const booking = await bookingService.cancelBooking(
          id,
          validation.data.reason,
          userId
        );

        res.json({
          success: true,
          data: booking,
          message: 'Booking cancelled',
        });
      } catch (error: unknown) {
        logger.error('Cancel booking failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to cancel booking' });
      }
    },

    /**
     * Get bookings with filters (staff)
     * GET /api/chalets/bookings
     */
    async getBookings(req: Request, res: Response): Promise<void> {
      try {
        const validation = getBookingsQuerySchema.safeParse(req.query);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const bookings = await bookingService.getBookings(validation.data);

        res.json({
          success: true,
          data: bookings,
        });
      } catch (error: unknown) {
        logger.error('Get bookings failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get bookings' });
      }
    },

    /**
     * Get today's check-ins and check-outs (staff)
     * GET /api/chalets/bookings/today
     */
    async getTodayBookings(req: Request, res: Response): Promise<void> {
      try {
        const result = await bookingService.getTodayBookings();

        res.json({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        logger.error('Get today bookings failed', { error: getErrorMessage(error) });
        res.status(500).json({ error: 'Failed to get today bookings' });
      }
    },

    /**
     * Check in a guest (staff)
     * POST /api/chalets/bookings/:id/check-in
     */
    async checkIn(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const staffId = req.user?.userId;

        if (!staffId) {
          res.status(401).json({ error: 'Staff authentication required' });
          return;
        }

        const booking = await bookingService.checkIn(id, staffId);

        res.json({
          success: true,
          data: booking,
          message: 'Guest checked in',
        });
      } catch (error: unknown) {
        logger.error('Check in failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to check in' });
      }
    },

    /**
     * Check out a guest (staff)
     * POST /api/chalets/bookings/:id/check-out
     */
    async checkOut(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const staffId = req.user?.userId;

        if (!staffId) {
          res.status(401).json({ error: 'Staff authentication required' });
          return;
        }

        const booking = await bookingService.checkOut(id, staffId);

        res.json({
          success: true,
          data: booking,
          message: 'Guest checked out',
        });
      } catch (error: unknown) {
        logger.error('Check out failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to check out' });
      }
    },

    /**
     * Update booking status (staff)
     * PATCH /api/chalets/bookings/:id/status
     */
    async updateStatus(req: Request, res: Response): Promise<void> {
      try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const validation = updateStatusSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: validation.error.issues,
          });
          return;
        }

        const booking = await bookingService.updateStatus(
          id,
          validation.data.status,
          userId
        );

        res.json({
          success: true,
          data: booking,
        });
      } catch (error: unknown) {
        logger.error('Update status failed', { error: getErrorMessage(error) });

        if (isServiceError(error)) {
          res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
          return;
        }

        res.status(500).json({ error: 'Failed to update status' });
      }
    },
  };
}
