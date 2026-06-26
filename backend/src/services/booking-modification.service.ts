/**
 * Booking Modification Service
 *
 * Engine-generic modification, cancellation, and rescheduling.
 *
 * time_exclusive_reservation → reservations (any unit: accommodation, courts, spaces)
 * shared_capacity_access     → access tickets (any session: pool, fitness, class, cinema)
 *
 * ALL transaction records live in the `transactions` table.
 * Unit/session config lives in `accommodation_units` / `capacity_windows`.
 * Customer email is read from `metadata.customer_email` (reservations)
 * or fetched from `users` table by `customer_id` (access tickets).
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { emailService } from './email.service.js';
import { logActivity } from '../utils/activityLogger.js';
import { seasonalPricingService } from './seasonal-pricing.service.js';

/** Matches the actual lowercase status values stored in transactions.status */
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  NO_SHOW = 'no_show',
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
 * Cancel a time_exclusive_reservation booking.
 *
 * Does NOT join to `accommodation_units` — all customer-facing data
 * (customer_name, customer_email, check_in_date, check_out_date) is
 * stored in transaction.metadata at creation time.
 */
export async function cancelReservation(
  bookingId: string,
  userId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    const supabase = getSupabase();
    const { data: booking, error: bookingError } = await supabase
      .from('transactions')
      .select('id, customer_id, status, amount, metadata, payments(*)')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', bookingId)
      .maybeSingle();
    if (bookingError) throw bookingError;

    if (!booking) {
      return { success: false, message: 'Booking not found', refundAmount: 0, refundType: RefundType.NONE };
    }

    if (booking.customer_id !== userId) {
      return { success: false, message: 'Unauthorized to cancel this booking', refundAmount: 0, refundType: RefundType.NONE };
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, message: 'Booking is already cancelled', refundAmount: 0, refundType: RefundType.NONE };
    }

    if (booking.status === BookingStatus.CHECKED_IN) {
      return { success: false, message: 'Cannot cancel a booking after check-in', refundAmount: 0, refundType: RefundType.NONE };
    }

    const checkInDate = booking.metadata?.check_in_date
      ? new Date(booking.metadata?.check_in_date as string)
      : new Date();
    const policy = getCancellationPolicy(checkInDate);
    const { refundAmount, creditAmount } = calculateRefund(Number(booking.amount || 0), policy);

    let stripeRefundId: string | null = null;
    const payments = (booking as any).payments || [];
    if (refundAmount > 0 && payments.length > 0) {
      const payment = payments[0];
      if (payment.stripe_payment_intent_id) {
        try {
          const refund = await stripeClient.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
            amount: Math.round(refundAmount * 100),
            reason: 'requested_by_customer',
          });
          stripeRefundId = refund.id;
        } catch (stripeError: any) {
          logger.error('Stripe refund failed', { bookingId, error: stripeError.message });
        }
      }
    }

    // Step 1: insert credit (additive, reversible)
    let creditInsertId: string | null = null;
    if (creditAmount > 0) {
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          amount: creditAmount,
          type: 'CANCELLATION_CREDIT',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          source_booking_id: bookingId,
        })
        .select('id')
        .single();
      if (creditError) {
        logger.error('Credit insert failed during cancellation', { bookingId, userId, creditAmount, error: creditError.message });
        await logActivity({ user_id: userId, action: 'CANCELLATION_CREDIT_FAILED', resource: 'transaction', resource_id: bookingId, details: { creditAmount, error: creditError.message, stripeRefundId } });
      } else {
        creditInsertId = creditData?.id;
      }
    }

    // Step 2: update status (critical)
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: BookingStatus.CANCELLED,
        metadata: {
          ...(booking.metadata as Record<string, any> || {}),
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          refund_amount: refundAmount,
        },
      })
      .eq('id', bookingId);
    if (updateError) {
      if (creditInsertId) {
        await supabase.from('user_credits').delete().eq('id', creditInsertId);
        logger.warn('Rolled back credit after booking update failure', { bookingId, creditInsertId });
      }
      await logActivity({ user_id: userId, action: 'CANCELLATION_DB_FAILED', resource: 'transaction', resource_id: bookingId, details: { error: updateError.message, stripeRefundId, creditRolledBack: !!creditInsertId } });
      throw updateError;
    }

    await logActivity({ user_id: userId, action: 'BOOKING_CANCELLED', resource: 'transaction', resource_id: bookingId, details: { refundAmount, creditAmount, stripeRefundId } });

    const customerEmail = (booking.metadata as any)?.customer_email;
    if (customerEmail) {
      await emailService.sendEmail({
        to: customerEmail,
        subject: 'Booking Cancellation Confirmation',
        html: generateCancellationEmail(booking, refundAmount, creditAmount),
      });
    }

    logger.info('Reservation cancelled', { bookingId, userId, refundAmount, creditAmount });

    return {
      success: true,
      message: 'Booking cancelled successfully',
      refundAmount,
      refundType: policy.refundType,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
    };
  } catch (error: any) {
    logger.error('Failed to cancel reservation', { bookingId, error: error.message });
    throw error;
  }
}

/**
 * Modify dates on a time_exclusive_reservation booking.
 *
 * Overlap check uses DB-level filters (no full row scan).
 * Price recalculation uses accommodation_units + unit_price_rules.
 */
export async function modifyReservationDates(
  bookingId: string,
  userId: string,
  newCheckIn: Date,
  newCheckOut: Date
): Promise<ModificationResult> {
  try {
    const supabase = getSupabase();
    const { data: booking, error: bookingError } = await supabase
      .from('transactions')
      .select('id, customer_id, status, amount, metadata, module_id, payments(*)')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', bookingId)
      .maybeSingle();
    if (bookingError) throw bookingError;

    if (!booking) return { success: false, message: 'Booking not found' };
    if (booking.customer_id !== userId) return { success: false, message: 'Unauthorized to modify this booking' };
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
      return { success: false, message: 'Booking cannot be modified in current state' };
    }

    const unitId = (booking.metadata as any)?.unit_id;

    // Overlap check: DB-filtered, not a full scan
    const { count: conflictCount, error: conflictError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('module_id', booking.module_id)
      .filter('metadata->>unit_id', 'eq', unitId)
      .neq('id', bookingId)
      .in('status', [BookingStatus.CONFIRMED, BookingStatus.PENDING])
      .filter('metadata->>check_in_date', 'lt', newCheckOut.toISOString())
      .filter('metadata->>check_out_date', 'gt', newCheckIn.toISOString());
    if (conflictError) throw conflictError;

    if ((conflictCount ?? 0) > 0) {
      return { success: false, message: 'Selected dates are not available' };
    }

    const nights = Math.ceil(
      (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Fetch unit config for price recalculation
    const { data: unit } = await supabase
      .from('accommodation_units')
      .select('base_price, weekend_price')
      .eq('id', unitId)
      .single();

    const newTotalPrice = await calculateUnitPrice(
      unit,
      newCheckIn,
      newCheckOut,
      nights
    );

    const priceDifference = newTotalPrice - Number(booking.amount || 0);

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        amount: newTotalPrice,
        net_amount: newTotalPrice,
        metadata: {
          ...(booking.metadata as Record<string, any> || {}),
          check_in_date: newCheckIn.toISOString(),
          check_out_date: newCheckOut.toISOString(),
          number_of_nights: nights,
          modified_at: new Date().toISOString(),
        },
      })
      .eq('id', bookingId);
    if (updateError) throw updateError;

    const payments = (booking as any).payments || [];
    if (priceDifference < 0 && payments[0]?.stripe_payment_intent_id) {
      const refundAmount = Math.abs(priceDifference);
      await stripeClient.refunds.create({
        payment_intent: payments[0].stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
      });
      return { success: true, message: 'Booking dates updated. Refund processed.', refundAmount };
    }

    if (priceDifference > 0) {
      return { success: true, message: 'Booking dates updated. Additional payment required.', priceDifference, newPaymentRequired: true };
    }

    return { success: true, message: 'Booking dates updated successfully.' };
  } catch (error: any) {
    logger.error('Failed to modify reservation dates', { bookingId, error: error.message });
    throw error;
  }
}

/**
 * Cancel a shared_capacity_access ticket.
 *
 * Ticket date is read from metadata.ticket_date (set by purchase_shared_capacity_atomic).
 * Customer email is fetched from users table via customer_id.
 */
export async function cancelAccessTicket(
  ticketId: string,
  userId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    const supabase = getSupabase();
    const { data: ticket, error: ticketError } = await supabase
      .from('transactions')
      .select('id, customer_id, status, amount, metadata, payments(*)')
      .eq('engine_type', 'shared_capacity_access')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;

    if (!ticket) {
      return { success: false, message: 'Ticket not found', refundAmount: 0, refundType: RefundType.NONE };
    }

    if (ticket.customer_id !== userId) {
      return { success: false, message: 'Unauthorized to cancel this ticket', refundAmount: 0, refundType: RefundType.NONE };
    }

    if (ticket.status === 'cancelled' || ticket.status === 'used' || ticket.status === 'expired') {
      return { success: false, message: 'Ticket cannot be cancelled', refundAmount: 0, refundType: RefundType.NONE };
    }

    // ticket_date is stored in metadata by purchase_shared_capacity_atomic
    const ticketDateStr = (ticket.metadata as any)?.ticket_date || (ticket.metadata as any)?.date;
    const ticketDate = ticketDateStr ? new Date(ticketDateStr) : new Date();
    const now = new Date();

    if (ticketDate < now) {
      return { success: false, message: 'Cannot cancel a ticket for a past date', refundAmount: 0, refundType: RefundType.NONE };
    }

    const hoursUntil = (ticketDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const refundType = hoursUntil >= 24 ? RefundType.FULL : RefundType.CREDIT;
    const totalPrice = Number(ticket.amount || 0);
    const refundAmount = refundType === RefundType.FULL ? totalPrice : 0;
    const creditAmount = refundType === RefundType.CREDIT ? totalPrice : 0;

    let stripeRefundId: string | null = null;
    const payments = (ticket as any).payments || [];
    if (refundAmount > 0 && payments[0]?.stripe_payment_intent_id) {
      try {
        const refund = await stripeClient.refunds.create({
          payment_intent: payments[0].stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
        });
        stripeRefundId = refund.id;
      } catch (stripeError: any) {
        logger.error('Stripe refund failed for access ticket', { ticketId, error: stripeError.message });
      }
    }

    // Step 1: insert credit (additive, reversible)
    let creditInsertId: string | null = null;
    if (creditAmount > 0) {
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          amount: creditAmount,
          type: 'ACCESS_TICKET_CREDIT',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (creditError) {
        logger.error('Credit insert failed during ticket cancellation', { ticketId, userId, creditAmount, error: creditError.message });
        await logActivity({ user_id: userId, action: 'TICKET_CREDIT_FAILED', resource: 'transaction', resource_id: ticketId, details: { creditAmount, error: creditError.message, stripeRefundId } });
      } else {
        creditInsertId = creditData?.id;
      }
    }

    // Step 2: update status (critical)
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'cancelled',
        metadata: {
          ...(ticket.metadata as Record<string, any> || {}),
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        },
      })
      .eq('id', ticketId);
    if (updateError) {
      if (creditInsertId) {
        await supabase.from('user_credits').delete().eq('id', creditInsertId);
        logger.warn('Rolled back ticket credit after update failure', { ticketId, creditInsertId });
      }
      await logActivity({ user_id: userId, action: 'TICKET_CANCEL_DB_FAILED', resource: 'transaction', resource_id: ticketId, details: { error: updateError.message, stripeRefundId, creditRolledBack: !!creditInsertId } });
      throw updateError;
    }

    await logActivity({ user_id: userId, action: 'ACCESS_TICKET_CANCELLED', resource: 'transaction', resource_id: ticketId, details: { refundAmount, creditAmount, stripeRefundId } });

    // Fetch customer email from users table
    if (ticket.customer_id) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', ticket.customer_id)
        .single();
      if (user?.email) {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Access Ticket Cancellation Confirmation',
          html: `<p>Your ticket for ${ticketDate.toLocaleDateString()} has been cancelled.</p>
                 ${refundAmount > 0 ? `<p>A refund of ${refundAmount.toFixed(2)} will be processed.</p>` : ''}
                 ${creditAmount > 0 ? `<p>A credit of ${creditAmount.toFixed(2)} has been added to your account.</p>` : ''}`,
        });
      }
    }

    logger.info('Access ticket cancelled', { ticketId, userId, refundAmount, creditAmount });

    return {
      success: true,
      message: 'Ticket cancelled successfully',
      refundAmount,
      refundType,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
    };
  } catch (error: any) {
    logger.error('Failed to cancel access ticket', { ticketId, error: error.message });
    throw error;
  }
}

/**
 * Reschedule a shared_capacity_access ticket to a new date.
 *
 * Capacity check uses capacity_windows (generic) instead of system_settings.
 * Session ID is read from metadata.session_id (set by purchase_shared_capacity_atomic).
 */
export async function rescheduleAccessTicket(
  ticketId: string,
  userId: string,
  newDate: Date
): Promise<ModificationResult> {
  try {
    const supabase = getSupabase();
    const { data: ticket, error: ticketError } = await supabase
      .from('transactions')
      .select('id, customer_id, status, metadata')
      .eq('engine_type', 'shared_capacity_access')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;

    if (!ticket) return { success: false, message: 'Ticket not found' };
    if (ticket.customer_id !== userId) return { success: false, message: 'Unauthorized to modify this ticket' };

    // valid is the correct initial state for shared_capacity_access (per purchase_shared_capacity_atomic)
    if (ticket.status !== 'valid' && ticket.status !== 'confirmed') {
      return { success: false, message: 'Ticket cannot be rescheduled in its current state' };
    }

    const sessionId = (ticket.metadata as any)?.session_id;
    const newDateStr = newDate.toISOString().split('T')[0];

    // Get capacity window to know max_capacity
    const { data: window, error: windowError } = await supabase
      .from('capacity_windows')
      .select('max_capacity')
      .eq('id', sessionId)
      .single();
    if (windowError || !window) {
      return { success: false, message: 'Session not found for this ticket' };
    }

    // Count existing valid/confirmed tickets for this session on the new date
    const { count: existingCount, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('engine_type', 'shared_capacity_access')
      .filter('metadata->>session_id', 'eq', sessionId)
      .filter('metadata->>ticket_date', 'eq', newDateStr)
      .not('status', 'in', '("cancelled","expired","no_show")');
    if (countError) throw countError;

    if ((existingCount ?? 0) >= window.max_capacity) {
      return { success: false, message: 'Selected date is fully booked' };
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        metadata: {
          ...(ticket.metadata as Record<string, any> || {}),
          ticket_date: newDateStr,
          date: newDateStr,
          modified_at: new Date().toISOString(),
        },
      })
      .eq('id', ticketId);
    if (updateError) throw updateError;

    // Fetch customer email for confirmation
    if (ticket.customer_id) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', ticket.customer_id)
        .single();
      if (user?.email) {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Ticket Rescheduled',
          html: `<p>Your ticket has been rescheduled to ${newDate.toLocaleDateString()}.</p>`,
        });
      }
    }

    logger.info('Access ticket rescheduled', { ticketId, userId, newDate });

    return { success: true, message: 'Ticket rescheduled successfully' };
  } catch (error: any) {
    logger.error('Failed to reschedule access ticket', { ticketId, error: error.message });
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
  engineType: 'time_exclusive_reservation' | 'shared_capacity_access' | 'instant_transaction' | 'ongoing_entitlement',
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
        await logActivity({ user_id: userId, action: 'CREDIT_APPLICATION_FAILED', resource: 'transaction', resource_id: bookingId, details: { error: updateError.message, rolledBack: successfulUpdates.length } });
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
  engineType,
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
 * Helper: Calculate unit price with weekend/weekday rates and seasonal pricing.
 * Uses accommodation_units config. Falls back to night-by-night calculation.
 */
async function calculateUnitPrice(
  unit: { base_price: number | string; weekend_price?: number | string } | null,
  checkIn: Date,
  checkOut: Date,
  nights: number
): Promise<number> {
  try {
    const basePrice = Number(unit?.base_price || 0);
    const unitId = (unit as any)?.id;
    if (unitId) {
      const priceResult = await seasonalPricingService.calculatePrice(
        'accommodation_units',
        unitId,
        basePrice,
        checkIn,
        checkOut
      );
      return priceResult.finalPrice;
    }
    throw new Error('No unit id for seasonal pricing');
  } catch (err: any) {
    logger.warn('Seasonal price unavailable for modification, falling back to base calculation', { err: err.message });

    let totalPrice = 0;
    const current = new Date(checkIn);
    for (let i = 0; i < nights; i++) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
      const weekendPrice = Number(unit?.weekend_price || 0);
      const basePrice = Number(unit?.base_price || 0);
      totalPrice += isWeekend && weekendPrice ? weekendPrice : basePrice;
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
      <li><strong>Unit ID:</strong> ${booking.metadata?.unit_id}</li>
      <li><strong>Check-in:</strong> ${new Date(booking.metadata?.check_in_date).toLocaleDateString()}</li>
      <li><strong>Check-out:</strong> ${new Date(booking.metadata?.check_out_date).toLocaleDateString()}</li>
      <li><strong>Original Amount:</strong> ${Number(booking.amount).toFixed(2)}</li>
    </ul>

    ${refundAmount > 0 ? `
    <h3>Refund Information</h3>
    <p>A refund of <strong>${refundAmount.toFixed(2)}</strong> will be processed to your original payment method within 5-10 business days.</p>
    ` : ''}

    ${creditAmount > 0 ? `
    <h3>Account Credit</h3>
    <p>A credit of <strong>${creditAmount.toFixed(2)}</strong> has been added to your account. Valid for 1 year on future bookings.</p>
    ` : ''}

    <p>If you have any questions, please contact our support team.</p>
  `;
}

export default {
  getCancellationPolicy,
  calculateRefund,
  cancelReservation,
  modifyReservationDates,
  cancelAccessTicket,
  rescheduleAccessTicket,
  getUserCredits,
  applyCreditToBooking,
  BookingStatus,
  RefundType,
};
