/**
 * Booking Service
 *
 * Business logic for chalet booking operations with dependency injection.
 * Handles booking creation, check-in/check-out, cancellations, and availability.
 */

import dayjs from 'dayjs';
import type {
  ChaletRepository,
  ChaletBooking,
  ChaletBookingAddOn,
  Chalet,
  ChaletAddOn,
  EmailService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'BookingServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface CreateBookingInput {
  chaletId: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  addOns?: Array<{ addOnId: string; quantity: number }>;
  specialRequests?: string;
  paymentMethod?: string;
}

export interface BookingResult {
  booking: ChaletBooking;
  chalet: Chalet;
}

export interface BookingServiceDeps {
  chaletRepository: ChaletRepository;
  emailService: EmailService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface BookingService {
  createBooking(input: CreateBookingInput): Promise<BookingResult>;
  getBookingById(id: string): Promise<ChaletBooking | null>;
  getBookingByNumber(bookingNumber: string): Promise<ChaletBooking | null>;
  getBookingsByCustomer(customerId: string): Promise<ChaletBooking[]>;
  getBookings(filters: { status?: string; chaletId?: string }): Promise<ChaletBooking[]>;
  getTodayBookings(): Promise<{ checkIns: ChaletBooking[]; checkOuts: ChaletBooking[] }>;
  updateStatus(id: string, status: string, userId?: string): Promise<ChaletBooking>;
  checkIn(id: string, staffId: string): Promise<ChaletBooking>;
  checkOut(id: string, staffId: string): Promise<ChaletBooking>;
  cancelBooking(id: string, reason: string, userId?: string): Promise<ChaletBooking>;
  checkAvailability(chaletId: string, checkIn: string, checkOut: string): Promise<boolean>;
  getAvailability(chaletId: string, startDate: string, endDate: string): Promise<{ blockedDates: string[] }>;
}

function generateBookingNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `C-${dateStr}-${random}`;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createBookingService(deps: BookingServiceDeps): BookingService {
  const { chaletRepository, emailService, logger, activityLogger, socketEmitter, config } = deps;

  // Helper to check date overlap
  function datesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  // Calculate nightly price for a specific date
  function getNightlyPrice(
    chalet: Chalet,
    date: dayjs.Dayjs,
  ): number {
    const dayOfWeek = date.day();
    // Friday (5) and Saturday (6) are weekend days
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    return parseFloat(isWeekend ? chalet.weekend_price : chalet.base_price);
  }

  return {
    async createBooking(input: CreateBookingInput): Promise<BookingResult> {
      // Validate chalet exists
      const chalet = await chaletRepository.getChaletById(input.chaletId);
      if (!chalet) {
        throw new BookingServiceError('Chalet not found', 'CHALET_NOT_FOUND', 404);
      }

      if (!chalet.is_active) {
        throw new BookingServiceError('Chalet is not available', 'CHALET_INACTIVE');
      }

      // Validate dates
      const checkIn = dayjs(input.checkInDate);
      const checkOut = dayjs(input.checkOutDate);
      const numberOfNights = checkOut.diff(checkIn, 'day');

      if (numberOfNights <= 0) {
        throw new BookingServiceError('Invalid date range', 'INVALID_DATE_RANGE');
      }

      // Validate capacity
      if (input.numberOfGuests > chalet.capacity) {
        throw new BookingServiceError(
          `Chalet capacity is ${chalet.capacity} guests`,
          'CAPACITY_EXCEEDED'
        );
      }

      // Check availability (no overlapping bookings)
      const existingBookings = await chaletRepository.getBookingsForChalet(
        input.chaletId,
        input.checkInDate,
        input.checkOutDate
      );
      if (existingBookings.length > 0) {
        throw new BookingServiceError(
          'Chalet is already booked for the selected dates',
          'DATES_UNAVAILABLE'
        );
      }

      // Calculate base amount (sum of nightly prices)
      let baseAmount = 0;
      for (let i = 0; i < numberOfNights; i++) {
        const nightDate = checkIn.add(i, 'day');
        baseAmount += getNightlyPrice(chalet, nightDate);
      }

      // Calculate add-ons
      let addOnsAmount = 0;
      const addOnDetails: Array<{ addOnId: string; quantity: number; unitPrice: string; subtotal: string }> = [];

      if (input.addOns && input.addOns.length > 0) {
        const addOnIds = input.addOns.map(a => a.addOnId);
        const addOns = await chaletRepository.getAddOnsByIds(addOnIds);
        const addOnMap = new Map<string, ChaletAddOn>();
        for (const ao of addOns) {
          addOnMap.set(ao.id, ao);
        }

        for (const addOnInput of input.addOns) {
          const addOn = addOnMap.get(addOnInput.addOnId);
          if (!addOn) continue;

          const unitPrice = parseFloat(addOn.price);
          let subtotal: number;

          if (addOn.price_type === 'per_night') {
            subtotal = unitPrice * addOnInput.quantity * numberOfNights;
          } else {
            subtotal = unitPrice * addOnInput.quantity;
          }

          addOnsAmount += subtotal;
          addOnDetails.push({
            addOnId: addOnInput.addOnId,
            quantity: addOnInput.quantity,
            unitPrice: addOn.price,
            subtotal: subtotal.toFixed(2),
          });
        }
      }

      const totalAmount = baseAmount + addOnsAmount;

      // Calculate deposit
      const settings = await chaletRepository.getChaletSettings();
      let depositAmount: number;
      if (settings.deposit_type === 'fixed' && settings.deposit_fixed) {
        depositAmount = settings.deposit_fixed;
      } else {
        depositAmount = Math.round(totalAmount * (settings.deposit_percentage / 100) * 100) / 100;
      }

      const bookingNumber = generateBookingNumber();

      // Create the booking
      const booking = await chaletRepository.createBooking({
        booking_number: bookingNumber,
        chalet_id: input.chaletId,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        number_of_guests: input.numberOfGuests,
        number_of_nights: numberOfNights,
        base_amount: baseAmount.toFixed(2),
        add_ons_amount: addOnsAmount.toFixed(2),
        deposit_amount: depositAmount.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        status: 'pending',
        payment_status: 'pending',
        payment_method: input.paymentMethod as ChaletBooking['payment_method'],
        special_requests: input.specialRequests,
      } as Omit<ChaletBooking, 'id' | 'created_at' | 'updated_at'>);

      // Create booking add-ons
      if (addOnDetails.length > 0) {
        await chaletRepository.createBookingAddOns(
          addOnDetails.map(d => ({
            booking_id: booking.id,
            add_on_id: d.addOnId,
            quantity: d.quantity,
            unit_price: d.unitPrice,
            subtotal: d.subtotal,
          })) as Omit<ChaletBookingAddOn, 'id' | 'created_at'>[]
        );
      }

      // Emit socket event
      socketEmitter.emitToUnit('chalets', 'booking:new', {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        customerName: input.customerName,
        chaletName: chalet.name,
        checkIn: input.checkInDate,
        checkOut: input.checkOutDate,
      });

      // Log activity
      await activityLogger.log(
        'CREATE_BOOKING',
        {
          bookingId: booking.id,
          bookingNumber: booking.booking_number,
          chaletId: input.chaletId,
          totalAmount,
        },
        input.customerId
      );

      logger.info('Booking created', { bookingId: booking.id, bookingNumber: booking.booking_number });

      return { booking, chalet };
    },

    async getBookingById(id: string): Promise<ChaletBooking | null> {
      return chaletRepository.getBookingById(id);
    },

    async getBookingByNumber(bookingNumber: string): Promise<ChaletBooking | null> {
      return chaletRepository.getBookingByNumber(bookingNumber);
    },

    async getBookingsByCustomer(customerId: string): Promise<ChaletBooking[]> {
      return chaletRepository.getBookingsByCustomer(customerId);
    },

    async getBookings(filters: { status?: string; chaletId?: string }): Promise<ChaletBooking[]> {
      return chaletRepository.getBookings(filters);
    },

    async getTodayBookings(): Promise<{ checkIns: ChaletBooking[]; checkOuts: ChaletBooking[] }> {
      return chaletRepository.getTodayBookings();
    },

    async updateStatus(id: string, status: string, userId?: string): Promise<ChaletBooking> {
      const booking = await chaletRepository.getBookingById(id);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }
      return chaletRepository.updateBooking(id, { status: status as ChaletBooking['status'] });
    },

    async checkIn(id: string, staffId: string): Promise<ChaletBooking> {
      const booking = await chaletRepository.getBookingById(id);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        throw new BookingServiceError(
          `Cannot check in a booking with status: ${booking.status}`,
          'INVALID_CHECK_IN'
        );
      }

      const updated = await chaletRepository.updateBooking(id, {
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: staffId,
      });

      socketEmitter.emitToUnit('chalets', 'booking:checked_in', {
        bookingId: id,
        staffId,
      });

      logger.info('Guest checked in', { bookingId: id, staffId });

      return updated;
    },

    async checkOut(id: string, staffId: string): Promise<ChaletBooking> {
      const booking = await chaletRepository.getBookingById(id);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status !== 'checked_in') {
        throw new BookingServiceError(
          `Cannot check out a booking with status: ${booking.status}`,
          'INVALID_CHECK_OUT'
        );
      }

      const updated = await chaletRepository.updateBooking(id, {
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        checked_out_by: staffId,
      });

      socketEmitter.emitToUnit('chalets', 'booking:checked_out', {
        bookingId: id,
        staffId,
      });

      logger.info('Guest checked out', { bookingId: id, staffId });

      return updated;
    },

    async cancelBooking(id: string, reason: string, userId?: string): Promise<ChaletBooking> {
      const booking = await chaletRepository.getBookingById(id);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status === 'cancelled') {
        throw new BookingServiceError('Booking is already cancelled', 'ALREADY_CANCELLED');
      }

      if (booking.status === 'checked_out') {
        throw new BookingServiceError('Cannot cancel a completed booking', 'CANNOT_CANCEL');
      }

      const updated = await chaletRepository.updateBooking(id, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      });

      socketEmitter.emitToUnit('chalets', 'booking:cancelled', {
        bookingId: id,
        reason,
      });

      await activityLogger.log(
        'CANCEL_BOOKING',
        { bookingId: id, reason },
        userId
      );

      logger.info('Booking cancelled', { bookingId: id, reason });

      return updated;
    },

    async checkAvailability(chaletId: string, checkInDate: string, checkOutDate: string): Promise<boolean> {
      const existing = await chaletRepository.getBookingsForChalet(chaletId, checkInDate, checkOutDate);
      return existing.length === 0;
    },

    async getAvailability(chaletId: string, startDate: string, endDate: string): Promise<{ blockedDates: string[] }> {
      const bookings = await chaletRepository.getBookingsForChalet(chaletId, startDate, endDate);
      const blockedDates: string[] = [];

      for (const booking of bookings) {
        const start = dayjs(booking.check_in_date);
        const end = dayjs(booking.check_out_date);
        let current = start;
        while (current.isBefore(end)) {
          const dateStr = current.format('YYYY-MM-DD');
          if (!blockedDates.includes(dateStr)) {
            blockedDates.push(dateStr);
          }
          current = current.add(1, 'day');
        }
      }

      return { blockedDates };
    },
  };
}
