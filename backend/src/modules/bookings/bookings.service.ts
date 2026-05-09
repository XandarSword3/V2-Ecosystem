/**
 * Bookings Service
 * 
 * Business logic for chalet bookings using Supabase.
 * Handles booking creation, availability checks, pricing calculations,
 * check-in/check-out, and cancellations.
 */

import dayjs from 'dayjs';
import { getSupabase } from '../../database/connection';
import { logger } from '../../utils/logger';
import { getEngineService } from '../../engines/engine-service.js';
import type { PricingLineItem } from '../../engines/types.js';

// =============================================
// ERROR TYPES
// =============================================

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

// =============================================
// TYPES
// =============================================

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'whish' | 'online';

export interface Booking {
  id: string;
  booking_number: string;
  chalet_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  number_of_nights: number;
  base_amount: string;
  add_ons_amount: string;
  deposit_amount: string;
  total_amount: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  special_requests?: string;
  checked_in_at?: string;
  checked_in_by?: string;
  checked_out_at?: string;
  checked_out_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  amenities: string[];
  images: string[];
  base_price: string;
  weekend_price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChaletAddOn {
  id: string;
  name: string;
  price: string;
  price_type: 'one_time' | 'per_night';
  is_active: boolean;
}

export interface ChaletPriceRule {
  id: string;
  chalet_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price?: string;
  price_multiplier?: string;
  is_active: boolean;
}

export interface ChaletSettings {
  id: string;
  deposit_type: 'percentage' | 'fixed';
  deposit_percentage?: number;
  deposit_fixed?: number;
  min_nights: number;
  max_guests: number;
  check_in_time: string;
  check_out_time: string;
}

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
  paymentMethod?: PaymentMethod;
}

export interface BookingFilters {
  chaletId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface PricingResult {
  baseAmount: number;
  addOnsAmount: number;
  depositAmount: number;
  totalAmount: number;
  numberOfNights: number;
  addOnItems: Array<{
    add_on_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export interface TodayBookings {
  checkIns: Booking[];
  checkOuts: Booking[];
}

export interface AvailabilityResult {
  blockedDates: string[];
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function generateBookingNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `C-${date}-${random}`;
}

// =============================================
// PRICING
// =============================================

/**
 * Calculate booking price including base price, add-ons, and deposit
 */
export async function calculateBookingPrice(
  chaletId: string,
  checkInDate: string,
  checkOutDate: string,
  addOns: Array<{ addOnId: string; quantity: number }> = []
): Promise<PricingResult> {
  const supabase = getSupabase();

  // Get chalet
  const { data: chalet, error: chaletError } = await supabase
    .from('chalets')
    .select('*')
    .eq('id', chaletId)
    .single();

  if (chaletError || !chalet) {
    throw new BookingServiceError('Chalet not found', 'CHALET_NOT_FOUND', 404);
  }

  const checkIn = dayjs(checkInDate);
  const checkOut = dayjs(checkOutDate);
  const numberOfNights = checkOut.diff(checkIn, 'day');

  if (numberOfNights < 1) {
    throw new BookingServiceError('Invalid date range', 'INVALID_DATE_RANGE', 400);
  }

  // Get price rules
  const { data: priceRules } = await supabase
    .from('chalet_price_rules')
    .select('*')
    .eq('chalet_id', chaletId)
    .eq('is_active', true);

  // Calculate base amount night-by-night
  let baseAmount = 0;
  let current = checkIn;

  while (current.isBefore(checkOut)) {
    const activeRule = (priceRules || []).find((rule: ChaletPriceRule) => {
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

  if (addOns.length > 0) {
    const addOnIds = addOns.map(a => a.addOnId);
    const { data: addOnsList } = await supabase
      .from('chalet_add_ons')
      .select('*')
      .in('id', addOnIds)
      .eq('is_active', true);

    const addOnMap = new Map((addOnsList || []).map((a: ChaletAddOn) => [a.id, a]));

    for (const item of addOns) {
      const addOn = addOnMap.get(item.addOnId);
      if (addOn) {
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
  const { data: settings } = await supabase
    .from('chalet_settings')
    .select('*')
    .single();

  let depositAmount: number;
  if (settings?.deposit_type === 'fixed') {
    depositAmount = settings.deposit_fixed || 100;
  } else {
    depositAmount = (baseAmount * (settings?.deposit_percentage || 30)) / 100;
  }

  const totalAmount = baseAmount + addOnsAmount;

  return {
    baseAmount,
    addOnsAmount,
    depositAmount,
    totalAmount,
    numberOfNights,
    addOnItems,
  };
}

// =============================================
// CREATE BOOKING
// =============================================

/**
 * Create a new booking
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const supabase = getSupabase();
  const {
    chaletId,
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    addOns = [],
    specialRequests,
    paymentMethod,
  } = input;

  // Get chalet
  const { data: chalet, error: chaletError } = await supabase
    .from('chalets')
    .select('*')
    .eq('id', chaletId)
    .single();

  if (chaletError || !chalet) {
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
  const isAvailable = await checkAvailability(chaletId, checkInDate, checkOutDate);
  if (!isAvailable) {
    throw new BookingServiceError(
      'Chalet is already booked for the selected dates',
      'NOT_AVAILABLE',
      400
    );
  }

  // Calculate pricing
  const pricing = await calculateBookingPrice(chaletId, checkInDate, checkOutDate, addOns);

  // Create transaction
  const { data: booking, error: bookingError } = await supabase
    .from('transactions')
    .insert({
      booking_number: generateBookingNumber(),
      module_id: chalet.module_id, // Ensure module_id is passed
      engine_type: 'time_exclusive_reservation',
      property_id: chalet.property_id,
      customer_id: customerId,
      amount: pricing.totalAmount,
      tax_amount: 0, // Should be calculated
      service_charge: 0,
      discount_amount: 0,
      net_amount: pricing.totalAmount,
      currency: 'USD',
      status: 'pending',
      payment_status: 'pending',
      payment_method: paymentMethod,
      staff_id: null,
      metadata: {
        chalet_id: chaletId,
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
        special_requests: specialRequests,
        add_ons: pricing.addOnItems
      }
    })
    .select()
    .single();

  if (bookingError || !booking) {
    logger.error('Failed to create booking', { error: bookingError });
    throw new BookingServiceError('Failed to create booking', 'CREATE_FAILED', 500);
  }

  // Create booking add-ons
  if (pricing.addOnItems.length > 0) {
    await supabase.from('chalet_booking_add_ons').insert(
      pricing.addOnItems.map(item => ({
        booking_id: booking.id,
        add_on_id: item.add_on_id,
        quantity: item.quantity,
        unit_price: item.unit_price.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
      }))
    );
  }

  logger.info('Booking created', {
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
  });

  return booking as Booking;
}

// =============================================
// GET BOOKINGS
// =============================================

/**
 * Get booking by ID
 */
export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get booking', { id, error });
    throw new BookingServiceError('Failed to get booking', 'GET_FAILED', 500);
  }

  return data as Booking | null;
}

/**
 * Get booking by booking number
 */
export async function getBookingByNumber(bookingNumber: string): Promise<Booking | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('booking_number', bookingNumber)
    .maybeSingle();

  if (error) {
    logger.error('Failed to get booking by number', { bookingNumber, error });
    throw new BookingServiceError('Failed to get booking', 'GET_FAILED', 500);
  }

  return data as Booking | null;
}

/**
 * Get bookings with optional filters
 */
export async function getBookings(filters: BookingFilters): Promise<Booking[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('engine_type', 'time_exclusive_reservation')
    .order('created_at', { ascending: false });

  if (filters.chaletId) {
    query = query.filter('metadata->>chalet_id', 'eq', filters.chaletId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.startDate) {
    query = query.filter('metadata->>check_in_date', 'gte', filters.startDate);
  }

  if (filters.endDate) {
    query = query.filter('metadata->>check_in_date', 'lte', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to get bookings', { filters, error });
    throw new BookingServiceError('Failed to get bookings', 'GET_FAILED', 500);
  }

  return (data || []) as Booking[];
}

/**
 * Get bookings for a specific customer
 */
export async function getBookingsByCustomer(customerId: string): Promise<Booking[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to get customer bookings', { customerId, error });
    throw new BookingServiceError('Failed to get bookings', 'GET_FAILED', 500);
  }

  return (data || []) as Booking[];
}

/**
 * Get today's check-ins and check-outs
 */
export async function getTodayBookings(): Promise<TodayBookings> {
  const supabase = getSupabase();
  const today = dayjs().format('YYYY-MM-DD');

  const [checkInsResult, checkOutsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', 'time_exclusive_reservation')
      .filter('metadata->>check_in_date', 'gte', `${today}T00:00:00Z`)
      .filter('metadata->>check_in_date', 'lte', `${today}T23:59:59Z`)
      .in('status', ['confirmed', 'pending']),
    supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', 'time_exclusive_reservation')
      .filter('metadata->>check_out_date', 'gte', `${today}T00:00:00Z`)
      .filter('metadata->>check_out_date', 'lte', `${today}T23:59:59Z`)
      .eq('status', 'checked_in'),
  ]);

  return {
    checkIns: (checkInsResult.data || []) as Booking[],
    checkOuts: (checkOutsResult.data || []) as Booking[],
  };
}

// =============================================
// UPDATE BOOKING
// =============================================

/**
 * Update booking details
 */
export async function updateBooking(
  bookingId: string,
  updates: Partial<Booking>
): Promise<Booking> {
  const supabase = getSupabase();

  // Check if booking exists
  const existing = await getBookingById(bookingId);
  if (!existing) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to update booking', { bookingId, error });
    throw new BookingServiceError('Failed to update booking', 'UPDATE_FAILED', 500);
  }

  logger.info('Booking updated', { bookingId, updates });

  return data as Booking;
}

// =============================================
// CANCEL BOOKING
// =============================================

/**
 * Cancel a booking
 */
export async function cancelBooking(
  bookingId: string,
  reason: string,
  userId?: string
): Promise<Booking> {
  const supabase = getSupabase();

  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  // === ENGINE-POWERED STATE TRANSITION (Engine B: time_exclusive_reservation) ===
  const engineService = getEngineService();
  const actor = userId ? 'staff' : 'customer'; // Could be refined with actual role lookup
  const transitionResult = await engineService.transitionState(
    'multi_day_booking',
    booking.status,
    'cancel',
    actor
  );

  if (!transitionResult.allowed) {
    throw new BookingServiceError(
      transitionResult.error || `Cannot cancel booking with status: ${booking.status}`,
      'CANNOT_CANCEL',
      400
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: transitionResult.targetState,
      metadata: {
        ...(booking.metadata as Record<string, any> || {}),
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to cancel booking', { bookingId, error });
    throw new BookingServiceError('Failed to cancel booking', 'CANCEL_FAILED', 500);
  }

  logger.info('Booking cancelled', { bookingId, reason, userId });

  return data as Booking;
}

// =============================================
// CHECK-IN / CHECK-OUT
// =============================================

/**
 * Check in a booking
 */
export async function checkIn(bookingId: string, staffId: string): Promise<Booking> {
  const supabase = getSupabase();

  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  // === ENGINE-POWERED STATE TRANSITION (Engine B: time_exclusive_reservation) ===
  const engineService = getEngineService();
  const transitionResult = await engineService.transitionState(
    'multi_day_booking',
    booking.status,
    'check_in',
    'staff'
  );

  if (!transitionResult.allowed) {
    throw new BookingServiceError(
      transitionResult.error || `Cannot check in a booking with status: ${booking.status}`,
      'INVALID_STATUS',
      400
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: transitionResult.targetState,
      metadata: {
        ...(booking.metadata as Record<string, any> || {}),
        checked_in_at: new Date().toISOString(),
        checked_in_by: staffId
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to check in', { bookingId, error });
    throw new BookingServiceError('Failed to check in', 'CHECKIN_FAILED', 500);
  }

  logger.info('Booking checked in', { bookingId, staffId });

  return data as Booking;
}

/**
 * Check out a booking
 */
export async function checkOut(bookingId: string, staffId: string): Promise<Booking> {
  const supabase = getSupabase();

  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  // === ENGINE-POWERED STATE TRANSITION (Engine B: time_exclusive_reservation) ===
  const engineService = getEngineService();
  const transitionResult = await engineService.transitionState(
    'multi_day_booking',
    booking.status,
    'check_out',
    'staff'
  );

  if (!transitionResult.allowed) {
    throw new BookingServiceError(
      transitionResult.error || `Cannot check out a booking with status: ${booking.status}`,
      'INVALID_STATUS',
      400
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: transitionResult.targetState,
      metadata: {
        ...(booking.metadata as Record<string, any> || {}),
        checked_out_at: new Date().toISOString(),
        checked_out_by: staffId
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to check out', { bookingId, error });
    throw new BookingServiceError('Failed to check out', 'CHECKOUT_FAILED', 500);
  }

  logger.info('Booking checked out', { bookingId, staffId });

  return data as Booking;
}

// =============================================
// AVAILABILITY
// =============================================

/**
 * Check if dates are available for a chalet
 */
export async function checkAvailability(
  chaletId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<boolean> {
  const supabase = getSupabase();

  const { data: bookings, error } = await supabase
    .from('transactions')
    .select('id, metadata, status')
    .eq('engine_type', 'time_exclusive_reservation')
    .filter('metadata->>chalet_id', 'eq', chaletId)
    .not('status', 'in', '("cancelled","no_show")');

  if (error) {
    logger.error('Failed to check availability', { chaletId, error });
    throw new BookingServiceError('Failed to check availability', 'AVAILABILITY_FAILED', 500);
  }

  const checkIn = dayjs(checkInDate);
  const checkOut = dayjs(checkOutDate);

  const hasOverlap = (bookings || []).some((booking: any) => {
    const bIn = dayjs(booking.metadata?.check_in_date);
    const bOut = dayjs(booking.metadata?.check_out_date);
    return checkIn.isBefore(bOut) && checkOut.isAfter(bIn);
  });

  return !hasOverlap;
}

/**
 * Get availability (blocked dates) for a chalet in a date range
 */
export async function getAvailability(
  chaletId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityResult> {
  const supabase = getSupabase();

  const { data: bookings, error } = await supabase
    .from('transactions')
    .select('metadata, status')
    .eq('engine_type', 'time_exclusive_reservation')
    .filter('metadata->>chalet_id', 'eq', chaletId)
    .filter('metadata->>check_out_date', 'gte', startDate)
    .filter('metadata->>check_in_date', 'lte', endDate)
    .not('status', 'in', '("cancelled","no_show")');

  if (error) {
    logger.error('Failed to get availability', { chaletId, error });
    throw new BookingServiceError('Failed to get availability', 'AVAILABILITY_FAILED', 500);
  }

  const blockedDates: string[] = [];

  for (const booking of bookings || []) {
    if (['cancelled', 'no_show'].includes(booking.status)) continue;

    let current = dayjs(booking.metadata?.check_in_date);
    const checkout = dayjs(booking.metadata?.check_out_date);

    while (current.isBefore(checkout)) {
      blockedDates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
  }

  return { blockedDates };
}
