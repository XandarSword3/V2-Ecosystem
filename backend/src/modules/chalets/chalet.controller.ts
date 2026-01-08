import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import { emailService } from "../../services/email.service.js";
import { createChaletBookingSchema, validateBody, uuidSchema } from "../../validation/schemas.js";
import dayjs from 'dayjs';

function generateBookingNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `C-${date}-${random}`;
}

// ============================================
// Public Routes
// ============================================

export async function getChalets(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getChalet(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getAvailability(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getAddOns(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_add_ons')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Booking Routes
// ============================================

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
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

    // Calculate base amount
    let baseAmount = 0;
    let current = checkIn;
    while (current.isBefore(checkOut)) {
      const isWeekend = current.day() === 5 || current.day() === 6;
      const nightPrice = isWeekend ? parseFloat(chalet.weekend_price) : parseFloat(chalet.base_price);
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
      console.warn('Error fetching deposit settings, using default', e);
    }

    // Calculate deposit based on type
    if (depositType === 'fixed') {
      depositAmount = depositFixed;
    } else {
      depositAmount = (baseAmount * depositPercentage) / 100;
    }

    const totalAmount = baseAmount + addOnsAmount;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('chalet_bookings')
      .insert({
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
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Insert add-ons
    if (addOnItems.length > 0) {
      await supabase
        .from('chalet_booking_add_ons')
        .insert(addOnItems.map(item => ({
          booking_id: booking.id,
          add_on_id: item.add_on_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })));
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
        console.warn('Failed to send booking confirmation email:', err);
      });
    }

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: booking, error } = await supabase
      .from('chalet_bookings')
      .select(`
        *,
        chalet:chalets(*),
        add_ons:chalet_booking_add_ons(*, add_on:chalet_add_ons(*))
      `)
      .eq('id', req.params.id)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    if (error) throw error;

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { reason } = req.body;
    const userId = req.user?.userId;

    // First, get the booking to verify ownership
    const { data: booking, error: fetchError } = await supabase
      .from('chalet_bookings')
      .select('id, customer_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only the booking owner or admin/staff can cancel
    const isOwner = booking.customer_id === userId;
    const userRoles = req.user?.roles || [];
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    const { data, error } = await supabase
      .from('chalet_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data, message: 'Booking cancelled' });
  } catch (error) {
    next(error);
  }
}

export async function getMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = req.user?.userId;

    const { data, error } = await supabase
      .from('chalet_bookings')
      .select('*, chalet:chalets(name, images)')
      .eq('customer_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Staff Routes
// ============================================

export async function getStaffBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { status, chaletId, startDate, endDate } = req.query;

    let query = supabase
      .from('chalet_bookings')
      .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
      .is('deleted_at', null)
      .order('check_in_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (chaletId) query = query.eq('chalet_id', chaletId);
    if (startDate) query = query.gte('check_in_date', startDate);
    if (endDate) query = query.lte('check_in_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

export async function getTodayBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const today = dayjs().format('YYYY-MM-DD');

    const { data: checkIns } = await supabase
      .from('chalet_bookings')
      .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
      .gte('check_in_date', `${today}T00:00:00`)
      .lt('check_in_date', `${today}T23:59:59`)
      .is('deleted_at', null);

    const { data: checkOuts } = await supabase
      .from('chalet_bookings')
      .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
      .gte('check_out_date', `${today}T00:00:00`)
      .lt('check_out_date', `${today}T23:59:59`)
      .is('deleted_at', null);

    res.json({
      success: true,
      data: {
        checkIns: checkIns || [],
        checkOuts: checkOuts || [],
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_bookings')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: req.user?.userId,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data, message: 'Guest checked in' });
  } catch (error) {
    next(error);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_bookings')
      .update({
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        checked_out_by: req.user?.userId,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data, message: 'Guest checked out' });
  } catch (error) {
    next(error);
  }
}

export async function updateBookingStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { status } = req.body;

    const { data, error } = await supabase
      .from('chalet_bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

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
    const chaletData = {
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
      is_featured: req.body.is_featured || false,
      amenities: req.body.amenities || [],
      images: req.body.images || [],
      image_url: req.body.image_url || null,
    };

    const { data, error } = await supabase
      .from('chalets')
      .insert(chaletData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    // Return more specific error message
    if (error.code === '23502') {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${error.column || 'unknown'}`
      });
    }
    next(error);
  }
}

export async function updateChalet(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalets')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteChalet(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('chalets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Chalet deleted' });
  } catch (error) {
    next(error);
  }
}

export async function createAddOn(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_add_ons')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateAddOn(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_add_ons')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAddOn(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('chalet_add_ons')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Add-on deleted' });
  } catch (error) {
    next(error);
  }
}

export async function getPriceRules(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_price_rules')
      .select('*, chalet:chalets(name)')
      .order('start_date', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

export async function createPriceRule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_price_rules')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updatePriceRule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('chalet_price_rules')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deletePriceRule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('chalet_price_rules')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Price rule deleted' });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Settings
// ============================================

export async function getChaletSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    let settingsObj: Record<string, any> = {
      deposit_percentage: 30, // Default
      check_in_time: '14:00',
      check_out_time: '11:00',
    };

    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('category', 'chalet');

    if (error) {
      // Handle schema mismatch (missing category column)
      if (error.code === '42703' || error.message?.includes('column')) {
        const { data: oldData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'chalets')
          .single();

        if (oldData?.value) {
          settingsObj.deposit_percentage = oldData.value.depositPercent || 30;
          settingsObj.check_in_time = oldData.value.checkIn || '14:00';
          settingsObj.check_out_time = oldData.value.checkOut || '11:00';
        }
      } else {
        throw error;
      }
    } else {
      (settings || []).forEach(s => {
        settingsObj[s.key] = s.value;
      });
    }

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
}

export async function updateChaletSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await supabase
        .from('site_settings')
        .upsert(
          {
            key,
            value: String(value),
            category: 'chalet',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key,category' }
        );
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
}
