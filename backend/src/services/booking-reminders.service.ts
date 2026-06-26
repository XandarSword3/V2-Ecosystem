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
      // Query booking transactions with metadata for reminder emails
      const { data: bookings, error } = await supabase
        .from('transactions')
        .select('id, metadata, status')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('status', 'confirmed')
        .filter('metadata->>check_in_date', 'gte', `${tomorrow}T00:00:00`)
        .filter('metadata->>check_in_date', 'lt', `${tomorrow}T23:59:59`)
        .or('metadata->>reminder_sent.is.null,metadata->>reminder_sent.eq.false');

      if (error) {
        logger.error('Failed to fetch bookings for reminders', error);
        return { sent: 0, errors: 1 };
      }

      // Send reminder emails for each booking
      let sent = 0;
      let errors = 0;

      for (const booking of (bookings || []) as any[]) {
        try {
          const meta = booking.metadata || {};
          await emailService.sendPreArrivalReminder({
            to: meta.customer_email,
            guestName: meta.customer_name,
            bookingNumber: meta.booking_number || booking.id,
            chaletName: meta.chalet_name || 'Your Accommodation',
            checkInDate: meta.check_in_date,
            checkOutDate: meta.check_out_date,
            numberOfNights: meta.number_of_nights,
            specialInstructions: meta.special_requests || '',
          } as any);

          // Mark reminder as sent in metadata
          await supabase
            .from('transactions')
            .update({ metadata: { ...meta, reminder_sent: true } })
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
