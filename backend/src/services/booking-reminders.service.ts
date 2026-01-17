/**
 * Booking Reminders Service
 * Sends pre-arrival reminder emails to customers with upcoming chalet bookings
 */

import { getSupabase } from '../database/connection.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

interface ChaletBookingRow {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_email: string;
  check_in_date: string;
  check_out_date: string;
  number_of_nights: number;
  special_requests?: string;
  reminder_sent?: boolean;
  chalets?: { name: string }[] | { name: string } | null;
}

class BookingRemindersService {
  /**
   * Extract chalet name from Supabase join result
   */
  private getChaletName(chalets: ChaletBookingRow['chalets']): string {
    if (!chalets) return 'Your Chalet';
    if (Array.isArray(chalets)) {
      return chalets[0]?.name || 'Your Chalet';
    }
    return chalets.name || 'Your Chalet';
  }

  /**
   * Send pre-arrival reminders for bookings with check-in tomorrow
   * Called by SchedulerService at 9 AM daily
   */
  async sendPreArrivalReminders(): Promise<{ sent: number; errors: number }> {
    const supabase = getSupabase();
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    
    logger.info(`Checking for bookings with check-in date: ${tomorrow}`);

    try {
      // Find all confirmed bookings with check-in tomorrow that haven't received a reminder
      const { data: bookings, error } = await supabase
        .from('chalet_bookings')
        .select(`
          id,
          booking_number,
          customer_name,
          customer_email,
          check_in_date,
          check_out_date,
          number_of_nights,
          special_requests,
          reminder_sent,
          chalets (name)
        `)
        .eq('status', 'confirmed')
        .gte('check_in_date', `${tomorrow}T00:00:00`)
        .lt('check_in_date', `${tomorrow}T23:59:59`)
        .or('reminder_sent.is.null,reminder_sent.eq.false');

      if (error) {
        logger.error('Failed to fetch bookings for reminders', { error: error.message });
        return { sent: 0, errors: 1 };
      }

      if (!bookings || bookings.length === 0) {
        logger.info('No bookings found requiring pre-arrival reminders');
        return { sent: 0, errors: 0 };
      }

      logger.info(`Found ${bookings.length} bookings to send reminders for`);

      let sent = 0;
      let errors = 0;

      for (const booking of bookings as unknown as ChaletBookingRow[]) {
        if (!booking.customer_email) {
          logger.warn(`Booking ${booking.booking_number} has no email, skipping`);
          continue;
        }

        try {
          // Send the reminder email
          const success = await emailService.sendPreArrivalReminder({
            customerEmail: booking.customer_email,
            customerName: booking.customer_name,
            bookingNumber: booking.booking_number,
            chaletName: this.getChaletName(booking.chalets),
            checkInDate: dayjs(booking.check_in_date).format('MMMM D, YYYY'),
            numberOfNights: booking.number_of_nights || 1,
            specialInstructions: booking.special_requests,
          });

          if (success) {
            // Mark as reminder sent
            await supabase
              .from('chalet_bookings')
              .update({ 
                reminder_sent: true,
                reminder_sent_at: new Date().toISOString()
              })
              .eq('id', booking.id);

            sent++;
            logger.info(`Sent pre-arrival reminder for booking ${booking.booking_number}`);
          } else {
            errors++;
            logger.warn(`Failed to send reminder for booking ${booking.booking_number}`);
          }
        } catch (err) {
          errors++;
          logger.error(`Error sending reminder for booking ${booking.booking_number}`, { error: err });
        }
      }

      logger.info(`Pre-arrival reminders complete: ${sent} sent, ${errors} errors`);
      return { sent, errors };
    } catch (error) {
      logger.error('Error in sendPreArrivalReminders', { error });
      return { sent: 0, errors: 1 };
    }
  }

  /**
   * Manually trigger reminders (for testing or admin action)
   */
  async triggerReminders(): Promise<{ sent: number; errors: number }> {
    return this.sendPreArrivalReminders();
  }

  /**
   * Send reminder for a specific booking
   */
  async sendReminderForBooking(bookingId: string): Promise<boolean> {
    const supabase = getSupabase();

    try {
      const { data: booking, error } = await supabase
        .from('chalet_bookings')
        .select(`
          id,
          booking_number,
          customer_name,
          customer_email,
          check_in_date,
          check_out_date,
          number_of_nights,
          special_requests,
          chalets (name)
        `)
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        logger.error(`Booking ${bookingId} not found`);
        return false;
      }

      const typedBooking = booking as unknown as ChaletBookingRow;
      
      if (!typedBooking.customer_email) {
        logger.error(`Booking ${bookingId} has no customer email`);
        return false;
      }

      const success = await emailService.sendPreArrivalReminder({
        customerEmail: typedBooking.customer_email,
        customerName: typedBooking.customer_name,
        bookingNumber: typedBooking.booking_number,
        chaletName: this.getChaletName(typedBooking.chalets),
        checkInDate: dayjs(typedBooking.check_in_date).format('MMMM D, YYYY'),
        numberOfNights: typedBooking.number_of_nights || 1,
        specialInstructions: typedBooking.special_requests,
      });

      if (success) {
        await supabase
          .from('chalet_bookings')
          .update({ 
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString()
          })
          .eq('id', bookingId);
      }

      return success;
    } catch (error) {
      logger.error(`Error sending reminder for booking ${bookingId}`, { error });
      return false;
    }
  }
}

// Export singleton instance
export const bookingRemindersService = new BookingRemindersService();
