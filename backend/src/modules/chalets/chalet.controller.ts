import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection.js";
import { emailService } from "../../services/email.service.js";
import { createChaletBookingSchema, validateBody, uuidSchema } from "../../validation/schemas.js";
import { logger } from "../../utils/logger.js";
import { logActivity } from "../../utils/activityLogger.js";
import { emitToUnit } from "../../socket/index.js";
import dayjs from 'dayjs';
import { getRedis } from '../../config/session-store.js';

// Distributed booking lock using Redis (falls back to in-memory for non-Redis environments)
// Ensures only one booking request per chalet is processed at a time, even across server instances
const LOCK_TTL_SECONDS = 30; // Auto-expire lock after 30s to prevent deadlocks
const LOCK_PREFIX = 'booking:lock:';

// In-memory fallback for environments without Redis
const fallbackLocks = new Map<string, Promise<void>>();

async function acquireBookingLock(chaletId: string): Promise<() => void> {
  const redis = getRedis();

  // If Redis is available, use distributed lock
  if (redis) {
    const lockKey = `${LOCK_PREFIX}${chaletId}`;
    const lockValue = `${Date.now()}-${Math.random()}`;

    // Spin-wait with retries for up to 10s
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const acquired = await redis.set(lockKey, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
      if (acquired === 'OK') {
        // Return release function that only deletes if we still own the lock
        return async () => {
          const currentValue = await redis.get(lockKey);
          if (currentValue === lockValue) {
            await redis.del(lockKey);
          }
        };
      }
      // Wait 100ms before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Could not acquire booking lock — chalet is being booked by another request');
  }

  // Fallback to in-memory lock (single-instance only)
  while (fallbackLocks.has(chaletId)) {
    await fallbackLocks.get(chaletId);
  }

  let resolve: () => void;
  const lockPromise = new Promise<void>((res) => {
    resolve = res;
  });

  // @ts-ignore
  fallbackLocks.set(chaletId, lockPromise);

  // @ts-ignore
  return () => {
    fallbackLocks.delete(chaletId);
    // @ts-ignore
    resolve();
  };
}

function generateBookingNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `C-${date}-${random}`;
}

// ============================================
// Public Routes
// ============================================

export const getChalets = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { moduleId } = req.query;

  let query = supabase
    .from('chalets')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;

  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

export const getChalet = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chalets')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error && error.code === 'PGRST116') {
    return res.status(404).json({ success: false, error: 'Chalet not found' });
  }
  if (error) throw error;
  res.json({ success: true, data });
});

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { startDate, endDate } = req.query;
  const chaletId = req.params.id;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'startDate and endDate required' });
  }

  const start = dayjs(startDate as string);
  const end = dayjs(endDate as string);

  // Find overlapping bookings
  const { data: bookings, error } = await supabase
    .from('chalet_bookings')
    .select('check_in_date, check_out_date, status')
    .eq('chalet_id', chaletId)
    .is('deleted_at', null);

  if (error) throw error;

  const blockedDates = (bookings || [])
    .filter(b => !['cancelled', 'no_show'].includes(b.status))
    .flatMap(b => {
      const dates: string[] = [];
      let current = dayjs(b.check_in_date);
      const checkout = dayjs(b.check_out_date);
      while (current.isBefore(checkout)) {
        dates.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
      }
      return dates;
    });

  res.json({ success: true, data: { blockedDates } });
});

/**
 * Get daily prices for a chalet over a date range.
 * Returns per-day pricing accounting for price rules, weekday/weekend rates.
 * Used by the Airbnb-style price calendar on the customer booking page.
 */
export const getDailyPrices = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const chaletId = req.params.id;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'startDate and endDate required' });
  }

  const start = dayjs(startDate as string);
  const end = dayjs(endDate as string);

  // Cap to max 180 days to prevent abuse
  if (end.diff(start, 'day') > 180) {
    return res.status(400).json({ success: false, error: 'Date range cannot exceed 180 days' });
  }

  // Fetch chalet
  const { data: chalet, error: chaletError } = await supabase
    .from('chalets')
    .select('id, base_price, weekend_price')
    .eq('id', chaletId)
    .single();

  if (chaletError || !chalet) {
    return res.status(404).json({ success: false, error: 'Chalet not found' });
  }

  // Fetch active price rules for this chalet
  const { data: rawPriceRules } = await supabase
    .from('chalet_price_rules')
    .select('*')
    .eq('chalet_id', chaletId)
    .eq('is_active', true);

  const priceRules = (rawPriceRules || []).sort((a: any, b: any) => {
    if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
    const durA = dayjs(a.end_date).diff(dayjs(a.start_date), 'minute');
    const durB = dayjs(b.end_date).diff(dayjs(b.start_date), 'minute');
    return durA - durB;
  });

  // Fetch blocked dates (existing bookings)
  const { data: bookings } = await supabase
    .from('chalet_bookings')
    .select('check_in_date, check_out_date, status')
    .eq('chalet_id', chaletId)
    .is('deleted_at', null);

  const blockedDateSet = new Set<string>();
  (bookings || [])
    .filter((b: any) => !['cancelled', 'no_show'].includes(b.status))
    .forEach((b: any) => {
      let cur = dayjs(b.check_in_date);
      const out = dayjs(b.check_out_date);
      while (cur.isBefore(out)) {
        blockedDateSet.add(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
    });

  // Fetch manually blocked dates
  const { data: manualBlocks } = await supabase
    .from('chalet_blocked_dates')
    .select('blocked_date')
    .eq('chalet_id', chaletId)
    .gte('blocked_date', startDate as string)
    .lte('blocked_date', endDate as string);

  (manualBlocks || []).forEach((b: any) => {
    blockedDateSet.add(b.blocked_date);
  });

  // Build daily prices
  const dailyPrices: Array<{
    date: string;
    price: number;
    type: 'weekday' | 'weekend' | 'holiday' | 'seasonal';
    ruleName?: string;
    isBlocked: boolean;
  }> = [];

  let current = start;
  while (current.isBefore(end) || current.isSame(end)) {
    const dateStr = current.format('YYYY-MM-DD');
    const isWeekend = current.day() === 5 || current.day() === 6;
    const isSunday = current.day() === 0;
    const isBlocked = blockedDateSet.has(dateStr);

    // Find matching price rule
    const activeRule = priceRules.find((rule: any) => {
      if (!rule.start_date || !rule.end_date) return false;
      const rStart = dayjs(rule.start_date).startOf('day');
      const rEnd = dayjs(rule.end_date).endOf('day');
      return (current.isSame(rStart) || current.isAfter(rStart)) &&
        (current.isSame(rEnd) || current.isBefore(rEnd));
    });

    let price: number;
    let type: 'weekday' | 'weekend' | 'holiday' | 'seasonal' = isWeekend ? 'weekend' : 'weekday';
    let ruleName: string | undefined;

    if (activeRule) {
      ruleName = activeRule.name;
      type = 'seasonal';

      if (activeRule.price && !activeRule.base_price && !activeRule.weekend_price) {
        price = parseFloat(activeRule.price);
      } else if (activeRule.price_multiplier && !activeRule.base_price) {
        const base = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
        price = base * parseFloat(activeRule.price_multiplier);
      } else {
        const ruleBase = activeRule.base_price ? parseFloat(activeRule.base_price) : parseFloat(chalet.base_price);
        const ruleWeekend = activeRule.weekend_price ? parseFloat(activeRule.weekend_price) : parseFloat(chalet.weekend_price);
        const ruleHoliday = activeRule.holiday_price ? parseFloat(activeRule.holiday_price) : null;

        if (ruleHoliday && isSunday) {
          price = ruleHoliday;
          type = 'holiday';
        } else if (isWeekend) {
          price = ruleWeekend;
        } else {
          price = ruleBase;
        }
      }
    } else {
      price = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
    }

    dailyPrices.push({ date: dateStr, price, type, ruleName, isBlocked });
    current = current.add(1, 'day');
  }

  res.json({
    success: true,
    data: {
      chaletId,
      basePrices: {
        weekday: parseFloat(chalet.base_price),
        weekend: parseFloat(chalet.weekend_price),
      },
      dailyPrices,
    },
  });
});

/**
 * Block specific dates for a chalet (admin only).
 */
export const blockDates = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const chaletId = req.params.id;
  const { dates, reason } = req.body;
  const userId = (req as any).user?.id;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, error: 'dates array required' });
  }

  if (dates.length > 365) {
    return res.status(400).json({ success: false, error: 'Cannot block more than 365 dates at once' });
  }

  const rows = dates.map((d: string) => ({
    chalet_id: chaletId,
    blocked_date: d,
    reason: reason || null,
    blocked_by: userId || null,
  }));

  const { data, error } = await supabase
    .from('chalet_blocked_dates')
    .upsert(rows, { onConflict: 'chalet_id,blocked_date' })
    .select();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

/**
 * Unblock specific dates for a chalet (admin only).
 */
export const unblockDates = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const chaletId = req.params.id;
  const { dates } = req.body;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, error: 'dates array required' });
  }

  const { error } = await supabase
    .from('chalet_blocked_dates')
    .delete()
    .eq('chalet_id', chaletId)
    .in('blocked_date', dates);

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true });
});

/**
 * Get admin calendar data for a chalet: bookings + manual blocks for a date range.
 */
export const getAdminCalendar = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const chaletId = req.params.id;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'startDate and endDate required' });
  }

  // Fetch bookings that overlap with the date range (both conditions must be true)
  const { data: bookings } = await supabase
    .from('chalet_bookings')
    .select('id, booking_number, customer_name, check_in_date, check_out_date, status, number_of_guests, total_amount')
    .eq('chalet_id', chaletId)
    .is('deleted_at', null)
    .lte('check_in_date', endDate as string)
    .gte('check_out_date', startDate as string);

  // Fetch manually blocked dates in range
  const { data: blockedDates } = await supabase
    .from('chalet_blocked_dates')
    .select('*')
    .eq('chalet_id', chaletId)
    .gte('blocked_date', startDate as string)
    .lte('blocked_date', endDate as string);

  res.json({
    success: true,
    data: {
      bookings: (bookings || []).filter((b: any) => !['cancelled', 'no_show'].includes(b.status)),
      blockedDates: blockedDates || [],
    },
  });
});

export const getAddOns = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chalet_add_ons')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

/**
 * Get ALL add-ons for admin management (including inactive)
 */
export const getAdminAddOns = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chalet_add_ons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

// ============================================
// Booking Routes
// ============================================

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const validatedData = validateBody(createChaletBookingSchema, req.body);

  const supabase = getSupabase();
  const {
    chaletId,
    customerName,
    customerEmail,
    customerPhone,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    addOns: selectedAddOns,
    specialRequests,
    paymentMethod,
  } = validatedData;

  // Get chalet
  const { data: chalet, error: chaletError } = await supabase
    .from('chalets')
    .select('*')
    .eq('id', chaletId)
    .single();

  if (chaletError || !chalet) {
    return res.status(404).json({ success: false, error: 'Chalet not found' });
  }

  const checkIn = dayjs(checkInDate);
  const checkOut = dayjs(checkOutDate);
  const numberOfNights = checkOut.diff(checkIn, 'day');

  if (numberOfNights < 1) {
    return res.status(400).json({ success: false, error: 'Invalid date range' });
  }

  const releaseLock = await acquireBookingLock(chaletId);

  try {
    // 1. Check Availability (Overlap Check)
    const { data: existingBookings, error: availError } = await supabase
      .from('chalet_bookings')
      .select('id, check_in_date, check_out_date, status')
      .eq('chalet_id', chaletId)
      .is('deleted_at', null);

    if (availError) throw availError;

    // Filter out cancelled/no_show bookings and check for date overlaps
    const activeBookings = (existingBookings || []).filter(
      b => !['cancelled', 'no_show'].includes(b.status)
    );
    const hasOverlap = activeBookings.some(booking => {
      const bIn = dayjs(booking.check_in_date);
      const bOut = dayjs(booking.check_out_date);
      // Overlap if (start1 < end2) AND (end1 > start2)
      return checkIn.isBefore(bOut) && checkOut.isAfter(bIn);
    });

    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        error: 'Chalet is already booked for the selected dates'
      });
    }

    // 2. Fetch Seasonal Price Rules (only active ones)
    // ... Proceed with logic ...

    // 2. Fetch Seasonal Price Rules (only active ones)
    const { data: rawPriceRules } = await supabase
      .from('chalet_price_rules')
      .select('*')
      .eq('chalet_id', chaletId)
      .eq('is_active', true);

    // Sort rules so most specific apply first:
    // 1. Priority (if exists) descending
    // 2. Duration ascending (shorter rules = specific holidays)
    // 3. Start date ascending
    const priceRules = (rawPriceRules || []).sort((a, b) => {
      // If priority column exists, use it
      if ('priority' in a && 'priority' in b) {
        // @ts-ignore
        const pA = a.priority as number;
        // @ts-ignore
        const pB = b.priority as number;
        if (pA !== pB) return pB - pA;
      }

      const durA = dayjs(a.end_date).diff(dayjs(a.start_date), 'minute');
      const durB = dayjs(b.end_date).diff(dayjs(b.start_date), 'minute');
      if (durA !== durB) return durA - durB;

      return dayjs(a.start_date).valueOf() - dayjs(b.start_date).valueOf();
    });

    // 3. Calculate Base Amount (Night-by-night)
    let baseAmount = 0;
    let current = checkIn;
    while (current.isBefore(checkOut)) {
      // Find if any custom price rule applies to this specific night
      const activeRule = (priceRules || []).find(rule => {
        const start = dayjs(rule.start_date).startOf('day');
        const end = dayjs(rule.end_date).endOf('day');
        return (current.isSame(start) || current.isAfter(start)) &&
          (current.isSame(end) || current.isBefore(end));
      });

      const isWeekend = current.day() === 5 || current.day() === 6;
      // Sunday can also be considered a holiday day in some cultures
      const isSunday = current.day() === 0;

      let nightPrice: number;
      if (activeRule) {
        // Priority: holiday_price (Sun/holidays) > weekend_price (Fri-Sat) > base_price > price (flat override)
        if (activeRule.price && !activeRule.base_price && !activeRule.weekend_price) {
          // Flat override price from rule (legacy behavior)
          nightPrice = parseFloat(activeRule.price);
        } else if (activeRule.price_multiplier && !activeRule.base_price) {
          // Multiplier on chalet defaults (legacy behavior)
          const base = isWeekend
            ? parseFloat(chalet.weekend_price)
            : parseFloat(chalet.base_price);
          nightPrice = base * parseFloat(activeRule.price_multiplier);
        } else {
          // Enhanced pricing: use rule-level prices, falling back to chalet defaults
          const ruleBase = activeRule.base_price ? parseFloat(activeRule.base_price) : parseFloat(chalet.base_price);
          const ruleWeekend = activeRule.weekend_price ? parseFloat(activeRule.weekend_price) : parseFloat(chalet.weekend_price);
          const ruleHoliday = activeRule.holiday_price ? parseFloat(activeRule.holiday_price) : null;

          if (ruleHoliday && isSunday) {
            nightPrice = ruleHoliday;
          } else if (isWeekend) {
            nightPrice = ruleWeekend;
          } else {
            nightPrice = ruleBase;
          }
        }

        // Add per-guest surcharge if configured
        if (activeRule.per_guest_price && numberOfGuests) {
          const guestThreshold = activeRule.min_guests ? parseInt(activeRule.min_guests) : 1;
          const extraGuests = Math.max(0, numberOfGuests - guestThreshold);
          nightPrice += extraGuests * parseFloat(activeRule.per_guest_price);
        }
      } else {
        nightPrice = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
      }

      baseAmount += nightPrice;
      current = current.add(1, 'day');
    }

    // Calculate add-ons amount
    let addOnsAmount = 0;
    const addOnItems: Array<{ add_on_id: string; quantity: number; unit_price: number; subtotal: number }> = [];

    if (selectedAddOns && selectedAddOns.length > 0) {
      const { data: addOnsList } = await supabase
        .from('chalet_add_ons')
        .select('*')
        .eq('is_active', true);

      const addOnMap = new Map((addOnsList || []).map(a => [a.id, a]));

      for (const item of selectedAddOns) {
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

    // Get deposit configuration from settings
    let depositAmount = 0;
    let depositType: 'percentage' | 'fixed' = 'percentage';
    let depositPercentage = 30; // Default 30%
    let depositFixed = 100; // Default $100

    try {
      // Try to get deposit settings from site_settings
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('key, value')
        .eq('key', 'chalets')
        .single();

      if (settingsData?.value) {
        const chaletSettings = typeof settingsData.value === 'string'
          ? JSON.parse(settingsData.value)
          : settingsData.value;

        depositType = chaletSettings.chaletDepositType || 'percentage';
        depositPercentage = chaletSettings.chaletDeposit || 30;
        depositFixed = chaletSettings.chaletDepositFixed || 100;
      }
    } catch (e) {
      logger.warn('Error fetching deposit settings, using default', e);
    }

    // Calculate deposit based on type
    if (depositType === 'fixed') {
      depositAmount = depositFixed;
    } else {
      depositAmount = (baseAmount * depositPercentage) / 100;
    }

    const totalAmount = baseAmount + addOnsAmount;

    // Atomic booking + add-ons insert via DB function
    // This ensures both the booking and add-ons are created in a single transaction.
    // If either fails, the entire transaction rolls back — no orphan bookings.
    const bookingPayload = {
      booking_number: generateBookingNumber(),
      chalet_id: chaletId,
      customer_id: req.user?.userId || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      check_in_date: checkIn.toISOString(),
      check_out_date: checkOut.toISOString(),
      number_of_guests: numberOfGuests,
      number_of_nights: numberOfNights,
      base_amount: baseAmount,
      add_ons_amount: addOnsAmount,
      deposit_amount: depositAmount,
      total_amount: totalAmount,
      status: 'pending',
      payment_status: 'pending',
      payment_method: paymentMethod,
      special_requests: specialRequests,
    };

    let rpcResult;
    let rpcError;

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'create_chalet_booking_with_addons',
      {
        p_booking: bookingPayload,
        p_add_ons: addOnItems.length > 0
          ? addOnItems.map(item => ({
              add_on_id: item.add_on_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            }))
          : [],
      }
    );
    
    rpcResult = rpcData;
    rpcError = rpcErr;

    // Fallback removed - strictly use atomic function


    if (rpcError) {
      console.error('RPC Error details:', rpcError);
      logger.error('[createBooking] Atomic RPC error', {
        error: rpcError, payload: {
          chaletId, customerName, customerEmail, customerPhone, checkInDate, checkOutDate, numberOfGuests, paymentMethod
        }
      });
      return res.status(500).json({ success: false, error: 'Failed to create booking (DB error)' });
    }

    const bookingId = rpcResult?.[0]?.booking_id || rpcResult?.booking_id;

    // Fetch the full booking for the response
    const { data: booking, error: bookingError } = await supabase
      .from('chalet_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      logger.error('[createBooking] Failed to fetch created booking', { bookingId, error: bookingError });
      return res.status(500).json({ success: false, error: 'Booking created but failed to retrieve details' });
    }

    // Send booking confirmation email
    if (customerEmail) {
      const { data: addOnsList } = await supabase
        .from('chalet_add_ons')
        .select('id, name, price')
        .in('id', addOnItems.map((a) => a.add_on_id));

      const addOnMap = new Map((addOnsList || []).map((a) => [a.id, a]));
      const formattedAddOns = addOnItems.map((item) => ({
        name: addOnMap.get(item.add_on_id)?.name || 'Add-on',
        price: item.subtotal,
      }));

      emailService.sendBookingConfirmation({
        customerEmail,
        customerName,
        bookingNumber: booking.booking_number,
        chaletName: chalet.name,
        checkInDate: dayjs(booking.check_in_date).format('MMMM D, YYYY'),
        checkOutDate: dayjs(booking.check_out_date).format('MMMM D, YYYY'),
        numberOfGuests,
        numberOfNights,
        addOns: formattedAddOns,
        totalAmount: parseFloat(booking.total_amount),
        paymentStatus: booking.payment_status,
      }).catch((err) => {
        logger.warn('Failed to send booking confirmation email:', err);
      });
    }

    // Audit log for booking creation
    logActivity({
      user_id: req.user?.userId || 'guest',
      action: 'booking_created',
      resource: 'chalet_booking',
      resource_id: booking.id,
      new_value: {
        booking_number: booking.booking_number,
        chalet_id: chaletId,
        check_in: checkInDate,
        check_out: checkOutDate,
        total: booking.total_amount
      },
      ip_address: req.ip,
    });

    // Emit real-time event for staff dashboard
    emitToUnit('chalets', 'booking:new', {
      id: booking.id,
      bookingNumber: booking.booking_number,
      chaletName: chalet.name,
      customerName,
      checkInDate,
      checkOutDate,
      status: booking.status,
      totalAmount: booking.total_amount,
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } finally {
    // Always release lock, including early returns (overlap/rpc/fetch errors)
    await releaseLock();
  }
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data: booking, error } = await supabase
    .from('chalet_bookings')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error && error.code === 'PGRST116') {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (error) throw error;

  let chalet: any = null;
  if (booking?.chalet_id) {
    const { data: chaletData } = await supabase
      .from('chalets')
      .select('*')
      .eq('id', booking.chalet_id)
      .single();
    chalet = chaletData || null;
  }

  const { data: bookingAddOns } = await supabase
    .from('chalet_booking_add_ons')
    .select('*')
    .eq('booking_id', booking.id);

  const addOnIds = [...new Set(
    (bookingAddOns || [])
      .map((a: any) => a.add_on_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];

  let addOnsById: Record<string, any> = {};
  if (addOnIds.length > 0) {
    const { data: addOnRows } = await supabase
      .from('chalet_add_ons')
      .select('*')
      .in('id', addOnIds);

    addOnsById = Object.fromEntries((addOnRows || []).map((a: any) => [a.id, a]));
  }

  const addOns = (bookingAddOns || []).map((item: any) => ({
    ...item,
    add_on: addOnsById[item.add_on_id] || null,
  }));

  res.json({
    success: true,
    data: {
      ...booking,
      chalet,
      add_ons: addOns,
    },
  });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { reason } = req.body;
  const userId = req.user?.userId;

  // First, get the booking to verify ownership
  const { data: booking, error: fetchError } = await supabase
    .from('chalet_bookings')
    .select('id, customer_id, status, customer_email, customer_name, booking_number, chalet_id')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  // Only the booking owner or admin/staff can cancel
  const isOwner = booking.customer_id === userId;
  const userRoles = req.user?.roles || [];
  const isAdminOrStaff = userRoles.includes('admin')
    || userRoles.includes('staff')
    || userRoles.includes('super_admin')
    || userRoles.includes('chalet_admin');

  if (!isOwner && !isAdminOrStaff) {
    return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
  }

  // Check if already cancelled
  if (booking.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
  }

  let { data, error } = await supabase
    .from('chalet_bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  // Compatibility fallback for schemas that don't have legacy cancel columns.
  if (error && /cancelled_at|cancellation_reason|schema cache|column/i.test(String(error.message || error.details || ''))) {
    const fallback = await supabase
      .from('chalet_bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  let chaletName = 'Chalet';
  if (booking.chalet_id) {
    const { data: chalet } = await supabase
      .from('chalets')
      .select('name')
      .eq('id', booking.chalet_id)
      .single();

    if (chalet?.name) {
      chaletName = chalet.name;
    }
  }

  // Send cancellation email
  if (booking.customer_email) {
    emailService.sendBookingCancellation({
      customerEmail: booking.customer_email,
      customerName: booking.customer_name,
      bookingNumber: booking.booking_number,
      chaletName,
      reason,
    }).catch(err => logger.warn('Failed to send cancellation email:', err));
  }

  res.json({ success: true, data, message: 'Booking cancelled' });
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const userId = req.user?.userId;

  const { data, error } = await supabase
    .from('chalet_bookings')
    .select('*')
    .eq('customer_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const bookings = data || [];
  const chaletIds = [...new Set(
    bookings
      .map((b: any) => b.chalet_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];

  let chaletsById: Record<string, any> = {};
  if (chaletIds.length > 0) {
    const { data: chalets } = await supabase
      .from('chalets')
      .select('id, name, images')
      .in('id', chaletIds);

    chaletsById = Object.fromEntries((chalets || []).map((c: any) => [c.id, c]));
  }

  const enrichedBookings = bookings.map((booking: any) => ({
    ...booking,
    chalet: booking.chalet_id ? (chaletsById[booking.chalet_id] || null) : null,
  }));

  res.json({ success: true, data: enrichedBookings });
});

// ============================================
// Staff Routes
// ============================================

export const getStaffBookings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { status, chaletId, startDate, endDate } = req.query;

  let query = supabase
    .from('chalet_bookings')
    .select('*')
    .is('deleted_at', null)
    .order('check_in_date', { ascending: true });

  if (status) query = query.eq('status', status);
  if (chaletId) query = query.eq('chalet_id', chaletId);
  if (startDate) query = query.gte('check_in_date', startDate);
  if (endDate) query = query.lte('check_in_date', endDate);

  const { data, error } = await query;
  if (error) throw error;

  const bookings = data || [];
  const chaletIds = [...new Set(
    bookings
      .map((b: any) => b.chalet_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];
  const customerIds = [...new Set(
    bookings
      .map((b: any) => b.customer_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];

  let chaletsById: Record<string, any> = {};
  if (chaletIds.length > 0) {
    const { data: chalets } = await supabase
      .from('chalets')
      .select('id, name, capacity')
      .in('id', chaletIds);

    chaletsById = Object.fromEntries((chalets || []).map((c: any) => [c.id, c]));
  }

  let usersById: Record<string, any> = {};
  if (customerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .in('id', customerIds);

    usersById = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
  }

  const enrichedBookings = bookings.map((booking: any) => ({
    ...booking,
    chalets: booking.chalet_id ? (chaletsById[booking.chalet_id] || null) : null,
    users: booking.customer_id ? (usersById[booking.customer_id] || null) : null,
  }));

  res.json({ success: true, data: enrichedBookings });
});

export const getTodayBookings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const today = dayjs().format('YYYY-MM-DD');

  const { data: checkIns } = await supabase
    .from('chalet_bookings')
    .select('*')
    .gte('check_in_date', `${today}T00:00:00`)
    .lt('check_in_date', `${today}T23:59:59`)
    .is('deleted_at', null);

  const { data: checkOuts } = await supabase
    .from('chalet_bookings')
    .select('*')
    .gte('check_out_date', `${today}T00:00:00`)
    .lt('check_out_date', `${today}T23:59:59`)
    .is('deleted_at', null);

  const allBookings = [...(checkIns || []), ...(checkOuts || [])];
  const chaletIds = [...new Set(
    allBookings
      .map((b: any) => b.chalet_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];
  const customerIds = [...new Set(
    allBookings
      .map((b: any) => b.customer_id)
      .filter((id: any) => typeof id === 'string' && id.length > 0)
  )] as string[];

  let chaletsById: Record<string, any> = {};
  if (chaletIds.length > 0) {
    const { data: chalets } = await supabase
      .from('chalets')
      .select('id, name, capacity')
      .in('id', chaletIds);

    chaletsById = Object.fromEntries((chalets || []).map((c: any) => [c.id, c]));
  }

  let usersById: Record<string, any> = {};
  if (customerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .in('id', customerIds);

    usersById = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
  }

  const attachUser = (booking: any) => ({
    ...booking,
    chalets: booking.chalet_id ? (chaletsById[booking.chalet_id] || null) : null,
    users: booking.customer_id ? (usersById[booking.customer_id] || null) : null,
  });

  res.json({
    success: true,
    data: {
      checkIns: (checkIns || []).map(attachUser),
      checkOuts: (checkOuts || []).map(attachUser),
    },
  });
});

export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  let { data, error } = await supabase
    .from('chalet_bookings')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_in_by: req.user?.userId,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error && /checked_in_at|checked_in_by|schema cache|column/i.test(String(error.message || error.details || ''))) {
    const fallback = await supabase
      .from('chalet_bookings')
      .update({
        status: 'checked_in',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  res.json({ success: true, data, message: 'Guest checked in' });
});

export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  let { data, error } = await supabase
    .from('chalet_bookings')
    .update({
      status: 'checked_out',
      checked_out_at: new Date().toISOString(),
      checked_out_by: req.user?.userId,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error && /checked_out_at|checked_out_by|schema cache|column/i.test(String(error.message || error.details || ''))) {
    const fallback = await supabase
      .from('chalet_bookings')
      .update({
        status: 'checked_out',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  res.json({ success: true, data, message: 'Guest checked out' });
});

export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { status } = req.body;

  const { data, error } = await supabase
    .from('chalet_bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;

  // Audit log for booking status change
  logActivity({
    user_id: req.user?.userId || 'system',
    action: 'booking_status_changed',
    resource: 'chalet_booking',
    resource_id: req.params.id,
    new_value: { status },
    ip_address: req.ip,
  });

  // Emit real-time event for staff dashboard
  emitToUnit('chalets', 'booking:statusChanged', {
    id: req.params.id,
    status,
  });

  res.json({ success: true, data });
});

// ============================================
// Admin Routes
// ============================================

export async function createChalet(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();

    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Chalet name is required' });
    }
    if (!req.body.base_price && req.body.base_price !== 0) {
      return res.status(400).json({ success: false, message: 'Base price is required' });
    }

    // Ensure all required fields have proper values
    const chaletData: Record<string, unknown> = {
      name: req.body.name,
      name_ar: req.body.name_ar || null,
      name_fr: req.body.name_fr || null,
      description: req.body.description || null,
      description_ar: req.body.description_ar || null,
      description_fr: req.body.description_fr || null,
      capacity: req.body.capacity || 4,
      bedroom_count: req.body.bedroom_count || 1,
      bathroom_count: req.body.bathroom_count || 1,
      base_price: parseFloat(req.body.base_price) || 0,
      weekend_price: req.body.weekend_price ? parseFloat(req.body.weekend_price) : (parseFloat(req.body.base_price) || 0),
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      amenities: req.body.amenities || [],
      images: req.body.images || [],
    };

    // Support module_id for dynamic module units (hotel-rooms, villas, etc.)
    if (req.body.module_id || req.body.moduleId) {
      chaletData.module_id = req.body.module_id || req.body.moduleId;
    }

    const { data, error } = await supabase
      .from('chalets')
      .insert(chaletData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error & { code?: string; column?: string };
    // Return more specific error message
    if (err.code === '23502') {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${err.column || 'unknown'}`
      });
    }
    next(error);
  }
}

export const updateChalet = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Extract only valid snake_case fields for the chalets table
  const validFields = [
    'name', 'name_ar', 'name_fr', 'description', 'description_ar', 'description_fr',
    'capacity', 'bedroom_count', 'bathroom_count', 'amenities', 'images',
    'base_price', 'weekend_price', 'size', 'status', 'is_active'
  ];

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  const { data, error } = await supabase
    .from('chalets')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, data });
});

export const deleteChalet = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chalets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true, message: 'Chalet deleted' });
});

export const createAddOn = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Extract only valid snake_case fields for the chalet_add_ons table
  const validFields = [
    'name', 'name_ar', 'name_fr', 'description', 'price', 'price_type', 'is_active'
  ];

  const insertData: Record<string, any> = {};
  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      insertData[field] = req.body[field];
    }
  }

  // Convert is_per_day to price_type if not already provided
  if (insertData.price_type === undefined) {
    const isPerDay = req.body.is_per_day ?? req.body.isPerDay ?? false;
    insertData.price_type = isPerDay ? 'per_night' : 'one_time';
  }

  const { data, error } = await supabase
    .from('chalet_add_ons')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  res.status(201).json({ success: true, data });
});

export const updateAddOn = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Extract only valid snake_case fields for the chalet_add_ons table
  const validFields = [
    'name', 'name_ar', 'name_fr', 'description', 'price', 'price_type', 'is_active'
  ];

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  // Convert is_per_day to price_type if provided
  if (req.body.is_per_day !== undefined || req.body.isPerDay !== undefined) {
    const isPerDay = req.body.is_per_day ?? req.body.isPerDay ?? false;
    updateData.price_type = isPerDay ? 'per_night' : 'one_time';
  }

  const { data, error } = await supabase
    .from('chalet_add_ons')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, data });
});

export const deleteAddOn = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chalet_add_ons')
    .update({ is_active: false })
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true, message: 'Add-on deleted' });
});

export const getPriceRules = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const moduleId = req.query.moduleId as string | undefined;

  const buildQuery = (withModuleFilter: boolean) => {
    let query = supabase
      .from('chalet_price_rules')
      .select('*')
      .order('start_date', { ascending: true });

    if (withModuleFilter && moduleId) {
      query = query.eq('module_id', moduleId);
    }

    return query;
  };

  let { data, error } = await buildQuery(Boolean(moduleId));

  // Backward compatibility: some deployed schemas do not have module_id on chalet_price_rules.
  if (error && moduleId && (error as { code?: string }).code === '42703') {
    const fallbackResult = await buildQuery(false);
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

export const createPriceRule = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Extract only valid snake_case fields for the chalet_price_rules table
  const validFields = [
    'chalet_id', 'name', 'start_date', 'end_date', 'price_multiplier',
    'price', 'base_price', 'weekend_price', 'holiday_price', 'per_guest_price',
    'min_guests', 'max_guests', 'priority', 'is_active', 'module_id'
  ];

  const nullableFields = ['chalet_id', 'start_date', 'end_date'];
  const insertData: Record<string, any> = {};
  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      // Convert empty strings to null for UUID and date fields
      if (nullableFields.includes(field) && req.body[field] === '') {
        insertData[field] = null;
      } else {
        insertData[field] = req.body[field];
      }
    }
  }

  const { data, error } = await supabase
    .from('chalet_price_rules')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  res.status(201).json({ success: true, data });
});

export const updatePriceRule = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  // Extract only valid snake_case fields for the chalet_price_rules table
  const validFields = [
    'chalet_id', 'name', 'start_date', 'end_date', 'price_multiplier',
    'price', 'base_price', 'weekend_price', 'holiday_price', 'per_guest_price',
    'min_guests', 'max_guests', 'priority', 'is_active', 'module_id'
  ];

  const nullableFields = ['chalet_id', 'start_date', 'end_date'];
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const field of validFields) {
    if (req.body[field] !== undefined) {
      // Convert empty strings to null for UUID and date fields
      if (nullableFields.includes(field) && req.body[field] === '') {
        updateData[field] = null;
      } else {
        updateData[field] = req.body[field];
      }
    }
  }

  const { data, error } = await supabase
    .from('chalet_price_rules')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, data });
});

export const deletePriceRule = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chalet_price_rules')
    .update({ is_active: false })
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true, message: 'Price rule deleted' });
});

// ============================================
// Settings
// ============================================

export const getChaletSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const settingsObj: Record<string, any> = {
    deposit_percentage: 30, // Default
    check_in_time: '14:00',
    check_out_time: '11:00',
  };

  // Get settings with chalet_ prefix
  const { data: settings, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .like('key', 'chalet_%');

  if (error) {
    // Fallback to legacy 'chalets' key format
    const { data: oldData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'chalets')
      .single();

    if (oldData?.value) {
      const val = typeof oldData.value === 'string' ? JSON.parse(oldData.value) : oldData.value;
      settingsObj.deposit_percentage = val.depositPercent || val.deposit_percentage || 30;
      settingsObj.check_in_time = val.checkIn || val.check_in_time || '14:00';
      settingsObj.check_out_time = val.checkOut || val.check_out_time || '11:00';
    }
  } else {
    (settings || []).forEach(s => {
      // Remove chalet_ prefix from key
      const key = s.key.replace('chalet_', '');
      const val = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
      settingsObj[key] = val;
    });
  }

  res.json({ success: true, data: settingsObj });
});

export const updateChaletSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const settings = req.body;

  for (const [key, value] of Object.entries(settings)) {
    // Use chalet_ prefix for keys to namespace them
    const settingKey = key.startsWith('chalet_') ? key : `chalet_${key}`;
    await supabase
      .from('site_settings')
      .upsert(
        {
          key: settingKey,
          value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );
  }

  res.json({ success: true, message: 'Settings updated' });
});
