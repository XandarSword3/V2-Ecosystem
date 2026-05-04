import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireModule } from '../middleware/moduleGuard.middleware.js';
import { getSupabase } from '../database/connection.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';
import { requirePropertyAccess } from '../middleware/propertyAccess.middleware.js';

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
        .from('orders')
        .insert({
          module_id: mounted.id,
          customer_id: req.user?.userId ?? null,
          status: 'pending',
          total_amount: pricing.totalAmount,
          notes: req.body?.notes ?? null,
        })
        .select('id, module_id, customer_id, status, total_amount, created_at')
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
        .from('orders')
        .select('id, customer_id, status, total_amount, created_at')
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
        .from('orders')
        .select('id, customer_id, status, total_amount, created_at')
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
        .from('orders')
        .select('id, status')
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
        .from('orders')
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

      const pricing = await engineService.calculatePricing(
        mounted.template_type,
        [{ itemId: String(unit_id), name: 'booking', quantity: 1, unitPrice: asNumber(total_amount, 0) }],
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          module_id: mounted.id,
          unit_id,
          customer_id: req.user?.userId ?? null,
          check_in_date,
          check_out_date,
          status: 'pending',
          total_amount: pricing.totalAmount,
        })
        .select('id, module_id, unit_id, customer_id, status, total_amount')
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
        .from('bookings')
        .select('id, unit_id, customer_id, status, total_amount, check_in_date, check_out_date')
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
        .from('bookings')
        .select('id, unit_id, customer_id, status, total_amount, check_in_date, check_out_date')
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
        .from('bookings')
        .select('id, status')
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
        .from('bookings')
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
        .from('tickets')
        .insert({
          module_id: mounted.id,
          session_id,
          customer_id: req.user?.userId ?? null,
          status: 'valid',
          total_amount: pricing.totalAmount,
        })
        .select('id, module_id, session_id, customer_id, status, total_amount')
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
        .from('tickets')
        .select('id, session_id, customer_id, status, total_amount, created_at')
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
        .from('tickets')
        .select('id, session_id, customer_id, status, total_amount, created_at')
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
        .from('tickets')
        .select('id, status')
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

      const { data, error } = await supabase
        .from('tickets')
        .update({ status: transition.targetState, validated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, status, validated_at')
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

export function buildModuleRouter(templateType: string): Router {
  const router = Router();
  const normalizedType = templateType as TemplateType;

  // Every dynamic route is auth-protected and module-guarded.
  router.use(authenticate, requireMountedModule, enforceMountedModuleActive, enforceMountedModulePropertyAccess);

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
