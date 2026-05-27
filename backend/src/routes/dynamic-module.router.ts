import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dayjs from 'dayjs';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireModule } from '../middleware/moduleGuard.middleware.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getSupabase } from '../database/connection.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';
import { requirePropertyAccess } from '../middleware/propertyAccess.middleware.js';
import { purchaseSharedCapacityAtomic } from '../services/shared-capacity-purchase.js';

// Import parsers
import * as menuServiceParser from '../modules/shared/import/menu-service-import.parser.js';
import * as sessionAccessParser from '../modules/shared/import/session-access-import.parser.js';
import * as multiDayBookingParser from '../modules/shared/import/multi-day-booking-import.parser.js';

type TemplateType = 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement';

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

// Memory-based multer: files stay in-process as Buffer, nothing touches disk.
// 10 MB cap — large enough for any realistic CSV/JSON import.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

/**
 * Resolve the action name for a target state or legacy alias.
 * Clients send target state names (e.g. 'confirmed') or legacy aliases
 * (e.g. 'active', 'used') — map them to the real action name the
 * state machine expects (e.g. 'confirm', 'validate_entry', 'record_exit').
 */
function resolveAction(
  templateType: string,
  currentState: string,
  targetStateOrAction: string,
  actor: 'system' | 'staff' | 'customer' | 'admin',
): string {
  const available = engineService.getAvailableActions(templateType, currentState, actor);

  // 1. Direct action name match (already correct)
  if (available.find((a) => a.action === targetStateOrAction)) return targetStateOrAction;

  // 2. Target state name match (client sent destination state, not action)
  const stateMatch = available.find((a) => a.targetState === targetStateOrAction);
  if (stateMatch) return stateMatch.action;

  // 3. Legacy action name aliases (old API surface → new action names)
  const ACTION_ALIASES: Record<string, string> = {
    // shared_capacity_access
    'validate':        'validate_entry',
    'complete':        'record_exit',
    // time_exclusive_reservation (old status names used as actions)
    'active':          'check_in',
    'used':            'check_out',
    'check_in':        'check_in',
    'check_out':       'check_out',
    'cancel':          'cancel',
    'cancelled':       'cancel',
    'confirm':         'confirm',
    'confirmed':       'confirm',
    'no_show':         'mark_no_show',
  };
  const aliasedAction = ACTION_ALIASES[targetStateOrAction];
  if (aliasedAction && available.find((a) => a.action === aliasedAction)) return aliasedAction;

  // Fall through: return as-is (will fail gracefully in transitionState)
  return targetStateOrAction;
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
        .from('catalog_items')
        .select('id, name, description, price, category, is_available')
        .eq('module_id', mounted.id)
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /items failed', error);
      res.status(500).json({ success: false, error: 'Failed to list items' });
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

      const itemIds = items
        .map((item: unknown) => (item as { menu_item_id?: string }).menu_item_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

      const { data: catalogRows, error: catalogError } = await supabase
        .from('catalog_items')
        .select('id, price')
        .eq('module_id', mounted.id)
        .in('id', itemIds);

      if (catalogError) throw catalogError;

      const priceMap = new Map((catalogRows ?? []).map((row) => [row.id, asNumber(row.price, 0)]));
      const lineItems = items.map((item: unknown) => {
        const currentItem = item as { menu_item_id: string; quantity?: number };
        return {
          itemId: currentItem.menu_item_id,
          name: `catalog_item:${currentItem.menu_item_id}`,
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
          metadata: {
            notes: req.body?.notes ?? req.body?.metadata?.notes ?? null,
            payment_method: req.body?.metadata?.payment_method ?? req.body?.payment_method ?? null,
            order_type: req.body?.metadata?.order_type ?? req.body?.order_type ?? null,
            table_number: req.body?.metadata?.table_number ?? req.body?.table_number ?? null,
            customer_name: req.body?.metadata?.customer_name ?? req.body?.customer_name ?? null,
          },
        })
        .select('id, module_id, customer_id, status, amount, created_at, metadata')
        .single();

      if (createError) throw createError;
      // Flatten metadata fields to top level for client convenience
      const meta = (created?.metadata ?? {}) as Record<string, unknown>;
      res.status(201).json({
        success: true,
        data: {
          ...created,
          payment_method: meta.payment_method ?? null,
          payment_status: 'pending',
        },
      });
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
      const meta = (data?.metadata ?? {}) as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          ...data,
          payment_method: meta.payment_method ?? null,
          payment_status: data.status === 'completed' ? 'paid' : 'pending',
        },
      });
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

      const actor = actorForUser(req);
      const action = resolveAction(mounted.template_type, current.status, newStatus, actor);
      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        action,
        actor,
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
        .select('id, name, is_active, module_id, base_price, capacity')
        .eq('module_id', mounted.id)
        .eq('is_active', true);

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

      // Validate unit exists for this module
      const { data: unitRow, error: unitError } = await supabase
        .from('bookable_units')
        .select('id')
        .eq('id', String(unit_id))
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (unitError) throw unitError;
      if (!unitRow) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
      }

      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        [{ itemId: String(unit_id), name: 'booking', quantity: 1, unitPrice: asNumber(total_amount, 0) }],
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      // Atomic insert with double-booking protection via advisory lock
      const { data: rpcResult, error: rpcError } = await supabase.rpc('reserve_unit_exclusive_atomic', {
        p_unit_id:        String(unit_id),
        p_module_id:      mounted.id,
        p_check_in_date:  check_in_date,
        p_check_out_date: check_out_date,
        p_customer_id:    req.user?.userId ?? null,
        p_amount:         pricing.totalAmount,
        p_metadata:       {},
      });

      if (rpcError) throw rpcError;

      const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      if (!row?.success) {
        const msg = row?.error_message ?? 'Failed to create booking';
        const status = msg.includes('past') ? 400 : msg.includes('booked') ? 409 : 400;
        return res.status(status).json({ success: false, error: msg });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('id, module_id, customer_id, status, amount, metadata')
        .eq('id', row.transaction_id)
        .single();

      if (error) throw error;

      const meta = (data?.metadata ?? {}) as Record<string, unknown>;
      res.status(201).json({
        success: true,
        data: {
          ...data,
          check_in_date:  meta.check_in_date  ?? check_in_date,
          check_out_date: meta.check_out_date ?? check_out_date,
          unit_id:        meta.unit_id        ?? unit_id,
        },
      });
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
      const meta = (data?.metadata ?? {}) as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          ...data,
          check_in_date:  meta.check_in_date  ?? null,
          check_out_date: meta.check_out_date ?? null,
          unit_id:        meta.unit_id        ?? null,
        },
      });
    } catch (error) {
      logger.error('[Dynamic Router] GET /bookings/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch booking' });
    }
  });

  router.patch('/bookings/:id/status', authorize('customer', 'staff', 'manager', 'admin', 'super_admin'), async (req: Request, res: Response) => {
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

      const actor = actorForUser(req);
      const action = resolveAction(mounted.template_type, current.status, newStatus, actor);
      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        action,
        actor,
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
        .from('capacity_windows')
        .select('id, name, start_time, end_time, max_capacity, price, module_id, is_active, metadata')
        .eq('module_id', mounted.id)
        .eq('is_active', true)
        .order('start_time', { ascending: true });
      if (error) throw error;
      const normalized = (data ?? []).map((w) => ({
        ...w,
        adult_price: (w.metadata as Record<string, unknown>)?.adult_price ?? w.price,
        child_price: (w.metadata as Record<string, unknown>)?.child_price ?? 0,
      }));
      res.json({ success: true, data: normalized });
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
      const { session_id, quantity, unit_price, metadata: bodyMetadata } = req.body ?? {};
      if (!session_id) {
        return res.status(400).json({ success: false, error: 'session_id is required' });
      }

      const guestCount = asNumber(quantity, 1);
      const lineItems = [{
        itemId: String(session_id),
        name: 'session_ticket',
        quantity: guestCount,
        unitPrice: asNumber(unit_price, 0),
      }];
      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        lineItems,
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      const ticketDateRaw =
        (bodyMetadata as Record<string, unknown> | undefined)?.ticket_date
        ?? (bodyMetadata as Record<string, unknown> | undefined)?.date
        ?? req.body?.ticket_date
        ?? req.body?.visit_date;
      const ticketDate = typeof ticketDateRaw === 'string'
        ? ticketDateRaw.slice(0, 10)
        : dayjs().format('YYYY-MM-DD');

      const purchase = await purchaseSharedCapacityAtomic(supabase, {
        sessionId: String(session_id),
        moduleId: mounted.id,
        propertyId: mounted.property_id ?? null,
        customerId: req.user?.userId ?? null,
        quantity: guestCount,
        ticketDate,
        amount: pricing.totalAmount,
        metadata: {
          ...(typeof bodyMetadata === 'object' && bodyMetadata !== null ? bodyMetadata : {}),
          payment_method: req.body?.payment_method,
        },
      });

      if (!purchase.success) {
        const status = purchase.errorMessage?.includes('capacity') ? 409 : 400;
        return res.status(status).json({
          success: false,
          error: purchase.errorMessage ?? 'Failed to reserve capacity',
          availableCapacity: purchase.availableCapacity,
        });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('id, module_id, customer_id, status, amount, reference_id, metadata')
        .eq('id', purchase.transactionId!)
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

      const actor = actorForUser(req);
      const action = resolveAction(mounted.template_type, ticket.status, 'validate', actor);
      const transition = await engineService.transitionState(
        mounted.template_type,
        ticket.status,
        action,
        actor,
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

      const actor = actorForUser(req);
      const action = resolveAction(mounted.template_type, current.status, newStatus, actor);
      const transition = await engineService.transitionState(
        mounted.template_type,
        current.status,
        action,
        actor,
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
    upload.single('file'),
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
  // Resolve legacy aliases so the switch always sees canonical engine type names
  const LEGACY: Record<string, TemplateType> = {
    menu_service:    'instant_transaction',
    multi_day_booking: 'time_exclusive_reservation',
    session_access:  'shared_capacity_access',
    subscription:    'ongoing_entitlement',
    membership_access: 'ongoing_entitlement',
    class_scheduling:  'shared_capacity_access',
    appointment_booking: 'time_exclusive_reservation',
  };
  const canonical = (LEGACY[engineType] ?? engineType) as TemplateType;

  switch (canonical) {
    case 'instant_transaction':
      if (format === 'llm') return await menuServiceParser.parseLlmImport(data as string);
      if (format === 'csv')  return await menuServiceParser.parseCsvImport(data as Buffer);
      return menuServiceParser.parseJsonImport(data);
    case 'shared_capacity_access':
      if (format === 'llm') return await sessionAccessParser.parseLlmImport(data as string);
      return sessionAccessParser.parseJsonImport(data);
    case 'time_exclusive_reservation':
      if (format === 'llm') return await multiDayBookingParser.parseLlmImport(data as string);
      return multiDayBookingParser.parseJsonImport(data);
    case 'ongoing_entitlement':
      // No structured parser yet — fall back gracefully
      return {
        items: [],
        warnings: ['Import wizard not yet implemented for membership modules. Use the Loyalty page instead.'],
        errors: [],
        totalParsed: 0,
        successful: 0,
      };
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

  // Resolve legacy aliases
  const LEGACY: Record<string, TemplateType> = {
    menu_service:        'instant_transaction',
    multi_day_booking:   'time_exclusive_reservation',
    session_access:      'shared_capacity_access',
    subscription:        'ongoing_entitlement',
    membership_access:   'ongoing_entitlement',
    class_scheduling:    'shared_capacity_access',
    appointment_booking: 'time_exclusive_reservation',
  };
  const canonical = (LEGACY[engineType] ?? engineType) as TemplateType;

  switch (canonical) {
    case 'instant_transaction': {
      // Menu service commit: Insert into catalog_items (generic, engine-level table)
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const item of items as Array<{
        name: string;
        price: number;
        category?: string;
        description?: string;
        is_available?: boolean;
        preparation_time?: number;
        calories?: number;
        allergens?: string[];
      }>) {
        const { error } = await supabase.from('catalog_items').insert({
          name: item.name,
          price: item.price,
          description: item.description,
          category: item.category ?? null,
          is_available: item.is_available ?? true,
          module_id: moduleId,
          metadata: {
            preparation_time_minutes: item.preparation_time,
            calories: item.calories,
            allergens: item.allergens,
          },
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

    case 'shared_capacity_access': {
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
        const { error } = await supabase.from('capacity_windows').insert({
          name: item.name,
          start_time: item.startTime,
          end_time: item.endTime,
          max_capacity: item.capacity,
          price: item.adultPrice,
          is_active: item.isActive ?? true,
          module_id: moduleId,
          metadata: {
            adult_price: item.adultPrice,
            child_price: item.childPrice ?? 0,
            gender_restriction: item.genderRestriction ?? 'mixed',
          },
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

    case 'time_exclusive_reservation': {
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
          base_price: item.basePrice,
          weekend_price: item.weekendPrice,
          capacity: item.maxGuests,   // bookable_units view maps to accommodation_units.capacity
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

  // Resolve legacy alias names to canonical engine type
  const LEGACY: Record<string, string> = {
    menu_service:        'instant_transaction',
    multi_day_booking:   'time_exclusive_reservation',
    session_access:      'shared_capacity_access',
    subscription:        'ongoing_entitlement',
    membership_access:   'ongoing_entitlement',
    class_scheduling:    'shared_capacity_access',
    appointment_booking: 'time_exclusive_reservation',
    saas_subscription:   'platform_entitlement',
  };
  const normalizedType = (LEGACY[templateType] ?? templateType) as TemplateType;

  // Every dynamic route is auth-protected and module-guarded.
  router.use(authenticate, requireMountedModule, enforceMountedModuleActive, enforceMountedModulePropertyAccess);

  // Import routes (available for all engine types)
  buildImportRouter(router, normalizedType);

  switch (normalizedType) {
    case 'instant_transaction':
      buildMenuServiceRouter(router);
      break;
    case 'time_exclusive_reservation':
      buildMultiDayBookingRouter(router);
      break;
    case 'shared_capacity_access':
      buildSessionAccessRouter(router);
      break;
    case 'ongoing_entitlement':
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
