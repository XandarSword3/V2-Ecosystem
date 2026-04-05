/**
 * Booking Modification Service
 * 
 * Handles booking changes, cancellations, refunds, and rebooking.
 * Supports both chalet and pool ticket modifications.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { emailService } from './email.service.js';
import { logActivity } from '../utils/activityLogger.js'; // FIX: Iteration 9 - Audit trail for cancellations
import { seasonalPricingService } from './seasonal-pricing.service.js';

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
    const supabase = getSupabase();
    const { data: booking, error: bookingError } = await supabase
      .from('chalet_bookings')
      .select('*, chalet:chalets(*), user:users(*), payments(*)')
      .eq('id', bookingId)
      .maybeSingle();
    if (bookingError) throw bookingError;

    if (!booking) {
      return {
        success: false,
        message: 'Booking not found',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    // Verify ownership
    if (booking.user_id !== userId) {
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
    const policy = getCancellationPolicy(new Date(booking.check_in_date || new Date()));
    const { refundAmount, creditAmount } = calculateRefund(
      Number(booking.total_price || 0),
      policy
    );

    // Process refund through Stripe if applicable
    let stripeRefundId: string | null = null;
    if (refundAmount > 0 && booking.payments.length > 0) {
      const payment = booking.payments[0];
      if (payment.stripe_payment_intent_id) {
        try {
          const refund = await stripeClient.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
            amount: Math.round(refundAmount * 100), // Convert to cents
            reason: 'requested_by_customer',
          });
          stripeRefundId = refund.id;
        } catch (stripeError: any) {
          logger.error('Stripe refund failed', {
            bookingId,
            error: stripeError.message
          });
          // Continue with cancellation even if refund fails
        }
      }
    }

    // FIX: Iteration 9 - Ordered DB operations with compensation for atomicity
    // Step 1: Insert credit FIRST (additive, easily reversible)
    let creditInsertId: string | null = null;
    if (creditAmount > 0) {
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          amount: creditAmount,
          type: 'CANCELLATION_CREDIT',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          source_booking_id: bookingId,
        })
        .select('id')
        .single();
      if (creditError) {
        // Log for reconciliation but don't block cancellation
        logger.error('Credit insert failed during cancellation', { bookingId, userId, creditAmount, error: creditError.message });
        await logActivity({ user_id: userId, action: 'CANCELLATION_CREDIT_FAILED', resource: 'chalet_bookings', resource_id: bookingId, details: { creditAmount, error: creditError.message, stripeRefundId } });
      } else {
        creditInsertId = creditData?.id;
      }
    }

    // Step 2: Update booking status (critical state change)
    const { error: updateError } = await supabase
      .from('chalet_bookings')
      .update({
        status: BookingStatus.CANCELLED,
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        refund_amount: refundAmount,
      })
      .eq('id', bookingId);
    if (updateError) {
      // Compensate: reverse the credit insert if booking update failed
      if (creditInsertId) {
        await supabase.from('user_credits').delete().eq('id', creditInsertId);
        logger.warn('Rolled back credit insert after booking update failure', { bookingId, creditInsertId });
      }
      // Log for reconciliation — Stripe refund may have already occurred
      await logActivity({ user_id: userId, action: 'CANCELLATION_DB_FAILED', resource: 'chalet_bookings', resource_id: bookingId, details: { error: updateError.message, stripeRefundId, creditRolledBack: !!creditInsertId } });
      throw updateError;
    }

    // Audit log: successful cancellation
    await logActivity({ user_id: userId, action: 'BOOKING_CANCELLED', resource: 'chalet_bookings', resource_id: bookingId, details: { refundAmount, creditAmount, stripeRefundId } });

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
    const supabase = getSupabase();
    const { data: booking, error: bookingError } = await supabase
      .from('chalet_bookings')
      .select('*, chalet:chalets(*), user:users(*), payments(*)')
      .eq('id', bookingId)
      .maybeSingle();
    if (bookingError) throw bookingError;

    if (!booking) {
      return { success: false, message: 'Booking not found' };
    }

    if (booking.user_id !== userId) {
      return { success: false, message: 'Unauthorized to modify this booking' };
    }

    if (booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.PENDING) {
      return { success: false, message: 'Booking cannot be modified in current state' };
    }

    // Check availability for new dates
    const { data: conflictingBookings, error: conflictError } = await supabase
      .from('chalet_bookings')
      .select('id')
      .eq('chalet_id', booking.chalet_id)
      .neq('id', bookingId)
      .in('status', [BookingStatus.CONFIRMED, BookingStatus.PENDING])
      .lte('check_in_date', newCheckOut.toISOString())
      .gte('check_out_date', newCheckIn.toISOString())
      .limit(1);
    if (conflictError) throw conflictError;

    if (conflictingBookings && conflictingBookings.length > 0) {
      return {
        success: false,
        message: 'Selected dates are not available'
      };
    }

    // Calculate new price
    const nights = Math.ceil(
      (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newTotalPrice = await calculateChaletPrice(
      booking.chalet,
      newCheckIn,
      newCheckOut,
      nights
    );

    const priceDifference = newTotalPrice - Number(booking.total_price || 0);

    // Update booking
    const { error: updateError } = await supabase
      .from('chalet_bookings')
      .update({
        check_in_date: newCheckIn.toISOString(),
        check_out_date: newCheckOut.toISOString(),
        nights,
        total_price: newTotalPrice,
        modified_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
    if (updateError) throw updateError;

    // Handle price difference
    if (priceDifference > 0) {
      return {
        success: true,
        message: 'Booking dates updated. Additional payment required.',
        priceDifference,
        newPaymentRequired: true,
      };
    } else if (priceDifference < 0) {
      const refundAmount = Math.abs(priceDifference);
      if (booking.payments[0]?.stripe_payment_intent_id) {
        await stripeClient.refunds.create({
          payment_intent: booking.payments[0].stripe_payment_intent_id,
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
    const supabase = getSupabase();
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*, user:users(*), payment:payments(*)')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;

    if (!ticket) {
      return {
        success: false,
        message: 'Ticket not found',
        refundAmount: 0,
        refundType: RefundType.NONE,
      };
    }

    if (ticket.user_id !== userId) {
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
    const ticketDate = new Date(ticket.date || new Date());
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
    const totalPrice = Number(ticket.total_price || 0);
    const refundAmount = refundType === RefundType.FULL ? totalPrice : 0;
    const creditAmount = refundType === RefundType.CREDIT ? totalPrice : 0;

    // Process refund
    let stripeRefundId: string | null = null;
    if (refundAmount > 0 && ticket.payment?.stripe_payment_intent_id) {
      try {
        const refund = await stripeClient.refunds.create({
          payment_intent: ticket.payment.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
        });
        stripeRefundId = refund.id;
      } catch (stripeError: any) {
        logger.error('Stripe refund failed for pool ticket', { ticketId, error: stripeError.message });
      }
    }

    // FIX: Iteration 9 - Ordered DB operations with compensation for atomicity
    // Step 1: Insert credit FIRST (additive, easily reversible)
    let creditInsertId: string | null = null;
    if (creditAmount > 0) {
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          amount: creditAmount,
          type: 'POOL_TICKET_CREDIT',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        })
        .select('id')
        .single();
      if (creditError) {
        logger.error('Credit insert failed during pool ticket cancellation', { ticketId, userId, creditAmount, error: creditError.message });
        await logActivity({ user_id: userId, action: 'POOL_CREDIT_FAILED', resource: 'pool_tickets', resource_id: ticketId, details: { creditAmount, error: creditError.message, stripeRefundId } });
      } else {
        creditInsertId = creditData?.id;
      }
    }

    // Step 2: Update ticket status (critical state change)
    const { error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', ticketId);
    if (updateError) {
      // Compensate: reverse credit if ticket update failed
      if (creditInsertId) {
        await supabase.from('user_credits').delete().eq('id', creditInsertId);
        logger.warn('Rolled back pool credit after ticket update failure', { ticketId, creditInsertId });
      }
      await logActivity({ user_id: userId, action: 'POOL_CANCEL_DB_FAILED', resource: 'pool_tickets', resource_id: ticketId, details: { error: updateError.message, stripeRefundId, creditRolledBack: !!creditInsertId } });
      throw updateError;
    }

    // Audit log: successful cancellation
    await logActivity({ user_id: userId, action: 'POOL_TICKET_CANCELLED', resource: 'pool_tickets', resource_id: ticketId, details: { refundAmount, creditAmount, stripeRefundId } });

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
    const supabase = getSupabase();
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*, user:users(*)')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;

    if (!ticket) {
      return { success: false, message: 'Ticket not found' };
    }

    if (ticket.user_id !== userId) {
      return { success: false, message: 'Unauthorized to modify this ticket' };
    }

    if (ticket.status !== 'ACTIVE') {
      return { success: false, message: 'Ticket cannot be rescheduled' };
    }

    // Check capacity for new date
    const { count: existingTicketsCount, error: countError } = await supabase
      .from('pool_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('date', newDate.toISOString())
      .eq('status', 'ACTIVE');
    if (countError) throw countError;

    // Get pool capacity setting
    const { data: capacitySetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'pool.dailyCapacity')
      .maybeSingle();
    const dailyCapacity = capacitySetting ? parseInt(capacitySetting.value) : 100;

    if ((existingTicketsCount || 0) >= dailyCapacity) {
      return {
        success: false,
        message: 'Selected date is fully booked'
      };
    }

    // Update ticket date
    const { error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        date: newDate.toISOString(),
        modified_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
    if (updateError) throw updateError;

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
  const supabase = getSupabase();

  const { data: credits, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: true });
  if (error) throw error;

  const totalCredits = (credits || []).reduce((sum: number, credit: any) => sum + Number(credit.amount), 0);

  return { totalCredits, credits: credits || [] };
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
  const supabase = getSupabase();

  // FIX: Iteration 9 - Track successful updates for rollback on partial failure
  const successfulUpdates: Array<{ creditId: string; originalAmount: number; usedAmount: number }> = [];

  // Use credits in order of expiration (FIFO)
  try {
    for (const credit of credits) {
      if (remainingToApply <= 0) break;

      const useAmount = Math.min(credit.amount, remainingToApply);

      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          amount: credit.amount - useAmount,
          used_at: credit.amount - useAmount === 0 ? now.toISOString() : null,
        })
        .eq('id', credit.id);

      if (updateError) {
        // Rollback all successful credit deductions
        for (const prev of successfulUpdates) {
          await supabase.from('user_credits').update({
            amount: prev.originalAmount,
            used_at: null,
          }).eq('id', prev.creditId);
        }
        logger.error('Credit application failed, rolled back previous deductions', { bookingId, updateError: updateError.message, rolledBack: successfulUpdates.length });
        await logActivity({ user_id: userId, action: 'CREDIT_APPLICATION_FAILED', resource: bookingType === 'chalet' ? 'chalet_bookings' : 'pool_tickets', resource_id: bookingId, details: { error: updateError.message, rolledBack: successfulUpdates.length } });
        throw updateError;
      }

      successfulUpdates.push({ creditId: credit.id, originalAmount: credit.amount, usedAmount: useAmount });
      remainingToApply -= useAmount;
    }
  } catch (error) {
    throw error;
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
 * Helper: Calculate chalet price with weekend/weekday rates and seasonal pricing
 */
async function calculateChaletPrice(
  chalet: any,
  checkIn: Date,
  checkOut: Date,
  nights: number
): Promise<number> {
  try {
    const basePrice = chalet.base_price || chalet.basePrice || 0;
    const priceResult = await seasonalPricingService.calculatePrice(
      'chalets',
      chalet.id,
      basePrice,
      checkIn,
      checkOut
    );
    return priceResult.finalPrice;
  } catch (err: any) {
    logger.warn('Failed to calculate seasonal price for modification, falling back to base calculation', { err: err.message });

    let totalPrice = 0;
    const current = new Date(checkIn);

    for (let i = 0; i < nights; i++) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat, Sun

      const weekendPrice = chalet.weekend_price || chalet.weekendPrice;
      const basePrice = chalet.base_price || chalet.basePrice;

      if (isWeekend && weekendPrice) {
        totalPrice += weekendPrice;
      } else {
        totalPrice += basePrice;
      }

      current.setDate(current.getDate() + 1);
    }

    return totalPrice;
  }
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
      <li><strong>Check-in:</strong> ${new Date(booking.check_in_date).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.check_out_date).toLocaleDateString()}</li>
      <li><strong>Original Amount:</strong> $${booking.total_price.toFixed(2)}</li>
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
