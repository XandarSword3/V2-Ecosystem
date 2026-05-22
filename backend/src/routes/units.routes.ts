import { Router, Request, Response } from 'express';
import dayjs from 'dayjs';
import { getSupabase } from '../database/connection.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';

const router = Router();
const engineService = getEngineService();

function asNumber(input: unknown, fallback = 0): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { moduleId, propertyId } = _req.query;

    let query = supabase
      .from('bookable_units')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (typeof moduleId === 'string' && moduleId) {
      query = query.eq('module_id', moduleId);
    }
    if (typeof propertyId === 'string' && propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;

    res.json({ success: true, data: data ?? [] });
  } catch (error) {
    logger.error('[Units] GET /units failed', error);
    res.status(500).json({ success: false, error: 'Failed to list units' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookable_units')
      .select('*')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error('[Units] GET /units/:id failed', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unit' });
  }
});

router.get('/:id/availability', async (req: Request, res: Response) => {
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
      .is('deleted_at', null)
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
  } catch (error) {
    logger.error('[Units] GET /units/:id/availability failed', error);
    res.status(500).json({ success: false, error: 'Failed to fetch availability' });
  }
});

router.post('/bookings', authenticate, async (req: Request, res: Response) => {
  try {
    const { unit_id, check_in_date, check_out_date, number_of_guests } = req.body ?? {};
    if (!unit_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, error: 'unit_id, check_in_date and check_out_date are required' });
      return;
    }

    const supabase = getSupabase();
    const { data: unit, error: unitError } = await supabase
      .from('bookable_units')
      .select('id, name, base_price, module_id')
      .eq('id', unit_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (unitError) throw unitError;
    if (!unit) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    const nights = Math.max(1, dayjs(check_out_date).diff(dayjs(check_in_date), 'day'));
    const unitPrice = asNumber(unit.base_price, 0);

    const pricing = await engineService.calculatePricing(
      'multi_day_booking',
      [{ itemId: unit.id, name: unit.name ?? 'unit', quantity: nights, unitPrice }],
      { moduleId: unit.module_id ?? undefined, customerId: req.user?.userId ?? undefined },
    );

    const { data: created, error } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'time_exclusive_reservation',
        module_id: unit.module_id,
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
  } catch (error) {
    logger.error('[Units] POST /units/bookings failed', error);
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

export default router;
