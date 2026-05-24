/**
 * Time-Exclusive Reservation Service
 *
 * Engine: time_exclusive_reservation
 * Handles reservation creation, availability checks, pricing calculations,
 * check-in/check-out, and cancellations for any date-range unit
 * (accommodation, courts, private event spaces, etc.).
 *
 * ALL records live in the `transactions` table.
 * ALL unit-specific data lives in the metadata JSONB field.
 * Booking creation delegates to reserve_unit_exclusive_atomic for
 * atomic double-booking prevention via pg_advisory_xact_lock.
 *
 * Dead references eliminated:
 *   chalets, chalet_price_rules, chalet_settings, chalet_booking_add_ons
 * Replaced with:
 *   accommodation_units, unit_price_rules, modules.config, transaction metadata
 */

import { randomBytes } from 'crypto';
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

/** A transaction row representing a time_exclusive_reservation booking. */
export interface Booking {
  id: string;
  booking_number: string;
  module_id: string;
  customer_id?: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  amount: string;
  net_amount?: string;
  tax_amount?: string;
  discount_amount?: string;
  metadata: {
    unit_id: string;
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
    special_requests?: string;
    add_ons?: UnitAddOnItem[];
    checked_in_at?: string;
    checked_in_by?: string;
    checked_out_at?: string;
    checked_out_by?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

/** Accommodation unit from the accommodation_units catalog table. */
export interface AccommodationUnit {
  id: string;
  module_id: string;
  property_id?: string;
  name: string;
  name_ar?: string;
  description?: string;
  capacity: number;
  base_price: string;
  weekend_price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Add-on option from the accommodation_add_ons table. */
export interface UnitAddOn {
  id: string;
  name: string;
  price: string;
  price_type: 'one_time' | 'per_night';
  is_active: boolean;
}

/** Price rule from the unit_price_rules table. */
export interface UnitPriceRule {
  id: string;
  unit_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price?: string;
  price_multiplier?: string;
  is_active: boolean;
}

/** Resolved add-on line item computed at pricing time. */
export interface UnitAddOnItem {
  add_on_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CreateBookingInput {
  unitId: string;
  moduleId: string;
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
  couponCode?: string;
  giftCardCode?: string;
  loyaltyPointsToRedeem?: number;
}

export interface BookingFilters {
  unitId?: string;
  moduleId?: string;
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
  addOnItems: UnitAddOnItem[];
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
  // randomBytes(4) gives 4,294,967,296 unique values per calendar day —
  // safe under concurrent load without a DB sequence.
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `BK-${date}-${suffix}`;
}

// =============================================
// PRICING
// =============================================

/**
 * Calculate reservation price including base price, add-ons, and deposit.
 *
 * Unit config  → accommodation_units table
 * Price rules  → unit_price_rules table
 * Deposit cfg  → parent module config JSONB
 * Add-ons      → accommodation_add_ons table (unchanged generic table)
 */
export async function calculateReservationPrice(
  unitId: string,
  moduleId: string,
  checkInDate: string,
  checkOutDate: string,
  addOns: Array<{ addOnId: string; quantity: number }> = []
): Promise<PricingResult> {
  const supabase = getSupabase();

  const { data: unit, error: unitError } = await supabase
    .from('accommodation_units')
    .select('*')
    .eq('id', unitId)
    .single();

  if (unitError || !unit) {
    throw new BookingServiceError('Unit not found', 'UNIT_NOT_FOUND', 404);
  }

  const checkIn = dayjs(checkInDate);
  const checkOut = dayjs(checkOutDate);
  const numberOfNights = checkOut.diff(checkIn, 'day');

  if (numberOfNights < 1) {
    throw new BookingServiceError('Invalid date range', 'INVALID_DATE_RANGE', 400);
  }

  const { data: priceRules } = await supabase
    .from('unit_price_rules')
    .select('*')
    .eq('unit_id', unitId)
    .eq('is_active', true);

  let baseAmount = 0;
  let current = checkIn;

  while (current.isBefore(checkOut)) {
    const activeRule = (priceRules || []).find((rule: UnitPriceRule) => {
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
          ? parseFloat(unit.weekend_price)
          : parseFloat(unit.base_price);
        nightPrice = base * parseFloat(activeRule.price_multiplier);
      } else {
        const isWeekend = current.day() === 5 || current.day() === 6;
        nightPrice = isWeekend ? parseFloat(unit.weekend_price) : parseFloat(unit.base_price);
      }
    } else {
      const isWeekend = current.day() === 5 || current.day() === 6;
      nightPrice = isWeekend ? parseFloat(unit.weekend_price) : parseFloat(unit.base_price);
    }

    baseAmount += nightPrice;
    current = current.add(1, 'day');
  }

  let addOnsAmount = 0;
  const addOnItems: UnitAddOnItem[] = [];

  if (addOns.length > 0) {
    const addOnIds = addOns.map(a => a.addOnId);
    const { data: addOnsList } = await supabase
      .from('accommodation_add_ons')
      .select('*')
      .in('id', addOnIds)
      .eq('is_active', true);

    const addOnMap = new Map((addOnsList || []).map((a: UnitAddOn) => [a.id, a]));

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

  // Deposit settings come from module config, not a module-specific settings table
  const { data: moduleRow } = await supabase
    .from('modules')
    .select('config')
    .eq('id', moduleId)
    .single();

  const moduleConfig = moduleRow?.config || {};
  let depositAmount: number;
  if (moduleConfig.deposit_type === 'fixed') {
    depositAmount = moduleConfig.deposit_fixed || 100;
  } else {
    depositAmount = (baseAmount * (moduleConfig.deposit_percentage || 30)) / 100;
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
 * Create a new reservation.
 *
 * Uses reserve_unit_exclusive_atomic RPC which:
 *   1. Acquires pg_advisory_xact_lock on (module_id, unit_id)
 *   2. Counts overlapping active transactions
 *   3. Inserts atomically if no overlap — no separate checkAvailability call needed
 *
 * Add-ons are stored inside transaction metadata; no separate add-ons table.
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const supabase = getSupabase();
  const {
    unitId,
    moduleId,
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
    couponCode,
    giftCardCode,
    loyaltyPointsToRedeem,
  } = input;

  const { data: unit, error: unitError } = await supabase
    .from('accommodation_units')
    .select('*')
    .eq('id', unitId)
    .single();

  if (unitError || !unit) {
    throw new BookingServiceError('Unit not found', 'UNIT_NOT_FOUND', 404);
  }

  if (!unit.is_active) {
    throw new BookingServiceError('Unit is not available for booking', 'UNIT_UNAVAILABLE', 400);
  }

  const checkIn = dayjs(checkInDate);
  const checkOut = dayjs(checkOutDate);
  const numberOfNights = checkOut.diff(checkIn, 'day');

  if (numberOfNights < 1) {
    throw new BookingServiceError('Invalid date range', 'INVALID_DATE_RANGE', 400);
  }

  if (numberOfGuests > unit.capacity) {
    throw new BookingServiceError(
      `Unit capacity is ${unit.capacity} guests`,
      'CAPACITY_EXCEEDED',
      400
    );
  }

  const pricing = await calculateReservationPrice(unitId, moduleId, checkInDate, checkOutDate, addOns);

  const engineService = getEngineService();
  const lineItems: PricingLineItem[] = [{
    itemId: unitId,
    name: unit.name || 'Accommodation Unit',
    quantity: numberOfNights,
    unitPrice: parseFloat(unit.base_price),
  }];

  for (const item of pricing.addOnItems) {
    lineItems.push({
      itemId: item.add_on_id,
      name: 'Add-on',
      quantity: item.quantity,
      unitPrice: item.unit_price,
    });
  }

  const pricingContext = {
    propertyId: unit.property_id,
    customerId: customerId || undefined,
    moduleId,
    couponCode,
    giftCardCode,
    loyaltyPointsToRedeem,
    staffId: undefined as string | undefined,
  };

  let enginePricing;
  try {
    enginePricing = await engineService.calculatePricing('multi_day_booking', lineItems, pricingContext);
  } catch (err: any) {
    logger.warn('[booking] Engine pricing failed, falling back to base calculation', {
      unitId,
      moduleId,
      error: err?.message,
    });
    enginePricing = null;
  }

  const finalTotal = enginePricing ? enginePricing.totalAmount : pricing.totalAmount;
  const finalDiscount = enginePricing ? enginePricing.totalDiscount : 0;
  const finalTax = enginePricing ? enginePricing.taxAmount : 0;

  // All booking data, including add-ons, lives in metadata — no separate add-ons table
  const bookingMetadata = {
    unit_id: unitId,
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
    add_ons: pricing.addOnItems,
    payment_method: paymentMethod,
  };

  // Atomic overlap check + insert. pg_advisory_xact_lock prevents races.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'reserve_unit_exclusive_atomic',
    {
      p_unit_id: unitId,
      p_module_id: moduleId,
      p_check_in_date: checkIn.format('YYYY-MM-DD'),
      p_check_out_date: checkOut.format('YYYY-MM-DD'),
      p_customer_id: customerId || null,
      p_amount: finalTotal,
      p_metadata: bookingMetadata,
    }
  );

  if (rpcError) {
    logger.error('reserve_unit_exclusive_atomic RPC error', { error: rpcError });
    throw new BookingServiceError('Failed to create booking', 'CREATE_FAILED', 500);
  }

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

  if (!result?.success) {
    const msg = result?.error_message || 'Unit is not available for the selected dates';
    throw new BookingServiceError(msg, 'NOT_AVAILABLE', 409);
  }

  const { data: booking, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', result.transaction_id)
    .single();

  if (fetchError || !booking) {
    logger.error('Failed to fetch created booking', { transactionId: result.transaction_id });
    throw new BookingServiceError('Failed to retrieve created booking', 'CREATE_FAILED', 500);
  }

  // Patch discount/tax if engine pricing ran (RPC only writes amount)
  if (enginePricing && (finalDiscount > 0 || finalTax > 0)) {
    await supabase
      .from('transactions')
      .update({
        discount_amount: finalDiscount,
        tax_amount: finalTax,
        net_amount: finalTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);
  }

  logger.info('Booking created', { bookingId: booking.id });

  return booking as Booking;
}

// =============================================
// GET BOOKINGS
// =============================================

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

export async function getBookings(filters: BookingFilters): Promise<Booking[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('engine_type', 'time_exclusive_reservation')
    .order('created_at', { ascending: false });

  if (filters.unitId) {
    query = query.filter('metadata->>unit_id', 'eq', filters.unitId);
  }

  if (filters.moduleId) {
    query = query.eq('module_id', filters.moduleId);
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
 * Fields that callers are allowed to update directly.
 * `status` and all identity fields are intentionally excluded — status
 * transitions must go through the engine state machine (cancelBooking,
 * checkIn, checkOut) so invariants are always enforced.
 */
const BOOKING_UPDATE_ALLOWLIST = [
  'payment_status',
  'payment_method',
  'amount',
  'net_amount',
  'tax_amount',
  'discount_amount',
  'metadata',
] as const satisfies (keyof Booking)[];

export async function updateBooking(
  bookingId: string,
  updates: Partial<Booking>
): Promise<Booking> {
  const supabase = getSupabase();

  const existing = await getBookingById(bookingId);
  if (!existing) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  // Build an allowlisted payload so callers cannot bypass the state machine
  // by passing e.g. { status: 'checked_out' } directly.
  const safeUpdates: Partial<Record<string, unknown>> = {};
  for (const field of BOOKING_UPDATE_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safeUpdates[field] = updates[field as keyof typeof updates];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new BookingServiceError(
      'No updateable fields provided — status changes must use the dedicated transition endpoints',
      'INVALID_UPDATE',
      400
    );
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to update booking', { bookingId, error });
    throw new BookingServiceError('Failed to update booking', 'UPDATE_FAILED', 500);
  }

  logger.info('Booking updated', { bookingId });

  return data as Booking;
}

// =============================================
// CANCEL BOOKING
// =============================================

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

  const engineService = getEngineService();
  const actor = userId ? 'staff' : 'customer';
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
        cancellation_reason: reason,
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

export async function checkIn(bookingId: string, staffId: string): Promise<Booking> {
  const supabase = getSupabase();

  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

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
        checked_in_by: staffId,
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

export async function checkOut(bookingId: string, staffId: string): Promise<Booking> {
  const supabase = getSupabase();

  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

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
        checked_out_by: staffId,
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
 * Check if a unit is available for the given date range.
 *
 * Overlap condition (half-open intervals):
 *   existing [bIn, bOut) conflicts with requested [checkIn, checkOut) when:
 *   bIn < checkOut AND bOut > checkIn
 *
 * Both filters are pushed to the DB — no rows are fetched into memory.
 * Note: createBooking uses reserve_unit_exclusive_atomic which re-checks
 * atomically under an advisory lock; this function is for pre-flight UI checks.
 */
export async function checkAvailability(
  unitId: string,
  moduleId: string,
  checkInDate: string,
  checkOutDate: string
): Promise<boolean> {
  const supabase = getSupabase();

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('module_id', moduleId)
    .filter('metadata->>unit_id', 'eq', unitId)
    .not('status', 'in', '("cancelled","no_show")')
    .filter('metadata->>check_in_date', 'lt', checkOutDate)
    .filter('metadata->>check_out_date', 'gt', checkInDate);

  if (error) {
    logger.error('Failed to check availability', { unitId, error });
    throw new BookingServiceError('Failed to check availability', 'AVAILABILITY_FAILED', 500);
  }

  return (count ?? 0) === 0;
}

/**
 * Get blocked dates for a unit within a calendar window.
 * DB-filtered to the requested range — does not load historical records.
 */
export async function getAvailability(
  unitId: string,
  moduleId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityResult> {
  const supabase = getSupabase();

  const { data: bookings, error } = await supabase
    .from('transactions')
    .select('metadata')
    .eq('engine_type', 'time_exclusive_reservation')
    .eq('module_id', moduleId)
    .filter('metadata->>unit_id', 'eq', unitId)
    .filter('metadata->>check_out_date', 'gte', startDate)
    .filter('metadata->>check_in_date', 'lte', endDate)
    .not('status', 'in', '("cancelled","no_show")');

  if (error) {
    logger.error('Failed to get availability', { unitId, error });
    throw new BookingServiceError('Failed to get availability', 'AVAILABILITY_FAILED', 500);
  }

  const blockedDates: string[] = [];

  for (const booking of bookings || []) {
    let current = dayjs(booking.metadata?.check_in_date);
    const checkout = dayjs(booking.metadata?.check_out_date);

    while (current.isBefore(checkout)) {
      blockedDates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
  }

  return { blockedDates };
}
