/**
 * Booking Service
 * 
 * Business logic for chalet bookings with dependency injection.
 * Handles booking creation, availability checks, pricing calculations,
 * check-in/check-out, and cancellations.
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
  paymentMethod?: 'cash' | 'card' | 'whish' | 'online';
}

export interface BookingResult {
  booking: ChaletBooking;
  chalet: Chalet;
  addOns: ChaletBookingAddOn[];
}

export interface BookingServiceDeps {
  chaletRepository: ChaletRepository;
  emailService: EmailService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

export interface BookingService {
  // Booking operations
  createBooking(input: CreateBookingInput): Promise<BookingResult>;
  getBookingById(id: string): Promise<ChaletBooking | null>;
  getBookingByNumber(bookingNumber: string): Promise<ChaletBooking | null>;
  getBookings(filters: { chaletId?: string; status?: string; startDate?: string; endDate?: string }): Promise<ChaletBooking[]>;
  getBookingsByCustomer(customerId: string): Promise<ChaletBooking[]>;
  getTodayBookings(): Promise<{ checkIns: ChaletBooking[]; checkOuts: ChaletBooking[] }>;
  
  // Status operations
  checkIn(bookingId: string, staffId: string): Promise<ChaletBooking>;
  checkOut(bookingId: string, staffId: string): Promise<ChaletBooking>;
  updateStatus(bookingId: string, status: ChaletBooking['status'], userId?: string): Promise<ChaletBooking>;
  cancelBooking(bookingId: string, reason: string, userId?: string): Promise<ChaletBooking>;
  
  // Availability
  getAvailability(chaletId: string, startDate: string, endDate: string): Promise<{ blockedDates: string[] }>;
  checkAvailability(chaletId: string, checkIn: string, checkOut: string): Promise<boolean>;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createBookingService(deps: BookingServiceDeps): BookingService {
  const { chaletRepository, emailService, logger, activityLogger, socketEmitter } = deps;

  function generateBookingNumber(): string {
    const date = dayjs().format('YYMMDD');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `C-${date}-${random}`;
  }

  async function calculatePricing(
    chalet: Chalet,
    checkIn: dayjs.Dayjs,
    checkOut: dayjs.Dayjs,
    selectedAddOns: Array<{ addOnId: string; quantity: number }> = []
  ): Promise<{
    baseAmount: number;
    addOnsAmount: number;
    depositAmount: number;
    totalAmount: number;
    numberOfNights: number;
    addOnItems: Array<{ add_on_id: string; quantity: number; unit_price: number; subtotal: number }>;
  }> {
    const numberOfNights = checkOut.diff(checkIn, 'day');
    
    // Get price rules for this chalet
    const priceRules = await chaletRepository.getPriceRules(chalet.id);
    
    // Calculate base amount night-by-night
    let baseAmount = 0;
    let current = checkIn;
    
    while (current.isBefore(checkOut)) {
      // Find applicable price rule for this night
      const activeRule = priceRules.find(rule => {
        if (!rule.is_active) return false;
        const start = dayjs(rule.start_date).startOf('day');
        const end = dayjs(rule.end_date).endOf('day');
        return (current.isSame(start) || current.isAfter(start)) &&
          (current.isSame(end) || current.isBefore(end));
      });

      let nightPrice: number;
      if (activeRule) {
        if (activeRule.price) {
          nightPrice = parseFloat(activeRule.price);
        } else if (activeRule.price_multiplier) {
          const base = current.day() === 5 || current.day() === 6
            ? parseFloat(chalet.weekend_price)
            : parseFloat(chalet.base_price);
          nightPrice = base * parseFloat(activeRule.price_multiplier);
        } else {
          const isWeekend = current.day() === 5 || current.day() === 6;
          nightPrice = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
        }
      } else {
        const isWeekend = current.day() === 5 || current.day() === 6;
        nightPrice = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
      }

      baseAmount += nightPrice;
      current = current.add(1, 'day');
    }

    // Calculate add-ons amount
    let addOnsAmount = 0;
    const addOnItems: Array<{ add_on_id: string; quantity: number; unit_price: number; subtotal: number }> = [];

    if (selectedAddOns.length > 0) {
      const addOnsList = await chaletRepository.getAddOnsByIds(
        selectedAddOns.map(a => a.addOnId)
      );
      const addOnMap = new Map(addOnsList.map(a => [a.id, a]));

      for (const item of selectedAddOns) {
        const addOn = addOnMap.get(item.addOnId);
        if (addOn && addOn.is_active) {
          const unitPrice = parseFloat(addOn.price);
          const multiplier = addOn.price_type === 'per_night' ? numberOfNights : 1;
          const subtotal = unitPrice * item.quantity * multiplier;
          addOnsAmount += subtotal;
          addOnItems.push({
            add_on_id: item.addOnId,
            quantity: item.quantity,
            unit_price: unitPrice,
            subtotal,
          });
        }
      }
    }

    // Get deposit settings
    const settings = await chaletRepository.getChaletSettings();
    let depositAmount: number;
    
    if (settings.deposit_type === 'fixed') {
      depositAmount = settings.deposit_fixed || 100;
    } else {
      depositAmount = (baseAmount * (settings.deposit_percentage || 30)) / 100;
    }

    const totalAmount = baseAmount + addOnsAmount;

    return { baseAmount, addOnsAmount, depositAmount, totalAmount, numberOfNights, addOnItems };
  }

  return {
    async createBooking(input) {
      const {
        chaletId,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        addOns: selectedAddOns = [],
        specialRequests,
        paymentMethod,
      } = input;

      // Get chalet
      const chalet = await chaletRepository.getChaletById(chaletId);
      if (!chalet) {
        throw new BookingServiceError('Chalet not found', 'CHALET_NOT_FOUND', 404);
      }

      if (!chalet.is_active) {
        throw new BookingServiceError('Chalet is not available', 'CHALET_UNAVAILABLE', 400);
      }

      const checkIn = dayjs(checkInDate);
      const checkOut = dayjs(checkOutDate);
      const numberOfNights = checkOut.diff(checkIn, 'day');

      if (numberOfNights < 1) {
        throw new BookingServiceError('Invalid date range', 'INVALID_DATE_RANGE', 400);
      }

      // Check capacity
      if (numberOfGuests > chalet.capacity) {
        throw new BookingServiceError(
          `Chalet capacity is ${chalet.capacity} guests`,
          'CAPACITY_EXCEEDED',
          400
        );
      }

      // Check availability
      const isAvailable = await this.checkAvailability(chaletId, checkInDate, checkOutDate);
      if (!isAvailable) {
        throw new BookingServiceError(
          'Chalet is already booked for the selected dates',
          'NOT_AVAILABLE',
          400
        );
      }

      // Calculate pricing
      const pricing = await calculatePricing(chalet, checkIn, checkOut, selectedAddOns);

      // Create booking
      const booking = await chaletRepository.createBooking({
        booking_number: generateBookingNumber(),
        chalet_id: chaletId,
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        check_in_date: checkIn.toISOString(),
        check_out_date: checkOut.toISOString(),
        number_of_guests: numberOfGuests,
        number_of_nights: pricing.numberOfNights,
        base_amount: pricing.baseAmount.toFixed(2),
        add_ons_amount: pricing.addOnsAmount.toFixed(2),
        deposit_amount: pricing.depositAmount.toFixed(2),
        total_amount: pricing.totalAmount.toFixed(2),
        status: 'pending',
        payment_status: 'pending',
        payment_method: paymentMethod,
        special_requests: specialRequests,
      });

      // Create booking add-ons
      let bookingAddOns: ChaletBookingAddOn[] = [];
      if (pricing.addOnItems.length > 0) {
        bookingAddOns = await chaletRepository.createBookingAddOns(
          pricing.addOnItems.map(item => ({
            booking_id: booking.id,
            add_on_id: item.add_on_id,
            quantity: item.quantity,
            unit_price: item.unit_price.toFixed(2),
            subtotal: item.subtotal.toFixed(2),
          }))
        );
      }

      // Send confirmation email
      if (customerEmail) {
        emailService.sendBookingConfirmation({
          customerEmail,
          customerName,
          bookingNumber: booking.booking_number,
          chaletName: chalet.name,
          checkInDate: checkIn.format('MMMM D, YYYY'),
          checkOutDate: checkOut.format('MMMM D, YYYY'),
          numberOfGuests,
          numberOfNights: pricing.numberOfNights,
          totalAmount: pricing.totalAmount,
          paymentStatus: booking.payment_status,
        }).catch(err => logger.warn('Failed to send booking confirmation email', err));
      }

      // Log activity
      await activityLogger.log('CREATE_BOOKING', {
        bookingNumber: booking.booking_number,
        chaletId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        total: booking.total_amount,
      }, customerId);

      // Emit socket event
      socketEmitter.emitToUnit('chalets', 'booking:new', {
        id: booking.id,
        bookingNumber: booking.booking_number,
        chaletName: chalet.name,
        customerName,
        checkInDate,
        checkOutDate,
        status: booking.status,
        totalAmount: booking.total_amount,
      });

      return { booking, chalet, addOns: bookingAddOns };
    },

    async getBookingById(id) {
      return chaletRepository.getBookingById(id);
    },

    async getBookingByNumber(bookingNumber) {
      return chaletRepository.getBookingByNumber(bookingNumber);
    },

    async getBookings(filters) {
      return chaletRepository.getBookings(filters);
    },

    async getBookingsByCustomer(customerId) {
      return chaletRepository.getBookingsByCustomer(customerId);
    },

    async getTodayBookings() {
      return chaletRepository.getTodayBookings();
    },

    async checkIn(bookingId, staffId) {
      const booking = await chaletRepository.getBookingById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        throw new BookingServiceError(
          `Cannot check in a booking with status: ${booking.status}`,
          'INVALID_STATUS',
          400
        );
      }

      const updated = await chaletRepository.updateBooking(bookingId, {
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: staffId,
      });

      await activityLogger.log('CHECK_IN', {
        bookingId,
        bookingNumber: booking.booking_number,
      }, staffId);

      socketEmitter.emitToUnit('chalets', 'booking:checkedIn', {
        id: bookingId,
        bookingNumber: booking.booking_number,
      });

      return updated;
    },

    async checkOut(bookingId, staffId) {
      const booking = await chaletRepository.getBookingById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status !== 'checked_in') {
        throw new BookingServiceError(
          `Cannot check out a booking with status: ${booking.status}`,
          'INVALID_STATUS',
          400
        );
      }

      const updated = await chaletRepository.updateBooking(bookingId, {
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        checked_out_by: staffId,
      });

      await activityLogger.log('CHECK_OUT', {
        bookingId,
        bookingNumber: booking.booking_number,
      }, staffId);

      socketEmitter.emitToUnit('chalets', 'booking:checkedOut', {
        id: bookingId,
        bookingNumber: booking.booking_number,
      });

      return updated;
    },

    async updateStatus(bookingId, status, userId) {
      const booking = await chaletRepository.getBookingById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      const updated = await chaletRepository.updateBooking(bookingId, { status });

      await activityLogger.log('UPDATE_BOOKING_STATUS', {
        bookingId,
        from: booking.status,
        to: status,
      }, userId);

      socketEmitter.emitToUnit('chalets', 'booking:statusChanged', {
        id: bookingId,
        status,
        previousStatus: booking.status,
      });

      return updated;
    },

    async cancelBooking(bookingId, reason, userId) {
      const booking = await chaletRepository.getBookingById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
      }

      if (booking.status === 'cancelled') {
        throw new BookingServiceError('Booking is already cancelled', 'ALREADY_CANCELLED', 400);
      }

      if (booking.status === 'checked_out') {
        throw new BookingServiceError('Cannot cancel a completed booking', 'CANNOT_CANCEL', 400);
      }

      const updated = await chaletRepository.updateBooking(bookingId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      });

      await activityLogger.log('CANCEL_BOOKING', {
        bookingId,
        bookingNumber: booking.booking_number,
        reason,
      }, userId);

      socketEmitter.emitToUnit('chalets', 'booking:cancelled', {
        id: bookingId,
        bookingNumber: booking.booking_number,
        reason,
      });

      return updated;
    },

    async getAvailability(chaletId, startDate, endDate) {
      const bookings = await chaletRepository.getBookingsForChalet(chaletId, startDate, endDate);
      
      const blockedDates: string[] = [];
      
      for (const booking of bookings) {
        if (['cancelled', 'no_show'].includes(booking.status)) continue;
        
        let current = dayjs(booking.check_in_date);
        const checkout = dayjs(booking.check_out_date);
        
        while (current.isBefore(checkout)) {
          blockedDates.push(current.format('YYYY-MM-DD'));
          current = current.add(1, 'day');
        }
      }
      
      return { blockedDates };
    },

    async checkAvailability(chaletId, checkInDate, checkOutDate) {
      const bookings = await chaletRepository.getBookingsForChalet(chaletId);
      const checkIn = dayjs(checkInDate);
      const checkOut = dayjs(checkOutDate);
      
      const activeBookings = bookings.filter(
        b => !['cancelled', 'no_show'].includes(b.status)
      );
      
      const hasOverlap = activeBookings.some(booking => {
        const bIn = dayjs(booking.check_in_date);
        const bOut = dayjs(booking.check_out_date);
        return checkIn.isBefore(bOut) && checkOut.isAfter(bIn);
      });
      
      return !hasOverlap;
    },
  };
}
