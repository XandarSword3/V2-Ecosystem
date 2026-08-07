import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dayjs from 'dayjs';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { requireModule, getModuleStatus } from '../middleware/moduleGuard.middleware.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getSupabase } from '../database/connection.js';
import { getEngineService } from '../engines/engine-service.js';
import { logger } from '../utils/logger.js';
import { requirePropertyAccess } from '../middleware/propertyAccess.middleware.js';
import { purchaseSharedCapacityAtomic } from '../services/shared-capacity-purchase.js';
import { computeStayBaseAmount } from '../utils/stay-pricing.js';
import { resolveTaxCategory } from '../services/tax.service.js';
import { generateQRCodeImage, validatePayload } from '../utils/qr-security.js';
import { customizationService } from '../modules/customization/services/customization.service.js';
import { linkDiscountsToOrder, reverseDiscounts } from '../engines/discount-reversal.js';
import { actorForUser, resolveAction, changeInstantTransactionOrderStatus } from '../engines/order-status.service.js';
import { emitToUnit } from '../socket/index.js';
import {
  createReservationHandler,
  getReservationsDayHandler,
  assignTableHandler,
  checkInHandler,
  cancelHandler,
  noShowHandler,
  reassignStaffHandler,
} from '../modules/reservations/reservations.routes.js';
import { getReservationsForDay } from '../modules/reservations/reservations.service.js';
import { submitProductReview, submitStaffReview, getProductItemRating } from '../modules/reviews/reviews.service.js';

// Import parsers
import * as instantTransactionParser from '../modules/shared/import/instant-transaction-import.parser.js';
import * as sharedCapacityAccessParser from '../modules/shared/import/shared-capacity-access-import.parser.js';
import * as timeExclusiveReservationParser from '../modules/shared/import/time-exclusive-reservation-import.parser.js';
type TemplateType = 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement' | 'platform_entitlement';
interface MountedModuleContext {
  id: string;
  slug: string;
  engine_type: string;
  property_id?: string | null;
  tenant_id?: string | null;
  require_reservation?: boolean | null;
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
async function getTenantIdForMountedModule(mounted: MountedModuleContext): Promise<string | null> {
  if (mounted.tenant_id) return mounted.tenant_id;
  if (mounted.property_id) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', mounted.property_id)
      .maybeSingle();
    return data?.tenant_id ?? null;
  }
  return null;
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
  // For public routes (no auth), use tenant from tenantGate middleware
  // For authenticated routes, use tenant from JWT
  const tenantId = (req as any).tenant?.id || mounted.tenant_id || null;
  // Direct module status check instead of using requireModule which requires auth
  getModuleStatus(mounted.slug, tenantId).then((isActive) => {
    if (!isActive) {
      logger.info(`Blocked request to disabled module: ${mounted.slug}, path: ${req.path}`);
      return res.status(503).json({
        success: false,
        error: 'This feature is currently unavailable',
        code: 'MODULE_DISABLED',
      });
    }
    next();
  }).catch((error: unknown) => {
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
/**
 * Defense-in-depth ownership check for write routes on the dynamic module
 * router. `enforceMountedModulePropertyAccess` above already runs for every
 * route via router.use(), but it is a no-op (calls next() unconditionally)
 * whenever the mounted module has no property_id — which is a real,
 * reachable state per dynamic-modules.loader.ts (property_id is read
 * straight from the nullable `modules.property_id` column). For write
 * routes specifically, that gap means any authenticated staff account from
 * any tenant could otherwise create/update/delete rows on someone else's
 * module by slug.
 *
 * This does not retrofit the other ~15 pre-existing dynamic-router routes
 * (out of scope for Phase 3 — see REFIT_PLAN.md open question). It only
 * covers the new service_locations routes.
 *
 * When property_id IS set, this duplicates enforceMountedModulePropertyAccess's
 * check — intentional belt-and-suspenders, not a substitute for fixing the
 * router-level gap itself.
 *
 * Deliberately compares against req.user.tenantId (from the verified JWT),
 * never req.tenant.id (resolved from the client-supplied X-Tenant-ID /
 * X-Tenant-Slug header) — see the 2026-07-02 validatePropertyAccess fix for
 * why trusting the latter for authorization is unsafe.
 */
function enforceServiceLocationOwnership(req: Request, res: Response, next: NextFunction): void {
  const mounted = getMountedModule(req);
  if (!mounted) {
    res.status(500).json({ success: false, error: 'Mounted module context is missing' });
    return;
  }
  if (req.user?.roles?.includes('super_admin')) {
    next();
    return;
  }
  if (mounted.property_id) {
    requirePropertyAccess(mounted.property_id)(req, res, next).catch((error: unknown) => {
      logger.error('[Dynamic Router] service_locations property ownership check failed', {
        slug: mounted.slug,
        propertyId: mounted.property_id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(403).json({ success: false, error: 'Access denied for this property' });
    });
    return;
  }
  // No property_id on this module — fall back to a tenant-level check.
  getTenantIdForMountedModule(mounted)
    .then((tenantId) => {
      if (!tenantId) {
        res.status(403).json({ success: false, error: 'Access denied: module has no resolvable tenant or property scope' });
        return;
      }
      if (req.user?.tenantId && req.user.tenantId === tenantId) {
        next();
        return;
      }
      logger.warn('[Dynamic Router] service_locations tenant ownership denied', {
        slug: mounted.slug,
        moduleTenantId: tenantId,
        userTenantId: req.user?.tenantId,
      });
      res.status(403).json({ success: false, error: 'Access denied for this tenant' });
    })
    .catch((error: unknown) => {
      logger.error('[Dynamic Router] service_locations tenant ownership check failed', {
        slug: mounted.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ success: false, error: 'Unable to validate module access' });
    });
}


function asNumber(input: unknown, fallback = 0): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}
// instant_transaction terminal states (engines/definitions/instant-transaction.ts).
// A location counts as occupied when it has any order NOT in one of these.
const INSTANT_TRANSACTION_TERMINAL_STATES = ['completed', 'cancelled'];
interface ServiceLocationRow {
  id: string;
  name: string;
  qr_code: string | null;
  is_active: boolean;
  sort_order: number;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
}
/**
 * Fetch a module's service_locations with occupancy derived from active
 * (non-terminal) transactions, in two queries total regardless of how many
 * locations exist (no N+1).
 */
async function fetchServiceLocationsWithOccupancy(moduleId: string) {
  const supabase = getSupabase();
  const { data: locations, error: locationsError } = await supabase
    .from('service_locations')
    .select('id, name, qr_code, is_active, sort_order, assigned_staff_id, created_at, updated_at')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });
  if (locationsError) throw locationsError;
  const rows = (locations ?? []) as ServiceLocationRow[];
  if (rows.length === 0) return [];
  const locationIds = rows.map((row) => row.id);
  const { data: activeOrders, error: ordersError } = await supabase
    .from('transactions')
    .select('service_location_id')
    .eq('module_id', moduleId)
    .eq('engine_type', 'instant_transaction')
    .in('service_location_id', locationIds)
    .not('status', 'in', `(${INSTANT_TRANSACTION_TERMINAL_STATES.join(',')})`);
  if (ordersError) throw ordersError;
  const occupiedIds = new Set((activeOrders ?? []).map((row) => row.service_location_id as string));
  return rows.map((row) => ({
    ...row,
    is_occupied: occupiedIds.has(row.id),
  }));
}
function buildInstantTransactionRouter(router: Router): void {
  // Middleware to check if module requires reservation workflow (Phase 5)
  const requireReservationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      if (mounted.require_reservation === false) {
        return res.status(400).json({ success: false, error: 'This module does not support reservation workflow' });
      }
      next();
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to check module configuration' });
    }
  };

  // Reservation endpoints (Phase 2 D1-D3) - only available if require_reservation is true
  router.post('/reservations', requireReservationMiddleware, createReservationHandler);
  router.get('/reservations', authorize('customer', ...STAFF_ROLES), requireReservationMiddleware, getReservationsDayHandler);
  router.patch('/reservations/:id/assign-table', authorize(...STAFF_ROLES), requireReservationMiddleware, assignTableHandler);
  router.patch('/reservations/:id/check-in', authorize(...STAFF_ROLES), requireReservationMiddleware, checkInHandler);
  router.patch('/reservations/:id/cancel', authorize('customer', ...STAFF_ROLES), requireReservationMiddleware, cancelHandler);
  router.patch('/reservations/:id/no-show', authorize(...STAFF_ROLES), requireReservationMiddleware, noShowHandler);
  router.patch('/service-locations/:id/reassign', authorize(...STAFF_ROLES), requireReservationMiddleware, reassignStaffHandler);

  // Transaction completion with table freeing (Phase 4)
  router.patch('/transactions/:id/complete', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }

      const supabase = getSupabase();
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('id, service_location_id, module_id')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .single();

      if (txError || !transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      // Mark transaction as completed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', req.params.id);

      if (updateError) throw updateError;

      // Free the table if this transaction was tied to a service location
      if (transaction.service_location_id) {
        const { data: reservation } = await supabase
          .from('reservations')
          .select('id, tenant_id, module_id')
          .eq('service_location_id', transaction.service_location_id)
          .eq('status', 'seated')
          .maybeSingle();

        if (reservation) {
          await supabase
            .from('reservations')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', reservation.id);

          // Emit socket event to update floor map
          emitToUnit(reservation.tenant_id, reservation.module_id, 'table:freed', {
            serviceLocationId: transaction.service_location_id,
            reservationId: reservation.id,
          });

          logger.info('[Dynamic Router] Transaction completed, table freed', {
            transactionId: req.params.id,
            serviceLocationId: transaction.service_location_id,
            reservationId: reservation.id,
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] Transaction completion failed', error);
      res.status(500).json({ success: false, error: 'Failed to complete transaction' });
    }
  });

  // Anonymous QR status tracking (Phase 3.2 & 3.3)
  router.get('/public/orders/:id/status', async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (!token) {
        return res.status(400).json({ success: false, error: 'Signed token is required' });
      }

      const validation = validatePayload(token);
      if (!validation.valid || !validation.payload) {
        return res.status(401).json({ success: false, error: validation.error || 'Invalid or expired QR token' });
      }

      if (validation.payload.id !== req.params.id) {
        return res.status(403).json({ success: false, error: 'Token does not match requested order' });
      }

      const supabase = getSupabase();
      const { data: order, error: orderError } = await supabase
        .from('transactions')
        .select('id, status, metadata, created_at')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (orderError || !order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      // Fetch items
      const { data: itemRows } = await supabase
        .from('order_items')
        .select('id, catalog_item_id, quantity, status, special_instructions')
        .eq('transaction_id', order.id);

      const catalogIds = [...new Set((itemRows || []).map((i) => i.catalog_item_id).filter(Boolean))];
      const { data: catalogRows } = catalogIds.length > 0
        ? await supabase.from('catalog_items').select('id, name').in('id', catalogIds)
        : { data: [] };
      const nameById = new Map((catalogRows || []).map((c) => [c.id, c.name]));

      const items = (itemRows || []).map((item) => ({
        id: item.id,
        name: (item.catalog_item_id && nameById.get(item.catalog_item_id)) || 'Item',
        quantity: item.quantity,
        status: item.status,
        specialInstructions: item.special_instructions,
      }));

      const meta = (order.metadata ?? {}) as Record<string, unknown>;

      res.json({
        success: true,
        data: {
          orderId: order.id,
          status: order.status,
          items,
          estimatedReadyTime: (meta.estimated_ready_time as string) ?? null,
          createdAt: order.created_at,
          // Room for direct socket room subscription
          socketRoom: `order:${order.id}`,
        },
      });
    } catch (error) {
      logger.error('[Dynamic Router] Anonymous GET /public/orders/:id/status failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order status' });
    }
  });

  // Categories endpoints - public access for customers to browse catalog
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('catalog_categories')
        .select('id, name, description, sort_order, is_active')
        .eq('module_id', mounted.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /categories failed', error);
      res.status(500).json({ success: false, error: 'Failed to list categories' });
    }
  });
  router.post('/admin/categories', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { name, description } = req.body ?? {};
      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      const tenant_id = await getTenantIdForMountedModule(mounted);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('catalog_categories')
        .insert({
          module_id: mounted.id,
          tenant_id,
          property_id: mounted.property_id,
          name,
          description: description ?? null,
          sort_order: 0,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /admin/categories failed', error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  });
  router.put('/admin/categories/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { name, description } = req.body ?? {};
      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('catalog_categories')
        .update({ name, description: description ?? null })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PUT /admin/categories/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to update category' });
    }
  });
  router.delete('/admin/categories/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { error } = await supabase
        .from('catalog_categories')
        .delete()
        .eq('id', req.params.id)
        .eq('module_id', mounted.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /admin/categories/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  });
  // Admin Items endpoints
  router.get('/admin/items', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('module_id', mounted.id)
        .order('name', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /admin/items failed', error);
      res.status(500).json({ success: false, error: 'Failed to list items' });
    }
  });
  router.post('/admin/items', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const tenant_id = await getTenantIdForMountedModule(mounted);
      const supabase = getSupabase();
      const { 
        name, 
        name_ar, 
        description, 
        description_ar, 
        price, 
        category_id, 
        image_url, 
        is_available, 
        is_featured, 
        is_vegetarian, 
        is_spicy, 
        preparation_time,
        recipe,
        customization_group_ids,
        ...otherFields
      } = req.body ?? {};
      if (!name || price == null) {
        return res.status(400).json({ success: false, error: 'Name and price are required' });
      }
      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          name,
          price,
          description,
          category: category_id,
          is_available: is_available ?? true,
          module_id: mounted.id,
          tenant_id,
          property_id: mounted.property_id,
          metadata: {
            name_ar,
            description_ar,
            image_url,
            is_featured,
            is_vegetarian,
            is_spicy,
            preparation_time_minutes: preparation_time,
            recipe,
            customization_group_ids,
            ...otherFields
          }
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /admin/items failed', error);
      res.status(500).json({ success: false, error: 'Failed to create item' });
    }
  });
  router.put('/admin/items/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { 
        name, 
        name_ar, 
        description, 
        description_ar, 
        price, 
        category_id, 
        image_url, 
        is_available, 
        is_featured, 
        is_vegetarian, 
        is_spicy, 
        preparation_time,
        recipe,
        customization_group_ids,
        ...otherFields
      } = req.body ?? {};
      // First, get the existing item to preserve metadata
      const { data: existingItem } = await supabase
        .from('catalog_items')
        .select('metadata')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      const { data, error } = await supabase
        .from('catalog_items')
        .update({
          ...(name !== undefined && { name }),
          ...(price !== undefined && { price }),
          ...(description !== undefined && { description }),
          ...(category_id !== undefined && { category: category_id }),
          ...(is_available !== undefined && { is_available }),
          metadata: {
            ...(existingItem?.metadata || {}),
            ...(name_ar !== undefined && { name_ar }),
            ...(description_ar !== undefined && { description_ar }),
            ...(image_url !== undefined && { image_url }),
            ...(is_featured !== undefined && { is_featured }),
            ...(is_vegetarian !== undefined && { is_vegetarian }),
            ...(is_spicy !== undefined && { is_spicy }),
            ...(preparation_time !== undefined && { preparation_time_minutes: preparation_time }),
            ...(recipe !== undefined && { recipe }),
            ...(customization_group_ids !== undefined && { customization_group_ids }),
            ...otherFields
          }
        })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PUT /admin/items/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to update item' });
    }
  });
  router.delete('/admin/items/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { error } = await supabase
        .from('catalog_items')
        .delete()
        .eq('id', req.params.id)
        .eq('module_id', mounted.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /admin/items/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
  });
  // Service locations (Engine A Refit Phase 3 — see REFIT_PLAN.md).
  // Replaces the dead /tables stub. "Occupied" is derived, not stored —
  // see fetchServiceLocationsWithOccupancy.
  router.get('/service-locations', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const data = await fetchServiceLocationsWithOccupancy(mounted.id);
      const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const reservations = await getReservationsForDay(getSupabase(), mounted.id, dateStr);
      res.json({ success: true, data, reservations });
    } catch (error) {
      logger.error('[Dynamic Router] GET /service-locations failed', error);
      res.status(500).json({ success: false, error: 'Failed to list service locations' });
    }
  });
  router.post('/admin/service-locations', authorize(...STAFF_ROLES), enforceServiceLocationOwnership, async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      const tenant_id = await getTenantIdForMountedModule(mounted);
      if (!tenant_id) {
        return res.status(422).json({ success: false, error: 'Unable to resolve tenant for this module' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('service_locations')
        .insert({
          module_id: mounted.id,
          tenant_id,
          property_id: mounted.property_id ?? null,
          name,
          qr_code: typeof req.body?.qr_code === 'string' ? req.body.qr_code : null,
          is_active: req.body?.is_active ?? true,
          sort_order: asNumber(req.body?.sort_order, 0),
        })
        .select('id, name, qr_code, is_active, sort_order, created_at, updated_at')
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data: { ...data, is_occupied: false } });
    } catch (error) {
      logger.error('[Dynamic Router] POST /admin/service-locations failed', error);
      res.status(500).json({ success: false, error: 'Failed to create service location' });
    }
  });
  router.put('/admin/service-locations/:id', authorize(...STAFF_ROLES), enforceServiceLocationOwnership, async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const updates: Record<string, unknown> = {};
      if (typeof req.body?.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
      if (typeof req.body?.qr_code === 'string') updates.qr_code = req.body.qr_code;
      if (typeof req.body?.is_active === 'boolean') updates.is_active = req.body.is_active;
      if (req.body?.sort_order !== undefined) updates.sort_order = asNumber(req.body.sort_order, 0);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('service_locations')
        .update(updates)
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select('id, name, qr_code, is_active, sort_order, created_at, updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ success: false, error: 'Service location not found' });
      }
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PUT /admin/service-locations/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to update service location' });
    }
  });
  router.delete('/admin/service-locations/:id', authorize(...STAFF_ROLES), enforceServiceLocationOwnership, async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { error } = await supabase
        .from('service_locations')
        .delete()
        .eq('id', req.params.id)
        .eq('module_id', mounted.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /admin/service-locations/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to delete service location' });
    }
  });
  // Modifiers endpoints
  router.get('/modifiers', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      // catalog_modifiers was never created — no canonical replacement yet
      res.json({ success: true, data: [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /modifiers failed', error);
      res.status(500).json({ success: false, error: 'Failed to list modifiers' });
    }
  });
  // Items endpoint - public access for customers to browse catalog
  router.get('/items', async (req: Request, res: Response) => {
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
      if (error) {
        logger.error('[Dynamic Router] GET /items database error', { error: error.message, moduleId: mounted.id });
        throw error;
      }
      res.json({ success: true, data: data ?? [] });
    } catch (error: any) {
      logger.error('[Dynamic Router] GET /items failed', { error: error?.message, stack: error?.stack });
      res.status(500).json({ success: false, error: 'Failed to list items', details: error?.message });
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
        .map((item: unknown) => {
          const i = item as { catalog_item_id?: string; menuItemId?: string; itemId?: string };
          return i.catalog_item_id || i.menuItemId || i.itemId;
        })
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
      const { data: catalogRows, error: catalogError } = await supabase
        .from('catalog_items')
        .select('id, name, price')
        .eq('module_id', mounted.id)
        .in('id', itemIds);
      if (catalogError) throw catalogError;
      // Human-readable name lookup — the pricing pipeline's own lineItems
      // only carry an opaque `catalog_item:<uuid>` placeholder (it doesn't
      // need real names to price correctly), so a separate map is built
      // here purely for the receipt/ledger snapshot and the confirmation
      // page's itemized breakdown.
      const nameMap = new Map((catalogRows ?? []).map((row: any) => [row.id, row.name as string]));
      // Fetch module's tax category for tax scoping
      const { data: module } = await supabase
        .from('modules')
        .select('tax_category')
        .eq('id', mounted.id)
        .maybeSingle();
      const priceMap = new Map((catalogRows ?? []).map((row) => [row.id, asNumber(row.price, 0)]));
      // Re-validate any submitted item customizations server-side before
      // pricing — the client's `priceAdjustment` on each selected modifier
      // is never trusted. `validate_customizations` re-derives the price
      // from the DB (customization_options.price_adjustment) per item, so a
      // tampered or stale client value can't affect the charge.
      // Keyed by position in `items` since the same catalog_item_id can
      // appear more than once in a cart with different selections.
      const modifierAdjustmentByIndex = new Map<number, number>();
      const modifierValidationErrors: string[] = [];
      await Promise.all(items.map(async (item: unknown, index: number) => {
        const currentItem = item as {
          catalog_item_id?: string; menuItemId?: string; itemId?: string;
          metadata?: Record<string, unknown>;
        };
        const resolvedId = currentItem.catalog_item_id || currentItem.menuItemId || currentItem.itemId || '';
        const rawSelections = Array.isArray(currentItem.metadata?.selectedModifiers)
          ? currentItem.metadata!.selectedModifiers as Array<Record<string, unknown>>
          : [];
        const selections = rawSelections
          .map((m) => ({
            groupId: String(m.groupId ?? ''),
            optionId: String(m.optionId ?? ''),
            quantity: asNumber(m.quantity, 1),
          }))
          .filter((s) => s.optionId.length > 0);
        if (selections.length === 0) return;
        try {
          const result = await customizationService.validateSelections('catalog_item', resolvedId, selections);
          if (!result.isValid) {
            modifierValidationErrors.push(...result.validationErrors.map((e) => `${resolvedId}: ${e}`));
            return;
          }
          modifierAdjustmentByIndex.set(index, result.totalPriceAdjustment);
        } catch (err) {
          logger.error('[Dynamic Router] Failed to validate item customizations', {
            itemId: resolvedId, error: err instanceof Error ? err.message : String(err),
          });
          modifierValidationErrors.push(`${resolvedId}: failed to validate customizations`);
        }
      }));
      if (modifierValidationErrors.length > 0) {
        return res.status(400).json({ success: false, error: 'Invalid item customizations', details: modifierValidationErrors });
      }
      const lineItems = items.map((item: unknown, index: number) => {
        const currentItem = item as { catalog_item_id?: string; menuItemId?: string; itemId?: string; quantity?: number; metadata?: Record<string, unknown> };
        const resolvedId = currentItem.catalog_item_id || currentItem.menuItemId || currentItem.itemId || '';
        const basePrice = priceMap.get(resolvedId) ?? 0;
        const modifierAdjustment = modifierAdjustmentByIndex.get(index) ?? 0;
        const lineItem = {
          itemId: resolvedId,
          name: `catalog_item:${resolvedId}`,
          quantity: asNumber(currentItem.quantity, 1),
          unitPrice: basePrice + modifierAdjustment,
          metadata: currentItem.metadata || {},
        };
        return {
          ...lineItem,
          taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
        };
      });
      // Receipt-friendly snapshot of what was actually ordered, with real
      // catalog names + any modifiers the cart attached. This is what gets
      // persisted into the ledger's metadata below so the confirmation page
      // can show an itemized breakdown — previously this was computed for
      // pricing and then discarded, since PricingResult.lineItems only
      // carries the opaque `catalog_item:<uuid>` placeholder.
      const receiptLineItems = items.map((item: unknown) => {
        const currentItem = item as {
          catalog_item_id?: string; menuItemId?: string; itemId?: string;
          quantity?: number; metadata?: Record<string, unknown>;
        };
        const resolvedId = currentItem.catalog_item_id || currentItem.menuItemId || currentItem.itemId || '';
        const quantity = asNumber(currentItem.quantity, 1);
        const baseUnitPrice = priceMap.get(resolvedId) ?? 0;
        const selectedModifiers = Array.isArray(currentItem.metadata?.selectedModifiers)
          ? currentItem.metadata!.selectedModifiers
          : undefined;
        // Sum modifier price adjustments to get final unit price
        const modifierPriceAdjustment = selectedModifiers?.reduce((sum: number, mod: any) => {
          return sum + (mod.priceAdjustment || mod.price_adjustment || 0);
        }, 0) || 0;
        const unitPrice = baseUnitPrice + modifierPriceAdjustment;
        return {
          itemId: resolvedId,
          name: nameMap.get(resolvedId) ?? 'Item',
          quantity,
          unitPrice,
          lineTotal: unitPrice * quantity,
          ...(selectedModifiers ? { selectedModifiers } : {}),
        };
      });
      const giftCardRedemptions = Array.isArray(req.body?.giftCardRedemptions) ? req.body.giftCardRedemptions : [];
      const giftCardCodes = giftCardRedemptions
        .map((r: unknown) => (r as { code?: string }).code)
        .filter((code: unknown): code is string => typeof code === 'string' && code.length > 0);
      const resolvedOrderType = req.body?.orderType ?? req.body?.metadata?.order_type ?? req.body?.order_type ?? 'dine_in';
      const resolvedCustomerName = req.body?.customerName ?? req.body?.metadata?.customer_name ?? req.body?.customer_name ?? null;
      const resolvedCustomerPhone = req.body?.customerPhone ?? req.body?.metadata?.customer_phone ?? req.body?.customer_phone ?? null;
      const resolvedTableNumber = req.body?.tableNumber ?? req.body?.metadata?.table_number ?? req.body?.table_number ?? null;
      const resolvedPaymentMethod = req.body?.paymentMethod ?? req.body?.metadata?.payment_method ?? req.body?.payment_method ?? 'cash';
      // Resolve property_id: mounted module → request context — NO fallbacks
      // Must be resolved BEFORE calculatePricing so tax/fees use property settings
      const propertyId = mounted.property_id
        || (req as any).propertyId
        || (req.headers?.['x-property-id'] as string)
        || null;
      if (!propertyId) {
        logger.error('[Dynamic Router] POST /orders rejected — property_id could not be resolved', {
          moduleId: mounted.id, slug: mounted.slug,
        });
        return res.status(500).json({ success: false, error: 'property_id is required but could not be resolved for this module' });
      }
      // Resolve tenant_id: mounted module → request context — NO fallbacks
      const tenantId = mounted.tenant_id
        || (req as any).tenant?.id
        || req.user?.tenantId
        || (req.headers?.['x-tenant-id'] as string)
        || null;
      if (!tenantId) {
        logger.error('[Dynamic Router] POST /orders rejected — tenant_id could not be resolved', {
          moduleId: mounted.id, slug: mounted.slug,
        });
        return res.status(500).json({ success: false, error: 'tenant_id is required but could not be resolved for this module' });
      }
      const pricing = await engineService.calculatePricing('instant_transaction', lineItems, {
        moduleId: mounted.id,
        propertyId: propertyId,
        customerId: req.user?.userId ?? undefined,
        couponCode: typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined,
        giftCardCodes: giftCardCodes.length > 0 ? giftCardCodes : undefined,
        loyaltyPointsToRedeem: typeof req.body?.loyaltyPointsToRedeem === 'number' ? req.body.loyaltyPointsToRedeem : undefined,
        conditions: { orderType: resolvedOrderType, paymentMethod: resolvedPaymentMethod },
      });
      // Validate pricing matches preview if provided (protects against pricing drift)
      const previewTotal = typeof req.body?.previewTotal === 'number' ? req.body.previewTotal : null;
      if (previewTotal !== null) {
        const tolerance = 0.01; // 1 cent tolerance for rounding differences
        const diff = Math.abs(pricing.totalAmount - previewTotal);
        if (diff > tolerance) {
          logger.error('[Dynamic Router] POST /orders rejected - pricing mismatch with preview', {
            previewTotal,
            calculatedTotal: pricing.totalAmount,
            difference: diff,
            moduleId: mounted.id,
          });
          return res.status(400).json({
            success: false,
            error: 'Pricing mismatch detected',
            message: `The total amount has changed since preview. Preview: $${previewTotal.toFixed(2)}, Current: $${pricing.totalAmount.toFixed(2)}. Please refresh and try again.`,
            previewTotal,
            calculatedTotal: pricing.totalAmount,
          });
        }
      }
      // Validate service_location_id belongs to this module before trusting it —
      // otherwise a caller could tag an order to another module's location.
      let serviceLocationId: string | null = null;
      const requestedLocationId = req.body?.service_location_id || req.body?.serviceLocationId;
      if (typeof requestedLocationId === 'string' && requestedLocationId.length > 0) {
        const { data: locationRow, error: locationError } = await supabase
          .from('service_locations')
          .select('id')
          .eq('id', requestedLocationId)
          .eq('module_id', mounted.id)
          .maybeSingle();
        if (locationError) throw locationError;
        if (!locationRow) {
          return res.status(400).json({ success: false, error: 'service_location_id does not belong to this module' });
        }
        serviceLocationId = locationRow.id;
      }
      const isStaffUser = (req.user?.roles ?? []).some((r: string) => STAFF_ROLES.includes(r));
      const staffId = isStaffUser ? (req.user?.userId ?? null) : null;
      const customerId = isStaffUser ? null : (req.user?.userId ?? null);

      const { data: created, error: createError } = await supabase
        .from('transactions')
        .insert({
          engine_type: 'instant_transaction',
          module_id: mounted.id,
          property_id: propertyId,
          tenant_id: tenantId,
          customer_id: customerId,
          staff_id: staffId,
          status: 'pending',
          amount: pricing.totalAmount,
          discount_amount: pricing.totalDiscount ?? 0,
          tax_amount: pricing.taxAmount ?? 0,
          // FIX: service_charge column already existed on transactions but
          // was never populated at creation — every order with a service
          // charge silently showed $0 for it downstream.
          service_charge: pricing.serviceCharge ?? 0,
          service_location_id: serviceLocationId,
          metadata: {
            notes: req.body?.notes ?? req.body?.metadata?.notes ?? null,
            payment_method: resolvedPaymentMethod,
            order_type: resolvedOrderType,
            table_number: resolvedTableNumber,
            customer_name: resolvedCustomerName,
            customer_phone: resolvedCustomerPhone,
          },
        })
        .select('id, module_id, customer_id, status, amount, service_location_id, created_at, metadata')
        .single();
      if (createError) throw createError;

      // Backfill the order_id onto the coupon_usage/gift_card_transactions
      // row(s) created during pricing above (they were inserted with
      // order_id NULL since the order didn't exist yet) so this order can be
      // traced back to what it consumed, and so a later cancellation/refund
      // can reverse it precisely by order_id instead of by fuzzy recency.
      await linkDiscountsToOrder(supabase, pricing.discounts, created.id, req.user?.userId ?? undefined);

      // CRITICAL: persist order_items. Previously nothing in this codebase
      // ever wrote a row to order_items — the only per-item record of an
      // order was `receiptLineItems`, buried inside engine_financial_ledger
      // metadata for receipt display only. Two real capabilities were
      // silently broken as a result:
      //   1. deduct_inventory_for_order_v2 (called on status → confirmed,
      //      see engines/inventory-side-effects.ts) reads FROM order_items
      //      WHERE transaction_id = p_transaction_id — with no rows, it
      //      iterates zero times and deducts nothing. Every "confirmed"
      //      order has been a no-op for inventory.
      //   2. The staff/KDS orders endpoint has always returned items: []
      //      for every order (see module-staff.controller.ts) — kitchen
      //      staff never saw what was actually ordered.
      // Item status defaults to 'pending' — this is what the item-level
      // KDS (staff/KitchenView.tsx) advances through preparing/ready/served.
      // Non-fatal by design, matching the ledger-recording block below: the
      // transactions row is already the authoritative "an order exists"
      // record, so a hiccup here must not block order creation — but unlike
      // the ledger snapshot, a failure here means inventory won't deduct
      // and the kitchen won't see items, so it's logged at error, not warn.
      try {
        const orderItemRows = items.map((item: unknown, index: number) => {
          const currentItem = item as {
            catalog_item_id?: string; menuItemId?: string; itemId?: string;
            quantity?: number; metadata?: Record<string, unknown>;
          };
          const resolvedId = currentItem.catalog_item_id || currentItem.menuItemId || currentItem.itemId || '';
          const quantity = asNumber(currentItem.quantity, 1);
          const basePrice = priceMap.get(resolvedId) ?? 0;
          const modifierAdjustment = modifierAdjustmentByIndex.get(index) ?? 0;
          const unitPrice = basePrice + modifierAdjustment;
          const specialInstructions = (currentItem.metadata?.specialInstructions
            ?? currentItem.metadata?.notes
            ?? null) as string | null;
          return {
            transaction_id: created.id,
            catalog_item_id: resolvedId || null,
            quantity,
            unit_price: unitPrice,
            subtotal: unitPrice * quantity,
            special_instructions: specialInstructions,
            status: 'pending',
            tenant_id: tenantId,
            property_id: propertyId,
          };
        });

        const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemRows);
        if (orderItemsError) {
          logger.error('[Dynamic Router] Failed to persist order_items — inventory deduction and KDS item display will be broken for this order', {
            orderId: created.id,
            error: orderItemsError.message,
          });
        }
      } catch (orderItemsErr) {
        logger.error('[Dynamic Router] Unexpected error persisting order_items', {
          orderId: created.id,
          error: orderItemsErr instanceof Error ? orderItemsErr.message : String(orderItemsErr),
        });
      }

      // Persist the full pricing breakdown (subtotal, discount detail,
      // service charge, delivery fee, itemization) to the financial ledger.
      // Previously this whole breakdown was computed by calculatePricing()
      // above and then thrown away — only the three scalar columns on
      // `transactions` were kept, so the confirmation page had nothing to
      // reconstruct a receipt from. engine_financial_ledger already exists
      // for exactly this (see FINANCIAL_INVARIANTS.md, INV-L1) but had no
      // real call site anywhere in the app until now.
      // Non-fatal by design: a ledger hiccup must never block the order
      // itself from completing, since the transactions row is already the
      // authoritative record of "an order exists" — this only enriches it.
      try {
        const actorIsStaff = (req.user?.roles ?? []).some((r: string) => STAFF_ROLES.includes(r));
        await engineService.recordToLedger(pricing, {
          tenantId,
          propertyId: propertyId,
          moduleId: mounted.id,
          templateType: 'instant_transaction',
          entityId: created.id,
          entityType: 'order',
          transactionType: 'charge',
          actorType: req.user ? (actorIsStaff ? 'staff' : 'customer') : 'system',
          actorId: req.user?.userId,
          entityState: 'pending',
          paymentMethod: resolvedPaymentMethod,
          notes: req.body?.notes ?? req.body?.metadata?.notes ?? undefined,
          metadata: {
            lineItems: receiptLineItems,
            taxBreakdown: pricing.taxBreakdown,
            feeBreakdown: pricing.feeBreakdown,
          },
        });
      } catch (ledgerErr) {
        logger.warn('[Dynamic Router] Failed to record order to financial ledger', {
          orderId: created.id,
          error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
        });
      }
      // Flatten metadata fields to top level for client convenience
      const meta = (created?.metadata ?? {}) as Record<string, unknown>;

      // Real-time notify the KDS. KitchenView.tsx joins both the module id
      // and slug as socket rooms and listens for 'order:new' — nothing
      // anywhere in the backend previously emitted it, so "live" order
      // updates never actually happened; staff needed a manual refresh.
      try {
        const kdsPayload = {
          id: created.id,
          orderNumber: meta.order_number ?? created.id.slice(0, 8),
          customerName: meta.customer_name ?? 'Guest',
          orderType: meta.order_type ?? 'dine_in',
          status: created.status,
          totalAmount: created.amount,
          tableNumber: meta.table_number ?? null,
          createdAt: created.created_at,
          items: receiptLineItems.map((li: any) => ({
            id: li.itemId,
            name: li.name,
            quantity: li.quantity,
            specialInstructions: undefined,
          })),
        };
        emitToUnit(tenantId, mounted.slug, 'order:new', kdsPayload);
        emitToUnit(tenantId, mounted.id, 'order:new', kdsPayload);
      } catch (socketErr) {
        logger.warn('[Dynamic Router] Failed to emit order:new', {
          orderId: created.id,
          error: socketErr instanceof Error ? socketErr.message : String(socketErr),
        });
      }

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
      // Flatten metadata fields to top level for client convenience
      const flattened = (data ?? []).map((tx: any) => {
        const meta = (tx.metadata ?? {}) as Record<string, unknown>;
        const items = (meta.items as Array<any>) || [];
        return {
          id: tx.id,
          order_number: meta.order_number || `ORD-${tx.id.slice(0, 8).toUpperCase()}`,
          status: tx.status,
          total_amount: tx.amount,
          table_number: meta.table_number || meta.tableNumber || null,
          customer: meta.customer_name ? { full_name: meta.customer_name as string } : null,
          customerName: meta.customer_name || meta.customerName || null,
          created_at: tx.created_at,
          order_items: items.map((item: any) => ({
            id: item.id,
            catalog_item_id: item.catalog_item_id || item.menuItemId || item.itemId,
            quantity: item.quantity,
            unit_price: item.unit_price || item.unitPrice,
            name: item.name || null,
            catalog_items: item.name ? { name: item.name } : null,
          })),
          items: items.map((item: any) => ({
            id: item.id,
            catalog_item_id: item.catalog_item_id || item.menuItemId || item.itemId,
            quantity: item.quantity,
            unit_price: item.unit_price || item.unitPrice,
            name: item.name || null,
            catalog_items: item.name ? { name: item.name } : null,
          })),
        };
      });
      res.json({ success: true, data: flattened });
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
        // tax_amount/discount_amount are written at order creation (see
        // POST /orders below) but were previously never selected here, so
        // the confirmation page had no way to show a subtotal/discount/tax
        // breakdown even though the data existed on the row.
        .select('id, customer_id, status, amount, tax_amount, discount_amount, created_at, metadata')
        .eq('engine_type', 'instant_transaction')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Order not found' });
      // IDOR protection: customers can only view their own orders
      const isStaff = (req.user?.roles ?? []).some((r: string) => STAFF_ROLES.includes(r));
      if (!isStaff && data.customer_id !== req.user?.userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      const meta = (data?.metadata ?? {}) as Record<string, unknown>;
      // QR code was never wired up for orders — qr-security.ts has a working,
      // HMAC-signed generator that nothing was calling. Generated fresh on
      // each fetch; validity is verified by signature/expiry, not storage.
      let qrCode: string | null = null;
      try {
        const qr = await generateQRCodeImage('instant_transaction', data.id, { module_id: mounted.id });
        qrCode = qr.dataUrl;
      } catch (qrErr) {
        logger.warn('[Dynamic Router] Failed to generate order QR code', { orderId: data.id, error: qrErr instanceof Error ? qrErr.message : String(qrErr) });
      }
      // Pull the full pricing breakdown back out of the financial ledger
      // (written at order creation — see POST /orders). Falls back to just
      // the bare transactions fields for orders created before this ledger
      // write existed, or if the ledger read itself fails for any reason —
      // the confirmation page should degrade gracefully, never 500.
      let ledgerBreakdown: Record<string, unknown> | null = null;
      try {
        const { data: ledgerRow, error: ledgerError } = await supabase
          .from('engine_financial_ledger')
          .select('subtotal, tax_amount, tax_rate, service_charge, delivery_fee, total_discount, deposit_amount, discount_breakdown, loyalty_points_earned, payment_method, notes, metadata')
          .eq('entity_id', data.id)
          .eq('entity_type', 'order')
          .eq('transaction_type', 'charge')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (ledgerError) throw ledgerError;
        ledgerBreakdown = ledgerRow ?? null;
      } catch (ledgerReadErr) {
        logger.warn('[Dynamic Router] Failed to read order financial ledger entry', {
          orderId: data.id,
          error: ledgerReadErr instanceof Error ? ledgerReadErr.message : String(ledgerReadErr),
        });
      }
      const ledgerMeta = (ledgerBreakdown?.metadata ?? {}) as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          ...data,
          order_number: data.id.slice(0, 8).toUpperCase(),
          total_amount: data.amount,
          tax_amount: data.tax_amount,
          discount_amount: data.discount_amount,
          order_type: meta.order_type ?? 'dine_in',
          customer_name: meta.customer_name ?? null,
          customer_phone: meta.customer_phone ?? null,
          notes: meta.notes ?? ledgerBreakdown?.notes ?? null,
          table_id: meta.table_number ?? null,
          payment_method: meta.payment_method ?? ledgerBreakdown?.payment_method ?? null,
          payment_status: data.status === 'completed' ? 'paid' : 'pending',
          qr_code: qrCode,
          // Rich breakdown — only present once the ledger entry exists.
          subtotal: ledgerBreakdown?.subtotal ?? null,
          tax_rate: ledgerBreakdown?.tax_rate ?? null,
          service_charge: ledgerBreakdown?.service_charge ?? null,
          delivery_fee: ledgerBreakdown?.delivery_fee ?? null,
          deposit_amount: ledgerBreakdown?.deposit_amount ?? null,
          loyalty_points_earned: ledgerBreakdown?.loyalty_points_earned ?? null,
          discounts: ledgerBreakdown?.discount_breakdown ?? null,
          line_items: ledgerMeta.lineItems ?? null,
          tax_breakdown: ledgerMeta.taxBreakdown ?? null,
          fee_breakdown: ledgerMeta.feeBreakdown ?? null,
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
      const result = await changeInstantTransactionOrderStatus(supabase, {
        orderId: req.params.id,
        moduleId: mounted.id,
        moduleSlug: mounted.slug,
        moduleEngineTypeRaw: mounted.engine_type,
        requestedStatus: newStatus,
        // Forced 'staff', not actorForUser(req): this route is staff/manager/
        // admin/super_admin-only (never actually reachable by a customer, so
        // actorForUser could only ever resolve to 'staff' or 'admin' here
        // anyway) — and mark_ready/deliver on the engine only allow actor
        // 'staff'. Matches module-staff.controller.ts's KDS endpoint, which
        // this route needs to behave identically to now that both call the
        // same function (this one's also what offline-sync replay hits).
        actor: 'staff',
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      res.json({ success: true, data: result.order });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /orders/:id/status failed', error);
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  });

  // Review endpoints (Phase 4.1 & 4.2)
  router.post('/orders/:id/items/:itemId/review', async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const tenantId = await getTenantIdForMountedModule(mounted);
      if (!tenantId || !mounted.property_id) {
        return res.status(400).json({ success: false, error: 'Module scope incomplete' });
      }

      const { rating, text, token } = req.body ?? {};
      if (!rating || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ success: false, error: 'rating between 1 and 5 is required' });
      }

      let authorized = false;
      const userId: string | null = req.user?.userId ?? null;

      if (token && typeof token === 'string') {
        const val = validatePayload(token);
        if (val.valid && val.payload && val.payload.id === req.params.id) {
          authorized = true;
        }
      }

      if (req.user?.userId) {
        authorized = true;
      }

      if (!authorized) {
        return res.status(401).json({ success: false, error: 'Authentication or valid order QR token required' });
      }

      const supabase = getSupabase();
      const { data: itemRow } = await supabase
        .from('order_items')
        .select('catalog_item_id')
        .eq('id', req.params.itemId)
        .eq('transaction_id', req.params.id)
        .maybeSingle();

      const review = await submitProductReview({
        tenantId,
        propertyId: mounted.property_id,
        orderId: req.params.id,
        orderItemId: req.params.itemId,
        catalogItemId: itemRow?.catalog_item_id ?? null,
        rating: Number(rating),
        text: text ? String(text) : null,
        userId,
      });

      res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      logger.error('[Dynamic Router] POST /orders/:id/items/:itemId/review failed', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to submit item review' });
    }
  });

  router.post('/orders/:id/staff-review', async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const tenantId = await getTenantIdForMountedModule(mounted);
      if (!tenantId || !mounted.property_id) {
        return res.status(400).json({ success: false, error: 'Module scope incomplete' });
      }

      const { rating, text, token } = req.body ?? {};
      if (!rating || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ success: false, error: 'rating between 1 and 5 is required' });
      }

      let authorized = false;
      if (token && typeof token === 'string') {
        const val = validatePayload(token);
        if (val.valid && val.payload && val.payload.id === req.params.id) {
          authorized = true;
        }
      }
      if (req.user?.userId) authorized = true;

      if (!authorized) {
        return res.status(401).json({ success: false, error: 'Authentication or valid order QR token required' });
      }

      const supabase = getSupabase();
      const { data: order } = await supabase
        .from('transactions')
        .select('staff_id')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();

      if (!order || !order.staff_id) {
        return res.status(400).json({ success: false, error: 'Order has no assigned staff member to review' });
      }

      const review = await submitStaffReview({
        tenantId,
        propertyId: mounted.property_id,
        staffId: order.staff_id,
        orderId: req.params.id,
        rating: Number(rating),
        text: text ? String(text) : null,
      });

      res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      logger.error('[Dynamic Router] POST /orders/:id/staff-review failed', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to submit staff review' });
    }
  });

  router.get('/items/:itemId/rating', async (req: Request, res: Response) => {
    try {
      const stats = await getProductItemRating(req.params.itemId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error('[Dynamic Router] GET /items/:itemId/rating failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch item rating' });
    }
  });

  // Staff endpoints
  router.get('/staff/orders', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { status } = req.query;
      let query = supabase
        .from('transactions')
        .select('id, customer_id, status, amount, created_at, metadata')
        .eq('engine_type', 'instant_transaction')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (status && typeof status === 'string') {
        const statusList = status.split(',');
        query = query.in('status', statusList);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/orders failed', error);
      res.status(500).json({ success: false, error: 'Failed to list staff orders' });
    }
  });
  router.get('/staff/service-locations', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const data = await fetchServiceLocationsWithOccupancy(mounted.id);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/service-locations failed', error);
      res.status(500).json({ success: false, error: 'Failed to list service locations' });
    }
  });
  // Waitlist endpoints
  router.get('/waitlist', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('module_id', mounted.id)
        .order('created_at', { ascending: true });
      if (error) {
        logger.warn('[Dynamic Router] GET /waitlist query warning:', error.message);
        return res.json({ success: true, data: [] });
      }
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /waitlist failed', error);
      res.status(500).json({ success: false, error: 'Failed to list waitlist entries' });
    }
  });
  router.post('/waitlist', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { guest_name, name, party_size, partySize, phone, notes } = req.body ?? {};
      const resolvedName = guest_name || name || 'Guest';
      const resolvedPartySize = party_size || partySize || 1;
      const tenant_id = await getTenantIdForMountedModule(mounted);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('waitlist_entries')
        .insert({
          module_id: mounted.id,
          tenant_id,
          property_id: mounted.property_id ?? null,
          guest_name: resolvedName,
          party_size: resolvedPartySize,
          phone: phone ?? null,
          notes: notes ?? null,
          status: 'waiting',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /waitlist failed', error);
      res.status(500).json({ success: false, error: 'Failed to add to waitlist' });
    }
  });
  router.patch('/waitlist/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { status } = req.body ?? {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('waitlist_entries')
        .update({
          ...(status && { status }),
          ...(status === 'notified' && { notified_at: new Date().toISOString() }),
        })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /waitlist/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to update waitlist entry' });
    }
  });
  router.delete('/waitlist/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { error } = await supabase
        .from('waitlist_entries')
        .delete()
        .eq('id', req.params.id)
        .eq('module_id', mounted.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /waitlist/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to delete waitlist entry' });
    }
  });
}
function buildTimeExclusiveReservationRouter(router: Router): void {
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
      const { unit_id, check_in_date, check_out_date } = req.body ?? {};
      if (!unit_id || !check_in_date || !check_out_date) {
        return res.status(400).json({ success: false, error: 'unit_id, check_in_date and check_out_date are required' });
      }
      const checkIn = dayjs(check_in_date);
      const checkOut = dayjs(check_out_date);
      if (!checkIn.isValid() || !checkOut.isValid() || !checkOut.isAfter(checkIn)) {
        return res.status(400).json({ success: false, error: 'Invalid check-in/check-out dates' });
      }
      // Validate unit exists for this module. Client-supplied price is never trusted —
      // total is computed server-side below from base_price/weekend_price/unit_price_rules.
      const { data: unitRow, error: unitError } = await supabase
        .from('bookable_units')
        .select('id, base_price, weekend_price')
        .eq('id', String(unit_id))
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (unitError) throw unitError;
      if (!unitRow) {
        return res.status(404).json({ success: false, error: 'Unit not found' });
      }
      const { data: priceRules } = await supabase
        .from('unit_price_rules')
        .select('*')
        .eq('unit_id', String(unit_id))
        .eq('is_active', true);
      // Fetch module's tax category for tax scoping
      const { data: module } = await supabase
        .from('modules')
        .select('tax_category')
        .eq('id', mounted.id)
        .maybeSingle();
      const baseAmount = computeStayBaseAmount(
        checkIn,
        checkOut,
        parseFloat(unitRow.base_price),
        parseFloat(unitRow.weekend_price ?? unitRow.base_price),
        priceRules || [],
      );
      const lineItem = {
        itemId: String(unit_id),
        name: 'booking',
        quantity: 1,
        unitPrice: baseAmount,
        metadata: {},
      };
      const pricing = await engineService.calculatePricing(
        mounted.engine_type,
        [{
          ...lineItem,
          taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
        }],
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
        p_discount_amount: pricing.totalDiscount ?? 0,
        p_tax_amount:      pricing.taxAmount ?? 0,
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
      const action = resolveAction(mounted.engine_type, current.status, newStatus, actor);
      const transition = await engineService.transitionState(
        mounted.engine_type,
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
function buildSharedCapacityAccessRouter(router: Router): void {
  router.get('/sessions', authorize('customer', ...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const date = req.query.date as string;
      const { data, error } = await supabase
        .from('capacity_windows')
        .select('id, name, starts_at, ends_at, max_capacity, price, module_id, is_active, metadata')
        .eq('module_id', mounted.id)
        .eq('is_active', true)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      let normalized = (data ?? []).map((w) => ({
        ...w,
        adult_price: (w.metadata as Record<string, unknown>)?.adult_price ?? w.price,
        child_price: (w.metadata as Record<string, unknown>)?.child_price ?? 0,
        available: w.max_capacity,
        availability: { remaining: w.max_capacity }
      }));
      if (date) {
        const { data: tickets, error: ticketsError } = await supabase
          .from('transactions')
          .select('id, reference_id, metadata, status')
          .eq('engine_type', 'shared_capacity_access')
          .eq('module_id', mounted.id);
        if (ticketsError) throw ticketsError;
        const validTickets = (tickets ?? []).filter((t) => 
          !['cancelled', 'expired', 'no_show'].includes(t.status)
        );
        const dateTickets = validTickets.filter((t) => {
          const tMeta = t.metadata as Record<string, unknown> | null;
          const tDate = tMeta?.ticket_date ?? tMeta?.date ?? '';
          return tDate === date;
        });
        normalized = normalized.map((w) => {
          const windowTickets = dateTickets.filter((t) => {
            const tMeta = t.metadata as Record<string, unknown> | null;
            return t.reference_id === w.id || tMeta?.session_id === w.id;
          });
          const sold = windowTickets.reduce((sum, t) => {
            const tMeta = t.metadata as Record<string, unknown> | null;
            const quantity = Number(tMeta?.quantity ?? tMeta?.number_of_guests ?? (Number(tMeta?.adults ?? 0) + Number(tMeta?.children ?? 0))) || 1;
            return sum + quantity;
          }, 0);
          const remaining = Math.max(0, (w.max_capacity ?? 0) - sold);
          return {
            ...w,
            available: remaining,
            availability: { remaining }
          };
        });
      }
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
      // Fetch module's tax category for tax scoping
      const { data: module } = await supabase
        .from('modules')
        .select('tax_category')
        .eq('id', mounted.id)
        .maybeSingle();
      const lineItem = {
        itemId: String(session_id),
        name: 'session_ticket',
        quantity: guestCount,
        unitPrice: asNumber(unit_price, 0),
        metadata: bodyMetadata || {},
      };
      const lineItems = [{
        ...lineItem,
        taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
      }];
      const pricing = await engineService.calculatePricing(
        mounted.engine_type,
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
      // qr_code was declared on the frontend SessionTicket type and rendered
      // conditionally, but nothing ever generated or returned it — the QR
      // block has been silently dead since it was built. Same generator now
      // used for orders below.
      let qrCode: string | null = null;
      try {
        const qr = await generateQRCodeImage('shared_capacity_access', data.id, { module_id: mounted.id });
        qrCode = qr.dataUrl;
      } catch (qrErr) {
        logger.warn('[Dynamic Router] Failed to generate ticket QR code', { ticketId: data.id, error: qrErr instanceof Error ? qrErr.message : String(qrErr) });
      }
      res.json({ success: true, data: { ...data, qr_code: qrCode } });
    } catch (error) {
      logger.error('[Dynamic Router] GET /tickets/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
    }
  });
  // Staff endpoints
  router.get('/staff/capacity', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .select('id, name, starts_at, ends_at, max_capacity')
        .eq('module_id', mounted.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      // current_occupancy is now derived live from transactions; compute it here
      const { count: occupancyCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('engine_type', 'shared_capacity_access')
        .eq('module_id', mounted.id)
        .in('status', ['active', 'confirmed', 'valid', 'checked_in']);
      const capacityData = data
        ? { ...data, current_occupancy: occupancyCount ?? 0 }
        : { max_capacity: 100, current_occupancy: 0 };
      res.json({ success: true, data: capacityData });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/capacity failed', error);
      res.status(500).json({ success: false, error: 'Failed to fetch capacity' });
    }
  });
  router.get('/staff/tickets/today', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const today = dayjs().format('YYYY-MM-DD');
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, amount, reference_id, metadata, created_at')
        .eq('engine_type', 'shared_capacity_access')
        .eq('module_id', mounted.id)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/tickets/today failed', error);
      res.status(500).json({ success: false, error: 'Failed to list today tickets' });
    }
  });
  router.post('/staff/tickets', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { session_id, quantity, ticket_type } = req.body ?? {};
      if (!session_id) {
        return res.status(400).json({ success: false, error: 'session_id is required' });
      }
      const guestCount = asNumber(quantity, 1);
      const supabase = getSupabase();
      const { data: session, error: sessionError } = await supabase
        .from('capacity_windows')
        .select('price, metadata')
        .eq('id', session_id)
        .eq('module_id', mounted.id)
        .single();
      if (sessionError) throw sessionError;
      const unitPrice = asNumber(session?.price, 0);
      // Fetch module's tax category for tax scoping
      const { data: module } = await supabase
        .from('modules')
        .select('tax_category')
        .eq('id', mounted.id)
        .maybeSingle();
      const lineItem = {
        itemId: String(session_id),
        name: 'session_ticket',
        quantity: guestCount,
        unitPrice,
        metadata: session?.metadata || {},
      };
      const lineItems = [{
        ...lineItem,
        taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
      }];
      const pricing = await engineService.calculatePricing(
        mounted.engine_type,
        lineItems,
        { moduleId: mounted.id, customerId: req.user?.userId ?? undefined },
      );
      const ticketDate = dayjs().format('YYYY-MM-DD');
      const purchase = await purchaseSharedCapacityAtomic(supabase, {
        sessionId: String(session_id),
        moduleId: mounted.id,
        propertyId: mounted.property_id ?? null,
        customerId: req.user?.userId ?? null,
        quantity: guestCount,
        ticketDate,
        amount: pricing.totalAmount,
        metadata: {
          ticket_type: ticket_type ?? 'adult',
          payment_method: req.body?.payment_method ?? 'cash',
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
      logger.error('[Dynamic Router] POST /staff/tickets failed', error);
      res.status(500).json({ success: false, error: 'Failed to create staff ticket' });
    }
  });
  router.post('/tickets/:id/bracelet', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { braceletNumber } = req.body ?? {};
      if (!braceletNumber) {
        return res.status(400).json({ success: false, error: 'braceletNumber is required' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          metadata: (await supabase.from('transactions').select('metadata').eq('id', req.params.id).single()).data?.metadata || {},
        })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select()
        .single();
      if (error) throw error;
      const updatedMetadata = { ...(data?.metadata as Record<string, unknown> || {}), bracelet_number: braceletNumber };
      const { data: updated, error: updateError } = await supabase
        .from('transactions')
        .update({ metadata: updatedMetadata })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[Dynamic Router] POST /tickets/:id/bracelet failed', error);
      res.status(500).json({ success: false, error: 'Failed to assign bracelet' });
    }
  });
  router.delete('/tickets/:id/bracelet', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .single();
      if (error) throw error;
      const updatedMetadata = { ...(data?.metadata as Record<string, unknown> || {}) };
      delete updatedMetadata.bracelet_number;
      const { data: updated, error: updateError } = await supabase
        .from('transactions')
        .update({ metadata: updatedMetadata })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /tickets/:id/bracelet failed', error);
      res.status(500).json({ success: false, error: 'Failed to return bracelet' });
    }
  });
  router.post('/sessions/:id/capacity/override', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { additional, reason, approved_by } = req.body ?? {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .select('max_capacity, metadata')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .single();
      if (error) throw error;
      const currentMetadata = data?.metadata as Record<string, unknown> || {};
      const newMaxCapacity = asNumber(data?.max_capacity, 0) + asNumber(additional, 0);
      const { data: updated, error: updateError } = await supabase
        .from('capacity_windows')
        .update({ 
          max_capacity: newMaxCapacity,
          metadata: {
            ...currentMetadata,
            capacity_override: {
              additional: asNumber(additional, 0),
              reason,
              approved_by,
              timestamp: new Date().toISOString(),
            },
          },
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateError) throw updateError;
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[Dynamic Router] POST /sessions/:id/capacity/override failed', error);
      res.status(500).json({ success: false, error: 'Failed to override capacity' });
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
      const action = resolveAction(mounted.engine_type, ticket.status, 'validate', actor);
      const transition = await engineService.transitionState(
        mounted.engine_type,
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
  // Admin endpoints
  router.get('/admin/sessions', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .select('id, name, starts_at, ends_at, max_capacity, price, is_active, metadata')
        .eq('module_id', mounted.id)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /admin/sessions failed', error);
      res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
  });
  router.post('/admin/sessions', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      // Accept both new (starts_at/ends_at) and legacy (start_time/end_time) field names
      const { name, starts_at, ends_at, start_time, end_time, max_capacity, price, metadata } = req.body ?? {};
      const sessionStartsAt = starts_at ?? start_time ?? null;
      const sessionEndsAt = ends_at ?? end_time ?? null;
      if (!name || !sessionStartsAt || !sessionEndsAt) {
        return res.status(400).json({ success: false, error: 'name, starts_at, and ends_at are required' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .insert({
          module_id: mounted.id,
          name,
          starts_at: sessionStartsAt,
          ends_at: sessionEndsAt,
          max_capacity: asNumber(max_capacity, 100),
          price: asNumber(price, 0),
          is_active: true,
          metadata: metadata || {},
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] POST /admin/sessions failed', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  });
  router.put('/admin/sessions/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      // Accept both new (starts_at/ends_at) and legacy (start_time/end_time) field names
      const { name, starts_at: updStarts, ends_at: updEnds, start_time: updLegacyStart, end_time: updLegacyEnd, max_capacity, price, is_active, metadata } = req.body ?? {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .update({
          name,
          starts_at: updStarts ?? updLegacyStart,
          ends_at: updEnds ?? updLegacyEnd,
          max_capacity: asNumber(max_capacity, 100),
          price: asNumber(price, 0),
          is_active: is_active !== undefined ? is_active : true,
          metadata: metadata || {},
        })
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PUT /admin/sessions/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to update session' });
    }
  });
  router.delete('/admin/sessions/:id', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { error } = await supabase
        .from('capacity_windows')
        .delete()
        .eq('id', req.params.id)
        .eq('module_id', mounted.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      logger.error('[Dynamic Router] DELETE /admin/sessions/:id failed', error);
      res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
  });
  router.put('/admin/settings', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { maxCapacity } = req.body ?? {};
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('capacity_windows')
        .update({ max_capacity: asNumber(maxCapacity, 100) })
        .eq('module_id', mounted.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PUT /admin/settings failed', error);
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  });
  router.post('/admin/reset-occupancy', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      // current_occupancy is now derived live from the transactions table.
      // No counter column exists — nothing to reset.
      res.json({ success: true, data: null });
    } catch (error) {
      logger.error('[Dynamic Router] POST /admin/reset-occupancy failed', error);
      res.status(500).json({ success: false, error: 'Failed to reset occupancy' });
    }
  });
  router.get('/staff/bracelets/active', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('transactions')
        .select('id, customer_id, status, metadata, created_at')
        .eq('engine_type', 'shared_capacity_access')
        .eq('module_id', mounted.id)
        .not('metadata->>bracelet_number', 'is', null)
        .in('status', ['active', 'confirmed', 'in_use'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/bracelets/active failed', error);
      res.status(500).json({ success: false, error: 'Failed to list active bracelets' });
    }
  });
}
function buildOngoingEntitlementRouter(router: Router): void {
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
      // Fetch module's tax category for tax scoping
      const { data: module } = await supabase
        .from('modules')
        .select('tax_category')
        .eq('id', mounted.id)
        .maybeSingle();
      const lineItem = {
        itemId: plan.id,
        name: 'subscription_plan',
        quantity: 1,
        unitPrice: asNumber(plan.price, 0),
        metadata: {},
      };
      const pricing = await engineService.calculatePricing(
        mounted.engine_type,
        [{
          ...lineItem,
          taxCategory: resolveTaxCategory(lineItem, module?.tax_category ?? 'all'),
        }],
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
      const action = resolveAction(mounted.engine_type, current.status, newStatus, actor);
      const transition = await engineService.transitionState(
        mounted.engine_type,
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
  // Staff endpoints
  router.get('/staff/list', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
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
      logger.error('[Dynamic Router] GET /staff/list failed', error);
      res.status(500).json({ success: false, error: 'Failed to list memberships' });
    }
  });
  router.get('/staff/expiring', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const supabase = getSupabase();
      const thirtyDaysFromNow = dayjs().add(30, 'day').toISOString();
      const { data, error } = await supabase
        .from('memberships')
        .select('id, customer_id, plan_id, status, amount, created_at')
        .eq('module_id', mounted.id)
        .eq('status', 'ACTIVE')
        .lte('expires_at', thirtyDaysFromNow)
        .order('expires_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error) {
      logger.error('[Dynamic Router] GET /staff/expiring failed', error);
      res.status(500).json({ success: false, error: 'Failed to list expiring memberships' });
    }
  });
  router.patch('/staff/:id/extend', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const { days } = req.body ?? {};
      const supabase = getSupabase();
      const { data: current, error: currentError } = await supabase
        .from('memberships')
        .select('id, expires_at')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, error: 'Membership not found' });
      const newExpiry = dayjs(current.expires_at || new Date()).add(asNumber(days, 7), 'day').toISOString();
      const { data, error } = await supabase
        .from('memberships')
        .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /staff/:id/extend failed', error);
      res.status(500).json({ success: false, error: 'Failed to extend membership' });
    }
  });
  router.patch('/staff/:id/:action', authorize(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const mounted = getMountedModule(req);
      if (!mounted) {
        return res.status(500).json({ success: false, error: 'Mounted module context missing' });
      }
      const action = req.params.action as string;
      const supabase = getSupabase();
      const { data: current, error: currentError } = await supabase
        .from('memberships')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('module_id', mounted.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ success: false, error: 'Membership not found' });
      const actor = actorForUser(req);
      const targetStatus = action === 'activate' ? 'ACTIVE' : action === 'suspend' ? 'SUSPENDED' : action === 'cancel' ? 'CANCELLED' : current.status;
      const transition = await engineService.transitionState(
        mounted.engine_type,
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
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      logger.error('[Dynamic Router] PATCH /staff/:id/:action failed', error);
      res.status(500).json({ success: false, error: 'Failed to update membership' });
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
        const engineType = mountedModule.engine_type as TemplateType;
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
        const engineType = mountedModule.engine_type as TemplateType;
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
      if (format === 'llm') return await instantTransactionParser.parseLlmImport(data as string);
      if (format === 'csv')  return await instantTransactionParser.parseCsvImport(data as Buffer);
      return instantTransactionParser.parseJsonImport(data);
    case 'shared_capacity_access':
      if (format === 'llm') return await sharedCapacityAccessParser.parseLlmImport(data as string);
      return sharedCapacityAccessParser.parseJsonImport(data);
    case 'time_exclusive_reservation':
      if (format === 'llm') return await timeExclusiveReservationParser.parseLlmImport(data as string);
      return timeExclusiveReservationParser.parseJsonImport(data);
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
      // First, get the module to find tenant_id
      const { data: module } = await supabase
        .from('modules')
        .select('tenant_id, property_id')
        .eq('id', moduleId)
        .maybeSingle();
      const moduleTenantId = module?.tenant_id ?? null;
      let tenant_id = moduleTenantId;
      if (!tenant_id && module?.property_id) {
        const { data: prop } = await supabase
          .from('properties')
          .select('tenant_id')
          .eq('id', module.property_id)
          .maybeSingle();
        tenant_id = prop?.tenant_id ?? null;
      }
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
          tenant_id,
          property_id: module?.property_id,
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
      // First, get the module to find tenant_id
      const { data: module } = await supabase
        .from('modules')
        .select('tenant_id, property_id')
        .eq('id', moduleId)
        .maybeSingle();
      const moduleTenantId = module?.tenant_id ?? null;
      let tenant_id = moduleTenantId;
      if (!tenant_id && module?.property_id) {
        const { data: prop } = await supabase
          .from('properties')
          .select('tenant_id')
          .eq('id', module.property_id)
          .maybeSingle();
        tenant_id = prop?.tenant_id ?? null;
      }
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
          starts_at: item.startTime,
          ends_at: item.endTime,
          max_capacity: item.capacity,
          price: item.adultPrice,
          is_active: item.isActive ?? true,
          module_id: moduleId,
          tenant_id,
          property_id: module?.property_id,
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
      // First, get the module to find tenant_id
      const { data: module } = await supabase
        .from('modules')
        .select('tenant_id, property_id')
        .eq('id', moduleId)
        .maybeSingle();
      const moduleTenantId = module?.tenant_id ?? null;
      let tenant_id = moduleTenantId;
      if (!tenant_id && module?.property_id) {
        const { data: prop } = await supabase
          .from('properties')
          .select('tenant_id')
          .eq('id', module.property_id)
          .maybeSingle();
        tenant_id = prop?.tenant_id ?? null;
      }
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
          tenant_id,
          property_id: module?.property_id,
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
      buildInstantTransactionRouter(router);
      break;
    case 'time_exclusive_reservation':
      buildTimeExclusiveReservationRouter(router);
      break;
    case 'shared_capacity_access':
      buildSharedCapacityAccessRouter(router);
      break;
    case 'ongoing_entitlement':
      buildOngoingEntitlementRouter(router);
      break;
    case 'platform_entitlement':
      // Platform-level engine — billing for V2 itself. Not exposed via the tenant API.
      // SaaS billing flows through /api/v1/platform/* routes only.
      router.use((_req: Request, res: Response) => {
        res.status(403).json({
          success: false,
          error: 'platform_entitlement is a platform-level engine and is not accessible via the tenant module API.',
        });
      });
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
