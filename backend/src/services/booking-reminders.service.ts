// File: backend/src/services/booking-reminders.service.ts
import { getSupabase } from '../database/connection.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

class BookingRemindersService {

  async sendPreArrivalReminders(): Promise<{ sent: number; errors: number }> {
    const supabase = getSupabase();
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

    try {
      // Query chalet bookings with chalet name for reminder emails
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
        logger.error('Failed to fetch bookings for reminders', error);
        return { sent: 0, errors: 1 };
      }

      // Send reminder emails for each booking
      let sent = 0;
      let errors = 0;

      for (const booking of (bookings || []) as any[]) {
        try {
          const chaletName = (booking as any).chalets?.name || 'Your Chalet';
          await emailService.sendPreArrivalReminder({
            to: booking.customer_email,
            guestName: booking.customer_name,
            bookingNumber: booking.booking_number,
            chaletName,
            checkInDate: booking.check_in_date,
            checkOutDate: booking.check_out_date,
            numberOfNights: booking.number_of_nights,
            specialInstructions: booking.special_requests || '',
          } as any);

          // Mark reminder as sent
          await supabase
            .from('chalet_bookings')
            .update({ reminder_sent: true })
            .eq('id', booking.id);

          sent++;
        } catch (emailError) {
          logger.error(`Failed to send reminder for booking ${booking.id}`, emailError);
          errors++;
        }
      }

      logger.info(`Booking reminders: ${sent} sent, ${errors} errors`);
      return { sent, errors };
    } catch (error) {
      return { sent: 0, errors: 1 };
    }
  }
}

export const bookingRemindersService = new BookingRemindersService();
