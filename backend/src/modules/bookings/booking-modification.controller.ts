/**
 * Booking Modification Controller
 * 
 * API endpoints for modifying, cancelling, and rescheduling bookings.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate as authMiddleware } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';
import {
  cancelChaletBooking,
  modifyChaletBookingDates,
  cancelPoolTicket,
  reschedulePoolTicket,
  getUserCredits,
  getCancellationPolicy,
} from '../../services/booking-modification.service';

const router = Router();

// Validation schemas
const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});

const modifyDatesSchema = z.object({
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
});

const rescheduleTicketSchema = z.object({
  newDate: z.string().datetime(),
});

/**
 * POST /bookings/chalets/:id/cancel
 * Cancel a chalet booking
 */
router.post(
  '/chalets/:id/cancel',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const validation = cancelBookingSchema.safeParse(req.body);
      const reason = validation.success ? validation.data.reason : undefined;

      const result = await cancelChaletBooking(id, userId, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          refundAmount: result.refundAmount,
          refundType: result.refundType,
          creditAmount: result.creditAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /bookings/chalets/:id/dates
 * Modify chalet booking dates
 */
router.put(
  '/chalets/:id/dates',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const validation = modifyDatesSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid dates',
          details: validation.error.flatten(),
        });
      }

      const { checkInDate, checkOutDate } = validation.data;

      const result = await modifyChaletBookingDates(
        id,
        userId,
        new Date(checkInDate),
        new Date(checkOutDate)
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          priceDifference: result.priceDifference,
          refundAmount: result.refundAmount,
          newPaymentRequired: result.newPaymentRequired,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bookings/chalets/:id/cancellation-policy
 * Get cancellation policy for a specific booking
 */
router.get(
  '/chalets/:id/cancellation-policy',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const booking = await prisma.chaletBooking.findUnique({
        where: { id },
        select: { checkInDate: true, totalPrice: true },
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found',
        });
      }

      const policy = getCancellationPolicy(new Date(booking.checkInDate));
      const refundAmount = Math.round(
        (Number(booking.totalPrice) * policy.refundPercentage) / 100
      );

      res.json({
        success: true,
        data: {
          refundPercentage: policy.refundPercentage,
          refundType: policy.refundType,
          estimatedRefund: refundAmount,
          daysBeforeCheckin: policy.daysBeforeCheckin,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bookings/pool-tickets/:id/cancel
 * Cancel a pool ticket
 */
router.post(
  '/pool-tickets/:id/cancel',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const validation = cancelBookingSchema.safeParse(req.body);
      const reason = validation.success ? validation.data.reason : undefined;

      const result = await cancelPoolTicket(id, userId, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          refundAmount: result.refundAmount,
          refundType: result.refundType,
          creditAmount: result.creditAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /bookings/pool-tickets/:id/reschedule
 * Reschedule a pool ticket to a new date
 */
router.put(
  '/pool-tickets/:id/reschedule',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const validation = rescheduleTicketSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date',
          details: validation.error.flatten(),
        });
      }

      const { newDate } = validation.data;

      const result = await reschedulePoolTicket(
        id,
        userId,
        new Date(newDate)
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bookings/credits
 * Get user's available credits
 */
router.get(
  '/credits',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { totalCredits, credits } = await getUserCredits(userId);

      res.json({
        success: true,
        data: {
          totalCredits,
          credits: credits.map(credit => ({
            id: credit.id,
            amount: credit.amount,
            type: credit.type,
            expiresAt: credit.expiresAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Import prisma for direct queries
import { prisma } from '../../config/database.js';

export default router;
