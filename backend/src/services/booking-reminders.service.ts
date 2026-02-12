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
      // Updated to use accommodation_bookings and unit_id/accommodation_units
      const { data: bookings, error } = await supabase
        .from('accommodation_bookings') // RENAMED
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
          accommodation_units (name)  -- RENAMED relation
        `)
        .eq('status', 'confirmed')
        .gte('check_in_date', `${tomorrow}T00:00:00`)
        .lt('check_in_date', `${tomorrow}T23:59:59`)
        .or('reminder_sent.is.null,reminder_sent.eq.false');

      if (error) {
        logger.error('Failed to fetch bookings', error);
        return { sent: 0, errors: 1 };
      }

      // ... Iteration and sending logic ...
      // Uses accommodation_units[0].name

      return { sent: bookings?.length || 0, errors: 0 };
    } catch (error) {
      return { sent: 0, errors: 1 };
    }
  }
}

export const bookingRemindersService = new BookingRemindersService();
