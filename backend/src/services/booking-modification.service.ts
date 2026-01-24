/**
 * Booking Modification Service
 * 
 * Handles booking changes, cancellations, refunds, and rebooking.
 * Supports both chalet and pool ticket modifications.
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { emailService } from './email.service.js';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  NO_SHOW = 'NO_SHOW',
}

export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  CREDIT = 'CREDIT',
  NONE = 'NONE',
}

interface CancellationPolicy {
  daysBeforeCheckin: number;
  refundPercentage: number;
  refundType: RefundType;
}

// Default cancellation policies
const DEFAULT_CANCELLATION_POLICIES: CancellationPolicy[] = [
  { daysBeforeCheckin: 14, refundPercentage: 100, refundType: RefundType.FULL },
  { daysBeforeCheckin: 7, refundPercentage: 50, refundType: RefundType.PARTIAL },
  { daysBeforeCheckin: 3, refundPercentage: 25, refundType: RefundType.PARTIAL },
  { daysBeforeCheckin: 0, refundPercentage: 0, refundType: RefundType.NONE },
];

interface ModificationResult {
  success: boolean;
  message: string;
  booking?: any;
  priceDifference?: number;
  refundAmount?: number;
  newPaymentRequired?: boolean;
}

interface CancellationResult {
  success: boolean;
  message: string;
  refundAmount: number;
  refundType: RefundType;
  creditAmount?: number;
}

/**
 * Get applicable cancellation policy
 */
export function getCancellationPolicy(
  checkinDate: Date,
  policies: CancellationPolicy[] = DEFAULT_CANCELLATION_POLICIES
): CancellationPolicy {
  const now = new Date();
  const daysUntilCheckin = Math.ceil(
    (checkinDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Sort policies by days (descending) and find applicable one
  const sortedPolicies = [...policies].sort(
    (a, b) => b.daysBeforeCheckin - a.daysBeforeCheckin
  );

  for (const policy of sortedPolicies) {
    if (daysUntilCheckin >= policy.daysBeforeCheckin) {
      return policy;
    }
  }

  // Return last policy (most restrictive) if no match
  return sortedPolicies[sortedPolicies.length - 1];
}

/**
 * Calculate refund amount based on policy
 */
export function calculateRefund(
  totalAmount: number,
  policy: CancellationPolicy
): { refundAmount: number; creditAmount: number } {
  const refundAmount = Math.round((totalAmount * policy.refundPercentage) / 100);
  const creditAmount = policy.refundType === RefundType.CREDIT ? totalAmount - refundAmount : 0;

  return { refundAmount, creditAmount };
}

/**
 * Cancel a chalet booking
 */
export async function cancelChaletBooking(
  bookingId: string,
  userId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    const booking = await prisma.chaletBooking.findUnique({
      where: { id: bookingId },
      include: {
        chalet: true,
        user: true,
        payments: true,
      },
    });

    if (!booking) {
      return {
        success: false,
        message: 'Booking not found',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Verify ownership
    if (booking.userId !== userId) {
      return {
        success: false,
        message: 'Unauthorized to cancel this booking',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Check if booking can be cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      return {
        success: false,
        message: 'Booking is already cancelled',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    if (booking.status === BookingStatus.CHECKED_IN) {
      return {
        success: false,
        message: 'Cannot cancel a booking after check-in',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Get cancellation policy
    const policy = getCancellationPolicy(new Date(booking.checkInDate));
    const { refundAmount, creditAmount } = calculateRefund(
      Number(booking.totalPrice || 0),
      policy
    );

    // Process refund through Stripe if applicable
    if (refundAmount > 0 && booking.payments.length > 0) {
      const payment = booking.payments[0];
      if (payment.stripePaymentIntentId) {
        try {
          await stripeClient.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: Math.round(refundAmount * 100), // Convert to cents
            reason: 'requested_by_customer',
          });
        } catch (stripeError: any) {
          logger.error('Stripe refund failed', { 
            bookingId, 
            error: stripeError.message 
          });
          // Continue with cancellation even if refund fails
        }
      }
    }

    // Update booking status
    await prisma.chaletBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
        refundAmount,
      },
    });

    // Add credit to user account if applicable
    if (creditAmount > 0) {
      await prisma.userCredit.create({
        data: {
          userId,
          amount: creditAmount,
          type: 'CANCELLATION_CREDIT',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          sourceBookingId: bookingId,
        },
      });
    }

    // Send cancellation email
    await emailService.sendEmail({
      to: booking.user.email,
      subject: 'Booking Cancellation Confirmation',
      html: generateCancellationEmail(booking, refundAmount, creditAmount),
    });

    logger.info('Chalet booking cancelled', {
      bookingId,
      userId,
      refundAmount,
      creditAmount,
    });

    return {
      success: true,
      message: 'Booking cancelled successfully',
      refundAmount,
      refundType: policy.refundType,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
    };
  } catch (error: any) {
    logger.error('Failed to cancel booking', { bookingId, error: error.message });
    throw error;
  }
}

/**
 * Modify chalet booking dates
 */
export async function modifyChaletBookingDates(
  bookingId: string,
  userId: string,
  newCheckIn: Date,
  newCheckOut: Date
): Promise<ModificationResult> {
  try {
    const booking = await prisma.chaletBooking.findUnique({
      where: { id: bookingId },
      include: {
        chalet: true,
        user: true,
        payments: true,
      },
    });

    if (!booking) {
      return { success: false, message: 'Booking not found' };
    }

    if (booking.userId !== userId) {
      return { success: false, message: 'Unauthorized to modify this booking' };
    }

    if (booking.status !== BookingStatus.CONFIRMED && 
        booking.status !== BookingStatus.PENDING) {
      return { success: false, message: 'Booking cannot be modified in current state' };
    }

    // Check availability for new dates
    const conflictingBooking = await prisma.chaletBooking.findFirst({
      where: {
        chaletId: booking.chaletId,
        id: { not: bookingId },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        OR: [
          {
            checkInDate: { lte: newCheckOut },
            checkOutDate: { gte: newCheckIn },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return { 
        success: false, 
        message: 'Selected dates are not available' 
      };
    }

    // Calculate new price
    const nights = Math.ceil(
      (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newTotalPrice = calculateChaletPrice(
      booking.chalet,
      newCheckIn,
      newCheckOut,
      nights
    );

    const priceDifference = newTotalPrice - Number(booking.totalPrice || 0);

    // Update booking
    await prisma.chaletBooking.update({
      where: { id: bookingId },
      data: {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        nights,
        totalPrice: newTotalPrice,
        modifiedAt: new Date(),
      },
    });

    // Handle price difference
    if (priceDifference > 0) {
      // Additional payment required
      return {
        success: true,
        message: 'Booking dates updated. Additional payment required.',
        priceDifference,
        newPaymentRequired: true,
      };
    } else if (priceDifference < 0) {
      // Refund difference
      const refundAmount = Math.abs(priceDifference);
      if (booking.payments[0]?.stripePaymentIntentId) {
        await stripeClient.refunds.create({
          payment_intent: booking.payments[0].stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
        });
      }
      return {
        success: true,
        message: 'Booking dates updated. Refund processed.',
        refundAmount,
      };
    }

    return {
      success: true,
      message: 'Booking dates updated successfully.',
    };
  } catch (error: any) {
    logger.error('Failed to modify booking dates', { bookingId, error: error.message });
    throw error;
  }
}

/**
 * Cancel pool ticket
 */
export async function cancelPoolTicket(
  ticketId: string,
  userId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    const ticket = await prisma.poolTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: true,
        payment: true,
      },
    });

    if (!ticket) {
      return {
        success: false,
        message: 'Ticket not found',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    if (ticket.userId !== userId) {
      return {
        success: false,
        message: 'Unauthorized to cancel this ticket',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    if (ticket.status === 'CANCELLED' || ticket.status === 'USED') {
      return {
        success: false,
        message: 'Ticket cannot be cancelled',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Check if ticket date has passed
    const ticketDate = new Date(ticket.date);
    const now = new Date();
    
    if (ticketDate < now) {
      return {
        success: false,
        message: 'Cannot cancel a ticket for a past date',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Full refund if more than 24 hours before, otherwise credit
    const hoursUntil = (ticketDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const refundType = hoursUntil >= 24 ? RefundType.FULL : RefundType.CREDIT;
    const totalPrice = Number(ticket.totalPrice || 0);
    const refundAmount = refundType === RefundType.FULL ? totalPrice : 0;
    const creditAmount = refundType === RefundType.CREDIT ? totalPrice : 0;

    // Process refund
    if (refundAmount > 0 && ticket.payment?.stripePaymentIntentId) {
      await stripeClient.refunds.create({
        payment_intent: ticket.payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
      });
    }

    // Add credit if applicable
    if (creditAmount > 0) {
      await prisma.userCredit.create({
        data: {
          userId,
          amount: creditAmount,
          type: 'POOL_TICKET_CREDIT',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      });
    }

    // Update ticket status
    await prisma.poolTicket.update({
      where: { id: ticketId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // Send confirmation email
    await emailService.sendEmail({
      to: ticket.user.email,
      subject: 'Pool Ticket Cancellation Confirmation',
      html: `<p>Your pool ticket for ${ticketDate.toLocaleDateString()} has been cancelled.</p>
             ${refundAmount > 0 ? `<p>A refund of $${refundAmount.toFixed(2)} will be processed.</p>` : ''}
             ${creditAmount > 0 ? `<p>A credit of $${creditAmount.toFixed(2)} has been added to your account.</p>` : ''}`,
    });

    logger.info('Pool ticket cancelled', { ticketId, userId, refundAmount, creditAmount });

    return {
      success: true,
      message: 'Ticket cancelled successfully',
      refundAmount,
      refundType,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
    };
  } catch (error: any) {
    logger.error('Failed to cancel pool ticket', { ticketId, error: error.message });
    throw error;
  }
}

/**
 * Reschedule pool ticket to a new date
 */
export async function reschedulePoolTicket(
  ticketId: string,
  userId: string,
  newDate: Date
): Promise<ModificationResult> {
  try {
    const ticket = await prisma.poolTicket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });

    if (!ticket) {
      return { success: false, message: 'Ticket not found' };
    }

    if (ticket.userId !== userId) {
      return { success: false, message: 'Unauthorized to modify this ticket' };
    }

    if (ticket.status !== 'ACTIVE') {
      return { success: false, message: 'Ticket cannot be rescheduled' };
    }

    // Check capacity for new date
    const existingTicketsCount = await prisma.poolTicket.count({
      where: {
        date: newDate,
        status: 'ACTIVE',
      },
    });

    // Get pool capacity setting
    const capacitySetting = await prisma.systemSettings.findUnique({
      where: { key: 'pool.dailyCapacity' },
    });
    const dailyCapacity = capacitySetting ? parseInt(capacitySetting.value) : 100;

    if (existingTicketsCount >= dailyCapacity) {
      return { 
        success: false, 
        message: 'Selected date is fully booked' 
      };
    }

    // Update ticket date
    await prisma.poolTicket.update({
      where: { id: ticketId },
      data: {
        date: newDate,
        modifiedAt: new Date(),
      },
    });

    // Send confirmation email
    await emailService.sendEmail({
      to: ticket.user.email,
      subject: 'Pool Ticket Rescheduled',
      html: `<p>Your pool ticket has been rescheduled to ${newDate.toLocaleDateString()}.</p>`,
    });

    logger.info('Pool ticket rescheduled', { ticketId, userId, newDate });

    return {
      success: true,
      message: 'Ticket rescheduled successfully',
    };
  } catch (error: any) {
    logger.error('Failed to reschedule pool ticket', { ticketId, error: error.message });
    throw error;
  }
}

/**
 * Get user's available credits
 */
export async function getUserCredits(userId: string): Promise<{
  totalCredits: number;
  credits: any[];
}> {
  const now = new Date();
  
  const credits = await prisma.userCredit.findMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: 'asc' },
  });

  const totalCredits = credits.reduce((sum, credit) => sum + Number(credit.amount), 0);

  return { totalCredits, credits };
}

/**
 * Apply credit to a booking
 */
export async function applyCreditToBooking(
  userId: string,
  amount: number,
  bookingType: 'chalet' | 'pool',
  bookingId: string
): Promise<{ success: boolean; appliedAmount: number; remainingTotal: number }> {
  const { totalCredits, credits } = await getUserCredits(userId);
  const amountToApply = Math.min(amount, totalCredits);

  if (amountToApply <= 0) {
    return { success: false, appliedAmount: 0, remainingTotal: amount };
  }

  let remainingToApply = amountToApply;
  const now = new Date();

  // Use credits in order of expiration (FIFO)
  for (const credit of credits) {
    if (remainingToApply <= 0) break;

    const useAmount = Math.min(credit.amount, remainingToApply);
    
    await prisma.userCredit.update({
      where: { id: credit.id },
      data: {
        amount: credit.amount - useAmount,
        usedAt: credit.amount - useAmount === 0 ? now : null,
      },
    });

    remainingToApply -= useAmount;
  }

  logger.info('Credit applied to booking', {
    userId,
    bookingType,
    bookingId,
    appliedAmount: amountToApply,
  });

  return {
    success: true,
    appliedAmount: amountToApply,
    remainingTotal: amount - amountToApply,
  };
}

/**
 * Helper: Calculate chalet price with weekend/weekday rates
 */
function calculateChaletPrice(
  chalet: any,
  checkIn: Date,
  checkOut: Date,
  nights: number
): number {
  let totalPrice = 0;
  const current = new Date(checkIn);

  for (let i = 0; i < nights; i++) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat, Sun
    
    if (isWeekend && chalet.weekendPrice) {
      totalPrice += chalet.weekendPrice;
    } else {
      totalPrice += chalet.basePrice;
    }
    
    current.setDate(current.getDate() + 1);
  }

  return totalPrice;
}

/**
 * Helper: Generate cancellation email
 */
function generateCancellationEmail(
  booking: any,
  refundAmount: number,
  creditAmount: number
): string {
  return `
    <h2>Booking Cancellation Confirmation</h2>
    <p>Your booking has been cancelled.</p>
    
    <h3>Booking Details</h3>
    <ul>
      <li><strong>Property:</strong> ${booking.chalet.name}</li>
      <li><strong>Check-in:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</li>
      <li><strong>Original Amount:</strong> $${booking.totalPrice.toFixed(2)}</li>
    </ul>
    
    ${refundAmount > 0 ? `
    <h3>Refund Information</h3>
    <p>A refund of <strong>$${refundAmount.toFixed(2)}</strong> will be processed to your original payment method within 5-10 business days.</p>
    ` : ''}
    
    ${creditAmount > 0 ? `
    <h3>Account Credit</h3>
    <p>A credit of <strong>$${creditAmount.toFixed(2)}</strong> has been added to your account. This credit is valid for 1 year and can be used on future bookings.</p>
    ` : ''}
    
    <p>If you have any questions, please contact our support team.</p>
  `;
}

export default {
  getCancellationPolicy,
  calculateRefund,
  cancelChaletBooking,
  modifyChaletBookingDates,
  cancelPoolTicket,
  reschedulePoolTicket,
  getUserCredits,
  applyCreditToBooking,
  BookingStatus,
  RefundType,
};
