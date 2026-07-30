import { Router, Request, Response } from 'express';
import dayjs from 'dayjs';
import { getSupabase } from '../database/connection.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { resolveTaxCategory } from '../services/tax.service.js';

const router = Router();
const engineService = getEngineService();

function asNumber(input: unknown, fallback = 0): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

/** Columns exposed by bookable_units view (legacy view uses `price`, newer uses `base_price`). */
const UNIT_LIST_COLUMNS = 'id, name, description, price, capacity, is_active, created_at, updated_at';

function normalizeUnitRow(row: Record<string, unknown>): Record<string, unknown> {
  const price = row.price ?? row.base_price;
  return {
    ...row,
    base_price: price,
    price,
  };
}

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('bookable_units')
      .select(UNIT_LIST_COLUMNS)
      .eq('is_active', true);

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;

    res.json({ success: true, data: (data ?? []).map((row) => normalizeUnitRow(row as Record<string, unknown>)) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get units' });
  }
}));

// ── Static routes MUST be before /:id to avoid UUID casting errors ──

router.get('/availability', asyncHandler(async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookable_units')
      .select(UNIT_LIST_COLUMNS)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: (data ?? []).map((row) => normalizeUnitRow(row as Record<string, unknown>)) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get availability' });
  }
}));

router.get('/add-ons', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accommodation_add_ons')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get add-ons' });
  }
}));

router.get('/bookings', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('id, customer_id, status, amount, metadata, created_at')
      .eq('engine_type', 'time_exclusive_reservation')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get bookings' });
  }
}));

router.get('/bookings/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .select('id, customer_id, status, amount, metadata, created_at')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', req.params.bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get booking' });
  }
}));

router.patch('/bookings/:bookingId/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const newStatus = String(req.body?.status ?? '');
    if (!newStatus) {
      res.status(400).json({ success: false, error: 'status is required' });
      return;
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', req.params.bookingId)
      .select('id, status, updated_at')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to update booking status' });
  }
}));

// ── Parameterized routes ──

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookable_units')
      .select(UNIT_LIST_COLUMNS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    res.json({ success: true, data: normalizeUnitRow(data as Record<string, unknown>) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get unit' });
  }
}));

router.get('/:id/availability', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      res.status(400).json({ success: false, error: 'startDate and endDate required' });
      return;
    }

    const unitId = req.params.id;
    const supabase = getSupabase();

    const { data: unit, error: unitError } = await supabase
      .from('bookable_units')
      .select('id')
      .eq('id', unitId)
      .maybeSingle();

    if (unitError) throw unitError;
    if (!unit) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    const { data: bookings, error } = await supabase
      .from('transactions')
      .select('status, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .filter('metadata->>unit_id', 'eq', unitId);

    if (error) throw error;

    const start = dayjs(startDate);
    const end = dayjs(endDate);

    const blockedDates = (bookings ?? [])
      .filter((booking) => !['cancelled', 'no_show'].includes(String(booking.status)))
      .flatMap((booking) => {
        const metadata = booking.metadata as Record<string, unknown> | null;
        const checkIn = metadata?.check_in_date ? dayjs(String(metadata.check_in_date)) : null;
        const checkOut = metadata?.check_out_date ? dayjs(String(metadata.check_out_date)) : null;
        if (!checkIn || !checkOut || !checkIn.isValid() || !checkOut.isValid()) return [];

        const dates: string[] = [];
        let current = checkIn.clone();
        while (current.isBefore(checkOut)) {
          if (!current.isBefore(start) && current.isBefore(end)) {
            dates.push(current.format('YYYY-MM-DD'));
          }
          current = current.add(1, 'day');
        }
        return dates;
      });

    res.json({ success: true, data: { blockedDates } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to get availability' });
  }
}));

router.post('/bookings', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { unit_id, check_in_date, check_out_date, number_of_guests } = req.body ?? {};
    if (!unit_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, error: 'unit_id, check_in_date and check_out_date are required' });
      return;
    }

    const supabase = getSupabase();
    const { data: unit, error: unitError } = await supabase
      .from('accommodation_units')
      .select('id, name, base_price, module_id')
      .eq('id', unit_id)
      .maybeSingle();

    if (unitError) throw unitError;
    if (!unit) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    // Fetch module's tax category for tax scoping
    const { data: module } = await supabase
      .from('modules')
      .select('tax_category')
      .eq('id', unit.module_id)
      .maybeSingle();

    const nights = Math.max(1, dayjs(check_out_date).diff(dayjs(check_in_date), 'day'));
    const unitPrice = asNumber(unit.base_price, 0);

    const lineItem = {
      itemId: unit.id,
      name: unit.name ?? 'unit',
      quantity: nights,
      unitPrice,
      metadata: {},
    };
    const pricing = await engineService.calculatePricing(
      'multi_day_booking',
      [{
        ...lineItem,
        taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
      }],
      { moduleId: unit.module_id ?? undefined, customerId: req.user?.userId ?? undefined },
    );

    const { data: created, error } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'time_exclusive_reservation',
        module_id: unit.module_id ?? null,
        customer_id: req.user?.userId ?? null,
        status: 'pending',
        amount: pricing.totalAmount,
        metadata: {
          unit_id,
          check_in_date,
          check_out_date,
          number_of_guests: number_of_guests ?? null,
        },
      })
      .select('id, module_id, customer_id, status, amount, metadata, created_at')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message ?? 'Failed to create booking' });
  }
}));

export default router;
