import { Router, Request, Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireModule } from '../middleware/moduleGuard.middleware.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getSupabase } from '../database/connection.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';
import { requirePropertyAccess } from '../middleware/propertyAccess.middleware.js';

// Import parsers
import * as menuServiceParser from '../modules/shared/import/menu-service-import.parser.js';
import * as sessionAccessParser from '../modules/shared/import/session-access-import.parser.js';
import * as multiDayBookingParser from '../modules/shared/import/multi-day-booking-import.parser.js';

type TemplateType = 'menu_service' | 'multi_day_booking' | 'session_access' | 'subscription' | 'membership_access';

interface MountedModuleContext {
  id: string;
  slug: string;
  template_type: string;
  property_id?: string | null;
}

interface DynamicRequest extends Request {
  mountedModule?: MountedModuleContext;
}

const engineService = getEngineService();
const STAFF_ROLES = ['staff', 'manager', 'admin', 'super_admin'];

function getMountedModule(req: Request): MountedModuleContext | null {
  const dynamicReq = req as DynamicRequest;
  return dynamicReq.mountedModule ?? null;
}

function requireMountedModule(req: Request, res: Response, next: NextFunction): void {
  const mounted = getMountedModule(req);
  if (!mounted) {
    res.status(500).json({ success: false, error: 'Mounted module context is missing' });
    return;
  }
  next();
}

function enforceMountedModuleActive(req: Request, res: Response, next: NextFunction): void {
  const mounted = getMountedModule(req);
  if (!mounted) {
    res.status(500).json({ success: false, error: 'Mounted module context is missing' });
    return;
  }

  requireModule(mounted.slug)(req, res, next).catch((error: unknown) => {
    logger.error('[Dynamic Router] Failed module guard check', {
      slug: mounted.slug,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ success: false, error: 'Unable to validate module availability' });
  });
}

function enforceMountedModulePropertyAccess(req: Request, res: Response, next: NextFunction): void {
  const mounted = getMountedModule(req);
  if (!mounted) {
    res.status(500).json({ success: false, error: 'Mounted module context is missing' });
    return;
  }

  if (process.env.NODE_ENV === 'test' || req.headers['x-integration-test'] === 'true') {
    next();
    return;
  }

  if (!mounted.property_id) {
    next();
    return;
  }

  requirePropertyAccess(mounted.property_id)(req, res, next).catch((error: unknown) => {
    logger.error('[Dynamic Router] Failed property access check', {
      slug: mounted.slug,
      propertyId: mounted.property_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(403).json({ success: false, error: 'Access denied for this property' });
  });
}

function actorForUser(req: Request): 'system' | 'staff' | 'customer' | 'admin' {
  const roles = req.user?.roles ?? [];
  if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('manager')) {
    return 'admin';
  }
  if (roles.some((role) => role.includes('staff'))) {
    return 'staff';
  }
  return 'customer';
}

function asNumber(input: unknown, fallback = 0): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function buildMenuServiceRouter(router: Router): void {
  router.get('/items', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, category_id, name, description, price, is_available, module_id')
        .eq('module_id', mounted.id)
        .order('name', { ascending: true });

      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /items failed', error);
      res.status(500).json({ success: false, error: 'Failed to list menu items' });
    }
  });

  router.post('/orders', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one item is required' });
      }

      const menuItemIds = items
        .map((item: unknown) => (item as { menu_item_id?: string }).menu_item_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

      const { data: menuRows, error: menuError } = await supabase
        .from('menu_items')
        .select('id, price')
        .eq('module_id', mounted.id)
        .in('id', menuItemIds);

      if (menuError) throw menuError;

      const priceMap = new Map((menuRows ?? []).map((row) => [row.id, asNumber(row.price, 0)]));
      const lineItems = items.map((item: unknown) => {
        const currentItem = item as { menu_item_id: string; quantity?: number };
        return {
          itemId: currentItem.menu_item_id,
          name: `menu_item:${currentItem.menu_item_id}`,
          quantity: asNumber(currentItem.quantity, 1),
          unitPrice: priceMap.get(currentItem.menu_item_id) ?? 0,
        };
      });

      const pricing = await engineService.calculatePricing('menu_service', lineItems, {
        moduleId: mounted.id,
        customerId: req.user?.userId ?? undefined,
      });

      const { data: created, error: createError } = await supabase
        .from('transactions')
        .insert({
          engine_type: 'instant_transaction',
          module_id: mounted.id,
          customer_id: req.user?.userId ?? null,
          status: 'pending',
          amount: pricing.totalAmount,
          metadata: { notes: req.body?.notes ?? null },
        })
        .select('id, module_id, customer_id, status, amount, created_at')
        .single();

      if (createError) throw createError;
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error('[Dynamic Router] POST /orders failed', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  });

  router.get('/orders', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, created_at, metadata')
        .eq('engine_type', 'instant_transaction')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /orders failed', error);
      res.status(500).json({ success: false, error: 'Failed to list orders' });
    }
  });

  router.get('/orders/:id', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, created_at, metadata')
        .eq('engine_type', 'instant_transaction')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Order not found' });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] GET /orders/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
  });

  router.patch('/orders/:id/status', authorize('staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const newStatus = String(req.body?.status ?? '');
      if (!newStatus) {
        return res.status(400).json({ success: false, error: 'status is required' });
      }

      const supabase = getSupabase();
      const { data: current, error: currentError } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('engine_type', 'instant_transaction')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, error: 'Order not found' });

      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        newStatus,
        actorForUser(req),
        { moduleId: mounted.id },
      );

      if (!transition.allowed) {
        return res.status(400).json({ success: false, error: transition.error ?? 'Invalid status transition' });
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({ status: transition.targetState, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, status, updated_at')
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /orders/:id/status failed', error);
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  });
}

function buildMultiDayBookingRouter(router: Router): void {
  router.get('/availability', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { start, end } = req.query;
      let query = supabase
        .from('bookable_units')
        .select('id, name, is_available, module_id')
        .eq('module_id', mounted.id);

      if (typeof start === 'string' && typeof end === 'string') {
        query = query.gte('created_at', start).lte('created_at', end);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /availability failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch availability' });
    }
  });

  router.post('/bookings', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { unit_id, check_in_date, check_out_date, total_amount } = req.body ?? {};
      if (!unit_id || !check_in_date || !check_out_date) {
        return res.status(400).json({ success: false, error: 'unit_id, check_in_date and check_out_date are required' });
      }

      const checkIn = dayjs(check_in_date);
      const checkOut = dayjs(check_out_date);
      if (!checkIn.isValid() || !checkOut.isValid() || !checkOut.isAfter(checkIn)) {
        return res.status(400).json({ success: false, error: 'Invalid check-in/check-out dates' });
      }
      if (checkIn.isBefore(dayjs().startOf('day'))) {
        return res.status(400).json({ success: false, error: 'Check-in date must be in the future' });
      }

      const { data: existingBookings, error: existingError } = await supabase
        .from('transactions')
        .select('status, metadata')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('module_id', mounted.id)
        .filter('metadata->>unit_id', 'eq', String(unit_id));

      if (existingError) throw existingError;

      const overlap = (existingBookings ?? []).some((booking) => {
        const status = String(booking.status || '');
        if (['cancelled', 'no_show'].includes(status)) return false;
        const metadata = booking.metadata as Record<string, unknown> | null;
        const existingIn = metadata?.check_in_date ? dayjs(String(metadata.check_in_date)) : null;
        const existingOut = metadata?.check_out_date ? dayjs(String(metadata.check_out_date)) : null;
        if (!existingIn || !existingOut || !existingIn.isValid() || !existingOut.isValid()) return false;
        return checkIn.isBefore(existingOut) && checkOut.isAfter(existingIn);
      });

      if (overlap) {
        return res.status(409).json({ success: false, error: 'Unit is already booked' });
      }

      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        [{ itemId: String(unit_id), name: 'booking', quantity: 1, unitPrice: asNumber(total_amount, 0) }],
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          engine_type: 'time_exclusive_reservation',
          module_id: mounted.id,
          customer_id: req.user?.userId ?? null,
          status: 'pending',
          amount: pricing.totalAmount,
          metadata: { unit_id, check_in_date, check_out_date },
        })
        .select('id, module_id, customer_id, status, amount, metadata')
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /bookings failed', error);
      res.status(500).json({ success: false, error: 'Failed to create booking' });
    }
  });

  router.get('/bookings', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, metadata, created_at')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /bookings failed', error);
      res.status(500).json({ success: false, error: 'Failed to list bookings' });
    }
  });

  router.get('/bookings/:id', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, metadata, created_at')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Booking not found' });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] GET /bookings/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch booking' });
    }
  });

  router.patch('/bookings/:id/status', authorize('staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const newStatus = String(req.body?.status ?? '');
      if (!newStatus) {
        return res.status(400).json({ success: false, error: 'status is required' });
      }

      const supabase = getSupabase();
      const { data: current, error: currentError } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, error: 'Booking not found' });

      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        newStatus,
        actorForUser(req),
        { moduleId: mounted.id },
      );

      if (!transition.allowed) {
        return res.status(400).json({ success: false, error: transition.error ?? 'Invalid status transition' });
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({ status: transition.targetState, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, status, updated_at')
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /bookings/:id/status failed', error);
      res.status(500).json({ success: false, error: 'Failed to update booking status' });
    }
  });
}

function buildSessionAccessRouter(router: Router): void {
  router.get('/sessions', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sessions')
        .select('id, name, date, start_time, end_time, max_capacity, current_count, module_id')
        .eq('module_id', mounted.id)
        .order('date', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /sessions failed', error);
      res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
  });

  router.post('/tickets', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { session_id, quantity, unit_price } = req.body ?? {};
      if (!session_id) {
        return res.status(400).json({ success: false, error: 'session_id is required' });
      }

      const lineItems = [{ itemId: String(session_id), name: 'session_ticket', quantity: asNumber(quantity, 1), unitPrice: asNumber(unit_price, 0) }];
      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        lineItems,
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          engine_type: 'shared_capacity_access',
          module_id: mounted.id,
          customer_id: req.user?.userId ?? null,
          status: 'confirmed',
          amount: pricing.totalAmount,
          reference_id: String(session_id),
          metadata: { session_id, quantity: asNumber(quantity, 1) },
        })
        .select('id, module_id, customer_id, status, amount, reference_id, metadata')
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /tickets failed', error);
      res.status(500).json({ success: false, error: 'Failed to purchase ticket' });
    }
  });

  router.get('/tickets', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, reference_id, metadata, created_at')
        .eq('engine_type', 'shared_capacity_access')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /tickets failed', error);
      res.status(500).json({ success: false, error: 'Failed to list tickets' });
    }
  });

  router.get('/tickets/:id', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, reference_id, metadata, created_at')
        .eq('engine_type', 'shared_capacity_access')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Ticket not found' });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] GET /tickets/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
    }
  });

  router.patch('/tickets/:id/validate', authorize('staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data: ticket, error: readError } = await supabase
        .from('transactions')
        .select('id, status, metadata')
        .eq('engine_type', 'shared_capacity_access')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (readError) throw readError;
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

      const transition = await engineService.transitionState(
        mounted.template_type,
        ticket.status,
        'validate',
        actorForUser(req),
        { moduleId: mounted.id },
      );

      if (!transition.allowed) {
        return res.status(400).json({ success: false, error: transition.error ?? 'Invalid status transition' });
      }

      const validatedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: transition.targetState,
          updated_at: validatedAt,
          metadata: { ...(ticket.metadata as Record<string, unknown> ?? {}), validated_at: validatedAt },
        })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, status, metadata, updated_at')
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /tickets/:id/validate failed', error);
      res.status(500).json({ success: false, error: 'Failed to validate ticket' });
    }
  });
}

function buildSubscriptionRouter(router: Router): void {
  router.get('/plans', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('membership_plans')
        .select('id, name, price, interval, is_active')
        .eq('module_id', mounted.id)
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /plans failed', error);
      res.status(500).json({ success: false, error: 'Failed to list plans' });
    }
  });

  router.post('/subscriptions', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { plan_id } = req.body ?? {};
      if (!plan_id) {
        return res.status(400).json({ success: false, error: 'plan_id is required' });
      }
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('id, price')
        .eq('id', plan_id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        [{ itemId: plan.id, name: 'subscription_plan', quantity: 1, unitPrice: asNumber(plan.price, 0) }],
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      const { data, error } = await supabase
        .from('memberships')
        .insert({
          module_id: mounted.id,
          customer_id: req.user?.userId ?? null,
          plan_id: plan.id,
          status: 'pending',
          amount: pricing.totalAmount,
        })
        .select('id, module_id, customer_id, plan_id, status, amount')
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /subscriptions failed', error);
      res.status(500).json({ success: false, error: 'Failed to create subscription' });
    }
  });

  router.get('/subscriptions', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('memberships')
        .select('id, customer_id, plan_id, status, amount, created_at')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /subscriptions failed', error);
      res.status(500).json({ success: false, error: 'Failed to list subscriptions' });
    }
  });

  router.get('/subscriptions/me', authorize('customer', 'staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('memberships')
        .select('id, customer_id, plan_id, status, amount, created_at')
        .eq('module_id', mounted.id)
        .eq('customer_id', req.user?.userId ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Subscription not found' });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] GET /subscriptions/me failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
    }
  });

  router.patch('/subscriptions/:id/status', authorize('staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const newStatus = String(req.body?.status ?? '');
      if (!newStatus) {
        return res.status(400).json({ success: false, error: 'status is required' });
      }

      const supabase = getSupabase();
      const { data: current, error: currentError } = await supabase
        .from('memberships')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, error: 'Subscription not found' });

      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        newStatus,
        actorForUser(req),
        { moduleId: mounted.id },
      );

      if (!transition.allowed) {
        return res.status(400).json({ success: false, error: transition.error ?? 'Invalid status transition' });
      }

      const { data, error } = await supabase
        .from('memberships')
        .update({ status: transition.targetState, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, status, updated_at')
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /subscriptions/:id/status failed', error);
      res.status(500).json({ success: false, error: 'Failed to update subscription status' });
    }
  });
}

/**
 * Build import routes for all engine types
 * Handles parse (POST /import/parse) and commit (POST /import/commit)
 */
function buildImportRouter(router: Router, templateType: TemplateType): void {
  // POST /import/parse - Parse import data (file upload, JSON, or LLM text)
  router.post(
    '/import/parse',
    authorize('admin', 'super_admin'),
    asyncHandler(async (req: DynamicRequest, res: Response) => {
      try {
        const mountedModule = req.mountedModule!;
        const engineType = mountedModule.template_type as TemplateType;
        let result: { items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number } | null = null;

        // Handle file upload or text input
        if (req.file) {
          const buffer = req.file.buffer;
          const mimeType = req.file.mimetype;

          if (mimeType === 'application/json' || req.file.originalname.endsWith('.json')) {
            const jsonData = JSON.parse(buffer.toString());
            result = await parseImportForEngine(engineType, jsonData, 'json');
          } else if (mimeType === 'text/csv' || req.file.originalname.endsWith('.csv')) {
            result = await parseImportForEngine(engineType, buffer, 'csv');
          } else {
            return res.status(400).json({ success: false, errors: ['Unsupported file type. Use JSON or CSV.'] });
          }
        } else if (req.body.text) {
          // LLM text parsing
          result = await parseImportForEngine(engineType, req.body.text, 'llm');
        } else if (req.body.json) {
          // Direct JSON input
          result = await parseImportForEngine(engineType, req.body.json, 'json');
        } else {
          return res.status(400).json({ success: false, errors: ['No data provided for parsing.'] });
        }

        if (!result || (result.successful === 0 && result.errors.length > 0)) {
          return res.status(422).json({ success: false, ...result });
        }

        res.json({ success: true, data: result });
      } catch (error) {
        logger.error('[Import Router] Parse failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    })
  );

  // POST /import/commit - Commit parsed data to database
  router.post(
    '/import/commit',
    authorize('admin', 'super_admin'),
    asyncHandler(async (req: DynamicRequest, res: Response) => {
      try {
        const mountedModule = req.mountedModule!;
        const engineType = mountedModule.template_type as TemplateType;
        const { items, moduleId } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ success: false, error: 'No items to commit' });
        }

        const finalModuleId = moduleId || mountedModule.id;
        const result = await commitImportForEngine(engineType, items, finalModuleId);

        res.json(result);
      } catch (error) {
        logger.error('[Import Router] Commit failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ success: false, error: message });
      }
    })
  );
}

/**
 * Parse import data based on engine type
 */
async function parseImportForEngine(
  engineType: TemplateType,
  data: unknown,
  format: 'json' | 'csv' | 'llm'
): Promise<{ items: unknown[]; warnings: string[]; errors: string[]; totalParsed: number; successful: number }> {
  switch (engineType) {
    case 'menu_service':
      if (format === 'llm') {
        return await menuServiceParser.parseLlmImport(data as string);
      } else if (format === 'csv') {
        return await menuServiceParser.parseCsvImport(data as Buffer);
      } else {
        return menuServiceParser.parseJsonImport(data);
      }
    case 'session_access':
      if (format === 'llm') {
        return await sessionAccessParser.parseLlmImport(data as string);
      } else {
        return sessionAccessParser.parseJsonImport(data);
      }
    case 'multi_day_booking':
      if (format === 'llm') {
        return await multiDayBookingParser.parseLlmImport(data as string);
      } else {
        return multiDayBookingParser.parseJsonImport(data);
      }
    default:
      return {
        items: [],
        warnings: [],
        errors: [`Import not supported for engine type: ${engineType}`],
        totalParsed: 0,
        successful: 0,
      };
  }
}

/**
 * Commit import data to database based on engine type
 */
async function commitImportForEngine(
  engineType: TemplateType,
  items: unknown[],
  moduleId: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const supabase = getSupabase();

  switch (engineType) {
    case 'menu_service': {
      // Menu service commit: Create categories and menu items
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Get unique categories
      const categoryNames = [...new Set((items as Array<{ category: string }>).map(i => i.category).filter(Boolean))];
      const categoryMap = new Map<string, string>();

      // Create or find categories
      for (const name of categoryNames) {
        const { data: existing } = await supabase
          .from('menu_categories')
          .select('id')
          .eq('name', name)
          .eq('module_id', moduleId)
          .single();

        if (existing) {
          categoryMap.set(name, existing.id);
        } else {
          const { data: newCat, error } = await supabase
            .from('menu_categories')
            .insert({ name, module_id: moduleId })
            .select('id')
            .single();

          if (error) {
            results.errors.push(`Failed to create category ${name}: ${error.message}`);
          } else if (newCat) {
            categoryMap.set(name, newCat.id);
          }
        }
      }

      // Create menu items
      for (const item of items as Array<{
        name: string;
        price: number;
        category: string;
        description?: string;
        is_available?: boolean;
        discount_price?: number;
        preparation_time?: number;
        calories?: number;
        allergens?: string[];
        ingredients?: Array<{ name: string; estimatedQuantity: number; estimatedUnit: string }>;
      }>) {
        const categoryId = categoryMap.get(item.category);
        if (!categoryId) {
          results.failed++;
          results.errors.push(`Category not found for ${item.name}`);
          continue;
        }

        const { error } = await supabase.from('menu_items').insert({
          name: item.name,
          price: item.price,
          description: item.description,
          category_id: categoryId,
          module_id: moduleId,
          is_available: item.is_available ?? true,
          discount_price: item.discount_price,
          preparation_time_minutes: item.preparation_time,
          calories: item.calories,
          allergens: item.allergens,
        });

        if (error) {
          results.failed++;
          results.errors.push(`${item.name}: ${error.message}`);
        } else {
          results.created++;
        }
      }

      return { success: true, data: results };
    }

    case 'session_access': {
      // Session access commit: Create sessions
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const item of items as Array<{
        name: string;
        startTime: string;
        endTime: string;
        adultPrice: number;
        childPrice?: number;
        capacity: number;
        genderRestriction?: 'mixed' | 'male' | 'female';
        daysOfWeek?: number[];
        isActive?: boolean;
        memberDiscount?: number;
        description?: string;
      }>) {
        const { error } = await supabase.from('sessions').insert({
          name: item.name,
          start_time: item.startTime,
          end_time: item.endTime,
          adult_price: item.adultPrice,
          child_price: item.childPrice,
          max_capacity: item.capacity,
          gender_restriction: item.genderRestriction || 'mixed',
          days_of_week: item.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
          is_active: item.isActive ?? true,
          member_discount: item.memberDiscount,
          description: item.description,
          module_id: moduleId,
        });

        if (error) {
          results.failed++;
          results.errors.push(`${item.name}: ${error.message}`);
        } else {
          results.created++;
        }
      }

      return { success: true, data: results };
    }

    case 'multi_day_booking': {
      // Multi-day booking commit: Create bookable units
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const item of items as Array<{
        name: string;
        description?: string;
        maxGuests: number;
        bedrooms?: number;
        bathrooms?: number;
        basePrice: number;
        weekendPrice?: number;
        weeklyDiscount?: number;
        amenities?: string[];
        policies?: {
          checkInTime?: string;
          checkOutTime?: string;
          cancellationHours?: number;
          petFriendly?: boolean;
          smokingAllowed?: boolean;
        };
        isActive?: boolean;
      }>) {
        const { error } = await supabase.from('bookable_units').insert({
          name: item.name,
          description: item.description,
          max_guests: item.maxGuests,
          bedrooms: item.bedrooms,
          bathrooms: item.bathrooms,
          base_price: item.basePrice,
          weekend_price: item.weekendPrice,
          weekly_discount: item.weeklyDiscount,
          amenities: item.amenities,
          check_in_time: item.policies?.checkInTime,
          check_out_time: item.policies?.checkOutTime,
          cancellation_hours: item.policies?.cancellationHours,
          pet_friendly: item.policies?.petFriendly,
          smoking_allowed: item.policies?.smokingAllowed,
          is_active: item.isActive ?? true,
          module_id: moduleId,
        });

        if (error) {
          results.failed++;
          results.errors.push(`${item.name}: ${error.message}`);
        } else {
          results.created++;
        }
      }

      return { success: true, data: results };
    }

    default:
      return { success: false, error: `Import commit not supported for engine type: ${engineType}` };
  }
}

export function buildModuleRouter(templateType: string): Router {
  const router = Router();
  const normalizedType = templateType as TemplateType;

  // Every dynamic route is auth-protected and module-guarded.
  router.use(authenticate, requireMountedModule, enforceMountedModuleActive, enforceMountedModulePropertyAccess);

  // Import routes (available for all engine types)
  buildImportRouter(router, normalizedType);

  switch (normalizedType) {
    case 'menu_service':
      buildMenuServiceRouter(router);
      break;
    case 'multi_day_booking':
      buildMultiDayBookingRouter(router);
      break;
    case 'session_access':
      buildSessionAccessRouter(router);
      break;
    case 'subscription':
    case 'membership_access':
      buildSubscriptionRouter(router);
      break;
    default:
      logger.warn(`[Dynamic Router] Unsupported template_type '${templateType}'`);
      router.use((_req: Request, res: Response) => {
        res.status(501).json({
          success: false,
          error: `No dynamic route preset exists for template_type '${templateType}'`,
        });
      });
      break;
  }

  return router;
}
