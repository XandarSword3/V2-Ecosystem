import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { validateBody } from '../../validation/schemas.js';
import { emitToUnit } from '../../socket/index.js';
import { autoAssignStaffToLocation, reassignStaffToLocation } from '../reservations/reservations.service.js';
import { resolveAndPriceCatalogItems } from '../../services/catalog-pricing.service.js';
import { getEngineService } from '../../engines/engine-service.js';
import { resolveModuleCurrency } from '../../engines/currency-resolver.js';
import { TEMPLATE_TO_ENGINE, type FulfillmentMode } from '../../engines/types.js';
import { changeInstantTransactionOrderStatus, actorForUser } from '../../engines/order-status.service.js';
import { getFulfillmentService } from '../fulfillment/index.js';
import { ResourceConsumptionService } from '../resource/index.js';
import { hospitalityResourceResolver } from '../../adapters/hospitality/resources.js';
import { resolveFulfillmentSelection } from '../fulfillment/fulfillment-selection.js';

// Resource lifecycle driver for item-derived fulfillment moves (plan Phase
// 5): KDS item bumps advance the fulfillment row through a DIFFERENT path
// than the order-status choke point, so consumption must be driven here
// too — the generic service is wired with the hospitality BOM resolver at
// this operational call site, never in the generic core.
const itemPathResourceConsumption = new ResourceConsumptionService(hospitalityResourceResolver);
import { computeStayBaseAmount } from '../../utils/stay-pricing.js';
import { getOrderNumber } from '../../utils/order-number.js';
import { awardLoyaltyPointsForPayment } from '../payments/loyalty-integration.js';
import dayjs from 'dayjs';

/**
 * TRANSITIONAL read-side map (Stage 6): historical instant_transaction rows
 * may still carry legacy fulfillment composites on transactions.status
 * (preparing/ready/delivered/served). New rows get their fulfillment meaning
 * from the fulfillments table; this map only lets old rows display correctly
 * until they are re-touched. It is the ONLY remaining read of legacy
 * composites, lives in the API surface (never the engine core), and should
 * be deleted once all historical rows have fulfillment rows.
 */
function legacyFulfillmentToCanonical(status: string | null): string | null {
  switch (status) {
    case 'preparing': return 'in_progress';
    case 'delivered':
    case 'served':    return 'handed_off';
    case 'ready':     return 'ready';
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
    default:          return null;
  }
}

/**
 * Dynamic Module Staff Controller
 * Handles staff operations for any module type based on slug.
 * All operational data is stored in the unified `transactions` table.
 * 
 * ENGINE TYPE MAPPINGS:
 *  - menu_service orders → engine_type: 'instant_transaction'
 *  - multi_day_booking   → engine_type: 'time_exclusive_reservation'
 *  - session_access      → engine_type: 'shared_capacity_access'
 */

// ============================================
// ORDERS (for menu_service modules)
// ============================================

/**
 * Get orders for a module by slug
 * Works for: any menu_service module
 */
export async function getModuleOrders(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { status, moduleId, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // First, get the module by slug to verify it's a menu_service type
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Module is not a menu service' });
    }

    // Build query for orders — use transactions table for instant_transaction
    // engine. Stage 6: fulfillment meaning lives in the fulfillments table, so
    // the canonical fulfillment state is joined in and returned as
    // fulfillment_status. transactions.status carries only the transaction
    // layer (pending/confirmed/completed/cancelled).
    let query = supabase
      .from('transactions')
      .select(`
        id, customer_id, staff_id, engine_type, status, amount, created_at,
        reference_id, reference_table, metadata, service_location_id,
        fulfillments ( status )
      `)
      .eq('engine_type', 'instant_transaction')
      .eq('module_id', moduleId || module.id)
      .order('created_at', { ascending: false });

    // Filter by status (Stage 6). The KDS sends legacy composite filters
    // ('preparing'/'delivered') OR canonical fulfillment states. Both are
    // translated to their canonical layer: transaction states filter
    // transactions.status, fulfillment states filter the fulfillments join.
    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim()).filter(Boolean);
      const txStatuses = new Set<string>();
      const fmStatuses = new Set<string>();
      for (const s of statuses) {
        switch (s) {
          case 'pending':
          case 'confirmed':
          case 'completed':
          case 'cancelled':
            txStatuses.add(s);
            fmStatuses.add(s); // terminal/cross-layer states also live on fulfillments
            break;
          case 'preparing':
          case 'in_progress':
            fmStatuses.add('in_progress');
            break;
          case 'ready':
            fmStatuses.add('ready');
            break;
          case 'delivered':
          case 'served':
          case 'handed_off':
            fmStatuses.add('handed_off');
            break;
          default:
            // Unknown status — let the DB filter return nothing rather than
            // silently broadening the result set.
            txStatuses.add('__none__');
        }
      }
      // Resolve fulfillment-layer statuses to transaction ids FIRST (a plain
      // query on fulfillments — deliberately avoids PostgREST embedded-resource
      // filter syntax, which varies by server version), then combine with
      // transaction-layer statuses in a single OR over the transactions query.
      // The migration backfilled a fulfillment row for every existing
      // instant_transaction row, and ensure creates one at confirm, so the
      // fulfillments table is authoritative for fulfillment meaning.
      const fmTxIds: string[] = [];
      if (fmStatuses.size > 0) {
        const { data: fmRows, error: fmError } = await supabase
          .from('fulfillments')
          .select('transaction_id')
          .in('status', [...fmStatuses]);
        if (fmError) throw fmError;
        for (const r of fmRows ?? []) fmTxIds.push(r.transaction_id);
      }
      if (txStatuses.size > 0 && fmTxIds.length > 0) {
        query = query.or(`status.in.(${[...txStatuses].join(',')}),id.in.(${fmTxIds.join(',')})`);
      } else if (txStatuses.size > 0) {
        query = query.in('status', [...txStatuses]);
      } else if (fmTxIds.length > 0) {
        query = query.in('id', fmTxIds);
      } else if (fmStatuses.size > 0) {
        // Only fulfillment states were requested and none matched — return
        // nothing rather than silently broadening to all orders. The zero
        // uuid matches no real row.
        query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    // Pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    const { data: orders, error, count } = await query;

    if (error) throw error;

    const orderIds = (orders || []).map((o) => o.id);

    // Fetch order_items for this page of orders. Previously this endpoint
    // always returned items: [] — see the commit that added order_items
    // insertion at creation time for the full story. Kept as two plain
    // queries (rather than a PostgREST embedded catalog_items(...) join)
    // since that requires a specific FK relationship name and this way
    // can't silently break if that ever changes.
    const itemsByOrder: Record<string, Array<{
      id: string; catalogItemId: string | null; name: string; quantity: number;
      unitPrice: number; subtotal: number; specialInstructions: string | null; status: string;
    }>> = {};

    if (orderIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('id, transaction_id, catalog_item_id, quantity, unit_price, subtotal, special_instructions, status')
        .in('transaction_id', orderIds);

      if (itemsError) {
        logger.warn('Failed to fetch order_items for module orders list — items will show empty', itemsError.message);
      } else if (itemRows && itemRows.length > 0) {
        const catalogIds = [...new Set(itemRows.map((r) => r.catalog_item_id).filter(Boolean))];
        const { data: catalogRows } = catalogIds.length > 0
          ? await supabase.from('catalog_items').select('id, name').in('id', catalogIds)
          : { data: [] as Array<{ id: string; name: string }> };
        const nameById = new Map((catalogRows || []).map((c) => [c.id, c.name]));

        for (const row of itemRows) {
          const list = itemsByOrder[row.transaction_id] ?? (itemsByOrder[row.transaction_id] = []);
          list.push({
            id: row.id,
            catalogItemId: row.catalog_item_id,
            name: nameById.get(row.catalog_item_id) ?? 'Item',
            quantity: row.quantity,
            unitPrice: row.unit_price,
            subtotal: row.subtotal,
            specialInstructions: row.special_instructions,
            status: row.status ?? 'pending',
          });
        }
      }
    }

    // Fetch service_locations for this page of orders.
    const locationIds = [...new Set(
      (orders || []).map((o) => (o as { service_location_id?: string | null }).service_location_id).filter(Boolean)
    )] as string[];
    const locationNameById = new Map<string, string>();
    if (locationIds.length > 0) {
      const { data: locationRows, error: locationsError } = await supabase
        .from('service_locations')
        .select('id, name')
        .in('id', locationIds);

      if (locationsError) {
        logger.warn('Failed to fetch service_locations for module orders list — falling back to metadata', locationsError.message);
      } else {
        for (const row of locationRows || []) {
          locationNameById.set(row.id, row.name);
        }
      }
    }

    // Fetch staff names for orders with staff_id
    const staffIds = [...new Set(
      (orders || []).map((o) => (o as { staff_id?: string | null }).staff_id).filter(Boolean)
    )] as string[];
    const staffNameById = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', staffIds);

      for (const row of staffRows || []) {
        const name = row.full_name || row.email || 'Staff';
        staffNameById.set(row.id, name);
      }
    }

    // Transform data for frontend
    const transformedOrders = (orders || []).map(order => {
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      const serviceLocationId = (order as { service_location_id?: string | null }).service_location_id ?? null;
      const destination = (serviceLocationId && locationNameById.get(serviceLocationId))
        || (meta.table_number as string | undefined)
        || (meta.table_id as string | undefined)
        || null;
      const rawPaymentMethod = (meta.payment_method as string | undefined) ?? 'cash';
      const isOnlinePayment = ['stripe', 'card', 'online', 'credit_card'].includes(rawPaymentMethod.toLowerCase());
      const paymentStatus = (meta.payment_status as string | undefined) ?? (
        isOnlinePayment
          ? (order.status !== 'cancelled' ? 'paid' : 'refunded')
          : (order.status === 'completed' ? 'paid' : 'unpaid')
      );
      const staffId = (order as { staff_id?: string | null }).staff_id ?? null;
      const staffName = staffId ? (staffNameById.get(staffId) ?? null) : null;
      // Stage 6: canonical fulfillment state from the fulfillments join.
      // No transitional metadata mirror exists anymore — the only fallback
      // is the legacy-composite map for pre-Stage-6 rows that have no
      // fulfillment row (historical data on live instances).
      const fulfillmentRel = (order as { fulfillments?: Array<{ status?: string | null }> | { status?: string | null } | null }).fulfillments ?? null;
      const fulfillmentStatus = Array.isArray(fulfillmentRel)
        ? (fulfillmentRel[0]?.status ?? null)
        : (fulfillmentRel?.status ?? null);
      const canonicalFulfillmentState = fulfillmentStatus ?? legacyFulfillmentToCanonical(order.status);
      return {
        id: order.id,
        orderNumber: getOrderNumber(order.id, meta),
        customerName: (meta.customer_name as string) || 'Guest',
        customerId: order.customer_id,
        staffId,
        staffName,
        orderType: (meta.order_type as string | undefined) ?? order.engine_type,
        status: order.status,
        // Canonical fulfillment state — the KDS consumes THIS, not status.
        fulfillmentStatus: canonicalFulfillmentState,
        paymentMethod: rawPaymentMethod,
        paymentStatus,
        isPaidOnline: isOnlinePayment,
        items: itemsByOrder[order.id] ?? [],
        totalAmount: order.amount,
        serviceLocationId,
        destination,
        tableNumber: destination,
        createdAt: order.created_at,
      };
    });

    res.json({
      success: true,
      data: transformedOrders,
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total: count }
    });
  } catch (error: any) {
    logger.error('Error fetching module orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders', message: error.message });
  }
}

// ============================================
// TABLES / SERVICE LOCATIONS (for instant_transaction modules)
// ============================================

/**
 * List service_locations for a module, with occupancy derived from live
 * transactions (per the design note on the service_locations table itself:
 * occupancy is derived, not stored). "Occupied" = any non-terminal
 * instant_transaction transaction tied to that location — terminal states
 * are 'completed' and 'cancelled' (see engines/definitions/instant-transaction.ts).
 *
 * NOTE: this reads occupancy off `service_location_id`, the real FK on
 * transactions. splitModuleTable/mergeModuleTables below now key off the
 * same FK (migrated off the legacy `metadata.table_id` string in the same
 * change) so splits/merges are reflected here correctly. See
 * ENGINE_A_STAFF_WORKFLOW_PLAN.md Phase 1. Rows created before this
 * migration may still be missing service_location_id — run
 * `backfill-service-location-id.ts` to backfill them from their old
 * metadata.table_id value.
 */
export async function getModuleTables(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Module is not a menu service' });
    }

    const { data: locations, error: locationsError } = await supabase
      .from('service_locations')
      .select('id, name, qr_code, is_active, sort_order')
      .eq('module_id', module.id)
      .order('sort_order', { ascending: true });

    if (locationsError) throw locationsError;

    const locationIds = (locations || []).map((l) => l.id);
    const occupiedByLocation = new Map<string, string>(); // location id -> open transaction id
    const openTransactions = new Map<string, any>(); // transaction id -> full transaction data

    if (locationIds.length > 0) {
      const { data: openTx, error: openTxError } = await supabase
        .from('transactions')
        .select('id, service_location_id, status, amount, metadata, created_at')
        .eq('engine_type', 'instant_transaction')
        .eq('module_id', module.id)
        .not('status', 'in', '(completed,cancelled)')
        .in('service_location_id', locationIds);

      if (openTxError) throw openTxError;

      for (const tx of openTx || []) {
        const locId = (tx as { service_location_id?: string | null }).service_location_id;
        // First open transaction wins if there's ever more than one — that
        // itself would be a data issue worth surfacing later, not silently
        // picking the latest.
        if (locId && !occupiedByLocation.has(locId)) {
          occupiedByLocation.set(locId, tx.id);
          openTransactions.set(tx.id, tx);
        }
      }
    }

    // Fetch order items for all open transactions to build currentOrder objects
    const transactionIds = Array.from(openTransactions.keys());
    const itemsByTransaction = new Map<string, Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      specialInstructions: string | null;
      status: string;
    }>>();

    if (transactionIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('id, transaction_id, catalog_item_id, quantity, unit_price, subtotal, special_instructions, status')
        .in('transaction_id', transactionIds);

      if (!itemsError && itemRows && itemRows.length > 0) {
        const catalogIds = [...new Set(itemRows.map((r) => r.catalog_item_id).filter(Boolean))];
        const { data: catalogRows } = catalogIds.length > 0
          ? await supabase.from('catalog_items').select('id, name').in('id', catalogIds)
          : { data: [] as Array<{ id: string; name: string }> };
        const nameById = new Map((catalogRows || []).map((c) => [c.id, c.name]));

        for (const row of itemRows) {
          const list = itemsByTransaction.get(row.transaction_id) ?? [];
          list.push({
            id: row.id,
            name: nameById.get(row.catalog_item_id) ?? 'Item',
            quantity: row.quantity,
            unitPrice: row.unit_price,
            subtotal: row.subtotal,
            specialInstructions: row.special_instructions,
            status: row.status ?? 'pending',
          });
          itemsByTransaction.set(row.transaction_id, list);
        }
      }
    }

    const tables = (locations || []).map((loc) => {
      const openTxId = occupiedByLocation.get(loc.id) ?? null;
      const tx = openTxId ? openTransactions.get(openTxId) : null;
      const meta = (tx?.metadata ?? {}) as Record<string, unknown>;

      const currentOrder = openTxId && tx ? {
        id: tx.id,
        orderNumber: getOrderNumber(tx.id, meta),
        status: tx.status,
        totalAmount: tx.amount,
        items: itemsByTransaction.get(openTxId) ?? [],
        createdAt: tx.created_at,
      } : null;

      return {
        id: loc.id,
        name: loc.name,
        qrCode: loc.qr_code,
        isActive: loc.is_active,
        sortOrder: loc.sort_order,
        isOccupied: occupiedByLocation.has(loc.id),
        openTransactionId: openTxId,
        currentOrder,
      };
    });

    res.json({ success: true, data: tables });
  } catch (error: any) {
    logger.error('Error fetching module tables:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tables', message: error.message });
  }
}

export async function splitModuleTable(req: Request, res: Response) {
  try {
    const { slug, tableId } = req.params;
    const { newTableId } = req.body as { newTableId?: string };
    const supabase = getSupabase();

    if (!newTableId) {
      return res.status(400).json({ success: false, error: 'newTableId is required' });
    }

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'instant_transaction')) {
      return res.status(400).json({ success: false, error: 'Invalid module for table operations' });
    }

    // tableId / newTableId are service_locations.id (the real FK) — verify both
    // belong to this module before touching any transactions. Previously "the
    // table" was identified via metadata->>table_id, a free-text field with no
    // referential integrity; service_location_id is now the single source of
    // truth per ENGINE_A_STAFF_WORKFLOW_PLAN.md Phase 0/1.
    const { data: locations, error: locationsError } = await supabase
      .from('service_locations')
      .select('id')
      .eq('module_id', module.id)
      .in('id', [tableId, newTableId]);

    if (locationsError) throw locationsError;

    const foundIds = new Set((locations || []).map((l) => l.id));
    if (!foundIds.has(tableId) || !foundIds.has(newTableId)) {
      return res.status(404).json({ success: false, error: 'Source or target service location not found for this module' });
    }

    // Tabs are open instant_transactions with tab_state: 'open' in metadata
    const { data: sourceTab } = await supabase
      .from('transactions')
      .select('id, customer_id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .eq('service_location_id', tableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sourceTab) {
      return res.status(404).json({ success: false, error: 'Source table has no open tab' });
    }

    const { data: existingTarget } = await supabase
      .from('transactions')
      .select('id')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .eq('service_location_id', newTableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .maybeSingle();

    if (existingTarget) {
      return res.status(409).json({ success: false, error: 'Target table already has an open tab' });
    }

    // Drop any legacy table_id off the carried-forward metadata so splits
    // stop propagating the field this migration is retiring.
    const { table_id: _legacyTableId, ...sourceMeta } = (sourceTab.metadata ?? {}) as Record<string, any>;
    const { data: newTab, error: createError } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'instant_transaction',
        status: 'pending',
        customer_id: sourceTab.customer_id,
        module_id: module.id,
        amount: 0,
        service_location_id: newTableId,
        metadata: {
          ...sourceMeta,
          tab_state: 'open',
          split_from: sourceTab.id,
        },
      })
      .select('id, metadata')
      .single();

    if (createError) throw createError;

    res.status(201).json({
      success: true,
      data: {
        sourceTabId: sourceTab.id,
        targetTabId: newTab.id,
        sourceTableId: tableId,
        targetTableId: newTableId,
      },
    });
  } catch (error: any) {
    logger.error('Error splitting table:', error);
    res.status(500).json({ success: false, error: 'Failed to split table', message: error.message });
  }
}

export async function mergeModuleTables(req: Request, res: Response) {
  try {
    const { slug, tableId } = req.params;
    const { targetTableId } = req.body as { targetTableId?: string };
    const supabase = getSupabase();

    if (!targetTableId) {
      return res.status(400).json({ success: false, error: 'targetTableId is required' });
    }

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'instant_transaction')) {
      return res.status(400).json({ success: false, error: 'Invalid module for table operations' });
    }

    // Same service_location_id validation as splitModuleTable — see comment there.
    const { data: locations, error: locationsError } = await supabase
      .from('service_locations')
      .select('id')
      .eq('module_id', module.id)
      .in('id', [tableId, targetTableId]);

    if (locationsError) throw locationsError;

    const foundIds = new Set((locations || []).map((l) => l.id));
    if (!foundIds.has(tableId) || !foundIds.has(targetTableId)) {
      return res.status(404).json({ success: false, error: 'Source or target service location not found for this module' });
    }

    const { data: sourceTab } = await supabase
      .from('transactions')
      .select('id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .eq('service_location_id', tableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: targetTab } = await supabase
      .from('transactions')
      .select('id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .eq('service_location_id', targetTableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sourceTab || !targetTab) {
      return res.status(404).json({ success: false, error: 'Both source and target tables must have open tabs' });
    }

    // Reassign all orders from source tab to target tab (via metadata) — this
    // link (order -> tab via metadata.tab_id) is a separate concept from which
    // table the tab itself sits at, and is unaffected by this migration.
    const { data: ordersToMove } = await supabase
      .from('transactions')
      .select('id, metadata')
      .eq('engine_type', 'instant_transaction')
      .contains('metadata', { tab_id: sourceTab.id });

    for (const order of ordersToMove || []) {
      await supabase
        .from('transactions')
        .update({ metadata: { ...(order.metadata as Record<string, any>), tab_id: targetTab.id } })
        .eq('id', order.id);
    }

    await supabase
      .from('transactions')
      .update({ metadata: { ...(sourceTab.metadata as Record<string, any>), tab_state: 'merged', merged_into: targetTab.id, closed_at: new Date().toISOString() } })
      .eq('id', sourceTab.id);

    res.json({
      success: true,
      data: {
        sourceTabId: sourceTab.id,
        targetTabId: targetTab.id,
      },
    });
  } catch (error: any) {
    logger.error('Error merging tables:', error);
    res.status(500).json({ success: false, error: 'Failed to merge tables', message: error.message });
  }
}

/**
 * Update order status for a module
 */
export async function updateModuleOrderStatus(req: Request, res: Response) {
  try {
    const { slug, orderId } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;
    const supabase = getSupabase();

    // Verify module exists and is correct type
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'instant_transaction')) {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    // Valid statuses (Stage 6): canonical fulfillment states for fulfillment
    // moves, transaction states for transaction moves. Legacy composites
    // (preparing/delivered) are deliberately gone — resolveAction in
    // order-status.service.ts still maps them if any old client sends them,
    // but this route fast-fails on them so nothing new starts using them.
    const validStatuses = ['pending', 'confirmed', 'queued', 'in_progress', 'ready', 'handed_off', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // This used to be two separate implementations of the same responsibility
    // — this one (hardcoded status→action switch, no module scoping, no
    // discount reversal on cancel) and dynamic-module.router.ts's
    // PATCH /orders/:id/status (engine-driven, properly module-scoped, does
    // discount reversal, but never emitted the socket event the KDS needs).
    // Both routes now delegate to the same function. See order-status.service.ts.
    const result = await changeInstantTransactionOrderStatus(supabase, {
      orderId,
      moduleId: module.id,
      moduleSlug: slug,
      moduleEngineTypeRaw: module.engine_type,
      requestedStatus: status,
      // Deliberately not actorForUser(req) here: mark_ready/deliver on the
      // engine only allow actor 'staff' (not 'admin'), but this route is
      // reachable by admins/managers too (staffRoles). Forcing 'staff'
      // regardless of real role is what makes "Mark Ready"/"Served" work
      // for everyone this route is meant to serve — switching to
      // actorForUser would silently 400 those buttons for admins/managers.
      actor: 'staff',
      userId,
      tenantId: req.user?.tenantId,
    });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.order });
  } catch (error: any) {
    logger.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order', message: error.message });
  }
}

const ITEM_STATUS_FLOW = ['pending', 'preparing', 'ready', 'served'];

/**
 * Update the status of a single order_items row — the item-level KDS.
 * Forward-only, one step at a time (mirrors the spirit of the order-level
 * state machine, but order_items isn't a registered engine entity so this
 * is enforced directly here rather than via transitionState).
 *
 * Once every item on an order reaches 'ready' or 'served', the parent
 * order is auto-advanced to match (ready→ready, served→the engine's real
 * 'delivered') via the real engine transition, actor 'staff', so staff
 * don't have to separately bump the order after bumping its last item.
 * If the order-level transition isn't currently allowed for any reason,
 * the item status update still succeeds — the order just won't
 * auto-advance that time.
 *
 * Known gap: no per-item cancel yet. An 86'd item mid-prep still has to
 * go through order-level cancel for now.
 */
export async function updateModuleOrderItemStatus(req: Request, res: Response) {
  try {
    const { slug, orderId, itemId } = req.params;
    const { status } = req.body;
    const supabase = getSupabase();

    if (!ITEM_STATUS_FLOW.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid item status. Must be one of: ${ITEM_STATUS_FLOW.join(', ')}`,
      });
    }

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    // Scope the item to both this order and this module in one query, so a
    // staff member can't bump an item belonging to a different module's (or
    // a different tenant's) order just by guessing an itemId in the URL.
    const { data: currentItem, error: itemFetchError } = await supabase
      .from('order_items')
      .select('id, status, transaction_id')
      .eq('id', itemId)
      .eq('transaction_id', orderId)
      .single();

    if (itemFetchError || !currentItem) {
      return res.status(404).json({ success: false, error: 'Order item not found' });
    }

    const { data: parentOrder, error: orderFetchError } = await supabase
      .from('transactions')
      .select('id, status, module_id, property_id, tenant_id, metadata')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (orderFetchError || !parentOrder) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    const currentIndex = ITEM_STATUS_FLOW.indexOf(currentItem.status ?? 'pending');
    const targetIndex = ITEM_STATUS_FLOW.indexOf(status);
    if (targetIndex !== currentIndex + 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot move item from '${currentItem.status}' to '${status}' — items advance one step at a time (${ITEM_STATUS_FLOW.join(' → ')}).`,
      });
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('order_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    try {
      const itemPayload = { orderId, itemId, status };
      emitToUnit(req.user?.tenantId || 'default', slug, 'order:item:status', itemPayload);
      emitToUnit(req.user?.tenantId || 'default', module.id, 'order:item:status', itemPayload);
    } catch (socketErr: any) {
      logger.warn('Failed to emit order:item:status', socketErr.message);
    }

    // Auto-derive the parent order's fulfillment state once every item hits
    // the same milestone. Only for 'ready'/'served' — 'preparing' has no
    // order-level action worth forcing, and a cancelled/completed order is
    // never touched by this regardless of item states.
    //
    // Stage 6: this derivation now writes the CANONICAL fulfillment state to
    // the fulfillments table via the fulfillment service. It NEVER touches
    // transactions.status — that stays at its transaction-layer value
    // (confirmed) until the transaction itself completes/cancels. Pre-Stage-6
    // rows without a fulfillment row are self-healed by ensure.
    //
    // Two older bugs fixed here: this used to run as actor 'system', but
    // mark_ready's allowedActors on the engine is ['staff'] only — so it
    // was rejected every single time. Runs as 'staff' now, which is accurate
    // anyway: a staff member did trigger this, just indirectly by bumping
    // the order's last item. It also used to ask for a 'mark_served' action
    // that has never existed on the engine — the item milestone is still
    // called 'served', but the order state it derives to is the engine's
    // canonical 'handed_off'.
    if (status === 'ready' || status === 'served') {
      const { data: siblingItems, error: siblingError } = await supabase
        .from('order_items')
        .select('status')
        .eq('transaction_id', orderId);

      const allAtStatus = !siblingError && (siblingItems ?? []).length > 0
        && (siblingItems ?? []).every((i) => i.status === status);

      if (allAtStatus && parentOrder.status !== 'cancelled' && parentOrder.status !== 'completed') {
        const fulfillmentService = getFulfillmentService();
        // FAIL-CLOSED: the confirm trigger created the row atomically, so the
        // row must already exist. A read error or a missing row means the
        // derivation cannot be trusted — skip it (the item update above
        // already succeeded; the order just won't auto-advance this time)
        // rather than writing fulfillment state from an assumption.
        let fulfillment: Awaited<ReturnType<typeof fulfillmentService.getForTransaction>>;
        try {
          fulfillment = await fulfillmentService.getForTransaction(supabase, orderId);
        } catch (readErr) {
          logger.error('Order auto-derivation skipped — fulfillment read failed', {
            orderId,
            error: readErr instanceof Error ? readErr.message : String(readErr),
          });
          fulfillment = null;
        }

        const engineAction = status === 'ready' ? 'mark_ready' : 'deliver';
        const result = fulfillment
          ? await fulfillmentService.transition(supabase, {
              transactionId: orderId,
              action: engineAction,
              actor: 'staff',
              actorId: req.user?.userId ?? null,
              expectedFrom: fulfillment.status,
              context: { orderId, derivedFromItems: true },
            })
          : { ok: false as const, error: 'No fulfillment row for this transaction' };

        if (result.ok && result.canonicalState) {
          // Same payload shape as order-status.service.ts — the KDS consumes
          // fulfillmentStatus, not status.
          const derivedPayload = {
            id: orderId,
            status: parentOrder.status,
            fulfillmentStatus: result.canonicalState,
            tableNumber: (parentOrder.metadata as Record<string, unknown>)?.table_number ?? null,
          };
          emitToUnit(req.user?.tenantId || 'default', slug, 'order:status', derivedPayload);
          emitToUnit(req.user?.tenantId || 'default', module.id, 'order:status', derivedPayload);

          // Resource lifecycle (plan Phase 5): the item-derived move is a
          // REAL fulfillment move — consumption at the mode's handoff must
          // fire here too, not only on the order-status choke-point path.
          // Non-fatal by design (same boundary as the choke point): the
          // move already persisted; the RPCs are idempotent.
          try {
            const lifecycle = await itemPathResourceConsumption.handleLifecycleMove(supabase, {
              transactionId: orderId,
              engineType: 'instant_transaction',
              mode: (fulfillment?.mode as FulfillmentMode | undefined) ?? undefined,
              action: engineAction,
              actor: 'staff',
              actorId: req.user?.userId ?? null,
              currentState: fulfillment!.status,
              targetState: result.canonicalState,
              layer: 'fulfillment',
              propertyId: String(parentOrder.property_id ?? ''),
              tenantId: String(parentOrder.tenant_id ?? ''),
              context: { orderId, derivedFromItems: true },
            });
            if (!lifecycle.ok) {
              logger.error('[OrderItems] Resource lifecycle move failed', {
                orderId,
                op: lifecycle.op,
                error: lifecycle.error,
              });
            }
          } catch (lifecycleErr) {
            logger.error(
              '[OrderItems] Resource lifecycle move threw',
              lifecycleErr instanceof Error ? lifecycleErr.message : String(lifecycleErr),
            );
          }
        }
        // Not allowed just means the order won't auto-advance this time —
        // the item update above already succeeded and is not rolled back.
      }
    }

    res.json({ success: true, data: updatedItem });
  } catch (error: any) {
    logger.error('Error updating order item status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order item', message: error.message });
  }
}

/**
 * Split an order's bill into equal shares for staff to collect payment
 * against separately. Deliberately does NOT create new transactions or
 * touch `amount`/`status` — actual payment collection already goes through
 * the existing cash-payment endpoint per share. This just persists the
 * split intent (method + per-share amounts) onto the order so staff
 * re-opening it see the same breakdown instead of re-deriving it.
 *
 * Frontend contract (KitchenView.splitBill): { method: 'equal', parts }.
 * Only 'equal' is implemented — itemized/by-seat splitting needs its own
 * UI to assign items to a share and isn't wired on the frontend yet.
 */
export async function splitModuleOrder(req: Request, res: Response) {
  try {
    const { slug, orderId } = req.params;
    const { method = 'equal', parts } = req.body as { method?: string; parts?: number };
    const supabase = getSupabase();

    if (method !== 'equal') {
      return res.status(400).json({ success: false, error: `Unsupported split method '${method}' — only 'equal' is implemented` });
    }

    const partsCount = Number(parts);
    if (!Number.isInteger(partsCount) || partsCount < 2 || partsCount > 20) {
      return res.status(400).json({ success: false, error: 'parts must be an integer between 2 and 20' });
    }

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    const { data: order, error: orderError } = await supabase
      .from('transactions')
      .select('id, amount, status, metadata')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({ success: false, error: `Cannot split a bill on a ${order.status} order` });
    }

    // Whole cents per share, remainder distributed one cent at a time to
    // the first N shares so they sum exactly to `amount` — no floating
    // point drift, nobody's charged a rounded-away cent.
    const totalCents = Math.round((order.amount as number) * 100);
    const baseCents = Math.floor(totalCents / partsCount);
    const remainderCents = totalCents - baseCents * partsCount;
    const shares = Array.from({ length: partsCount }, (_, i) =>
      (baseCents + (i < remainderCents ? 1 : 0)) / 100
    );

    const existingMeta = (order.metadata ?? {}) as Record<string, unknown>;
    const billSplit = {
      method: 'equal',
      parts: partsCount,
      shares,
      splitAt: new Date().toISOString(),
    };

    const { data: updatedOrder, error: updateError } = await supabase
      .from('transactions')
      .update({
        metadata: { ...existingMeta, billSplit },
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, metadata')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, data: { orderId, billSplit: (updatedOrder?.metadata as any)?.billSplit } });
  } catch (error: any) {
    logger.error('Error splitting order bill:', error);
    res.status(500).json({ success: false, error: 'Failed to split bill', message: error.message });
  }
}

// ============================================
// BOOKINGS (for multi_day_booking modules)
// ============================================

/**
 * Get bookings for a module by slug
 * Works for: any multi_day_booking module
 */
export async function getModuleBookings(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { moduleId, date, status, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // Get the module
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'time_exclusive_reservation' && module.engine_type !== 'multi_day_booking') {
      return res.status(400).json({ success: false, error: 'Module is not a booking service' });
    }

    // Build query — actual table is transactions
    let query = supabase
      .from('transactions')
      .select(`
        id, customer_id, status, amount, metadata, created_at, reference_id,
        unit:accommodation_units!reference_id(id, name, capacity),
        user:users!customer_id(id, full_name, email, phone)
      `)
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('module_id', moduleId || module.id);

    // Filter by date (check-in or check-out on this date — stored in metadata)
    if (date) {
      query = query.or(`metadata->>check_in_date.eq.${date},metadata->>check_out_date.eq.${date}`);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    const { data: bookings, error, count } = await query;

    if (error) throw error;

    // Transform for frontend
    const transformedBookings = (bookings || []).map(booking => {
      const meta = (booking.metadata ?? {}) as Record<string, unknown>;
      const rawUser = (booking as Record<string, unknown>)['user'] as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
      const rawUnit = (booking as Record<string, unknown>)['unit'] as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
      const userRow = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      const unitRow = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
      return {
        id: booking.id,
        bookingNumber: (meta.booking_number as string | undefined) ?? booking.id,
        guestName: (meta.customer_name as string) || (userRow?.['full_name'] as string | undefined) || 'Guest',
        guestEmail: (meta.customer_email as string) || (userRow?.['email'] as string | undefined),
        guestPhone: userRow?.['phone'] as string | undefined,
        unitId: booking.reference_id,
        unitName: (unitRow?.['name'] as string | undefined) || 'Unit',
        checkIn: (meta.check_in_date as string | undefined) ?? null,
        checkOut: (meta.check_out_date as string | undefined) ?? null,
        status: booking.status,
        totalPrice: booking.amount,
        guestCount: meta.number_of_guests,
        specialRequests: meta.special_requests,
        createdAt: booking.created_at,
      };
    });

    res.json({
      success: true,
      data: transformedBookings,
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total: count }
    });
  } catch (error: any) {
    logger.error('Error fetching module bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings', message: error.message });
  }
}

/**
 * Update booking status for a module
 */
export async function updateModuleBookingStatus(req: Request, res: Response) {
  try {
    const { slug, bookingId } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;
    const supabase = getSupabase();

    // Verify module
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'time_exclusive_reservation' && module.engine_type !== 'multi_day_booking')) {
      return res.status(400).json({ success: false, error: 'Invalid module for booking operations' });
    }

    // Valid statuses
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Get current booking from unified transactions
    const { data: currentBooking } = await supabase
      .from('transactions')
      .select('status, reference_id, metadata')
      .eq('id', bookingId)
      .single();

    // Use engine framework for state transitions
    const engineService = getEngineService();
    
    // Map status to engine action
    let engineAction: string;
    switch (status) {
      case 'confirmed': engineAction = 'confirm'; break;
      case 'checked_in': engineAction = 'check_in'; break;
      case 'checked_out': engineAction = 'check_out'; break;
      case 'cancelled': engineAction = 'cancel'; break;
      default: throw new Error(`Invalid status: ${status}`);
    }

    // Enforce Folio balance settlement before check-out
    if (status === 'checked_out' || engineAction === 'check_out') {
      const { data: ledgerEntries } = await supabase
        .from('payment_ledger')
        .select('event_type, amount')
        .eq('reference_type', 'room_folio')
        .eq('reference_id', bookingId)
        .eq('status', 'completed');

      const totalCharges = (ledgerEntries || [])
        .filter((e) => e.event_type === 'charge')
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const totalSettlements = (ledgerEntries || [])
        .filter((e) => e.event_type === 'settlement')
        .reduce((acc, e) => acc + Number(e.amount), 0);
      const balance = Math.max(0, Number((totalCharges - totalSettlements).toFixed(2)));

      if (balance > 0) {
        return res.status(409).json({
          success: false,
          error: 'FOLIO_BALANCE_DUE',
          message: 'Cannot check out guest with outstanding folio balance',
          balance,
          bookingId,
        });
      }
    }
    
    // Execute state transition via engine
    const { data: moduleConfig } = await supabase
      .from('modules')
      .select('engine_type')
      .eq('id', module.id)
      .single();

    const engineType = TEMPLATE_TO_ENGINE[moduleConfig?.engine_type] || 'instant_transaction';

    const transitionResult = await engineService.transitionState(
      engineType,
      currentBooking?.status || 'pending',
      engineAction,
      'staff',
      { 
        bookingId,
        staffId: userId,
        ...(status === 'checked_in' ? { actual_check_in: new Date().toISOString() } : {}),
        ...(status === 'checked_out' ? { actual_check_out: new Date().toISOString() } : {}),
      }
    );
    
    // Get updated booking
    const { data: booking, error: updateError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (updateError) throw updateError;

    // If checked out, trigger housekeeping
    if (status === 'checked_out' && currentBooking?.reference_id) {
      try {
        await supabase.from('housekeeping_tasks').insert({
          unit_id: currentBooking.reference_id,
          task_type: 'turnover',
          priority: 'high',
          status: 'pending',
          notes: `Auto-generated from checkout. Booking #${(currentBooking?.metadata as Record<string, unknown>)?.booking_number ?? bookingId}`,
          reference_id: bookingId,
          reference_table: 'transactions',
          tenant_id: req.user?.tenantId,
        });

        await supabase.from('accommodation_units').update({
          cleaning_status: 'dirty',
          updated_at: new Date().toISOString(),
        }).eq('id', currentBooking.reference_id);
      } catch (error) {
        logger.error('Failed to create housekeeping task:', error);
      }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'booking_status_update',
      resource_type: 'booking',
      resource_id: bookingId,
      details: { oldStatus: currentBooking?.status, newStatus: status, moduleSlug: slug },
      tenant_id: req.user?.tenantId,
    });

    res.json({ success: true, data: booking });
  } catch (error: any) {
    logger.error('Error updating booking status:', error);
    res.status(500).json({ success: false, error: 'Failed to update booking', message: error.message });
  }
}

/**
 * Create a staff booking for a module (walk-in booking)
 * Works for: any multi_day_booking module
 * Server-side price calculation — never trust client-supplied totals
 */
export async function createStaffBooking(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { unit_id, customer_name, customer_phone, check_in_date, check_out_date, payment_method } = req.body;
    const userId = req.user?.userId;
    const supabase = getSupabase();

    // Verify module exists and is correct type
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'time_exclusive_reservation' && module.engine_type !== 'multi_day_booking') {
      return res.status(400).json({ success: false, error: 'Module is not a booking service' });
    }

    // Validate required fields
    if (!unit_id || !check_in_date || !check_out_date) {
      return res.status(400).json({ success: false, error: 'unit_id, check_in_date, and check_out_date are required' });
    }

    // Parse dates
    const checkIn = dayjs(check_in_date);
    const checkOut = dayjs(check_out_date);

    if (!checkIn.isValid() || !checkOut.isValid()) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (checkIn.isAfter(checkOut) || checkIn.isSame(checkOut)) {
      return res.status(400).json({ success: false, error: 'Check-out date must be after check-in date' });
    }

    // Fetch unit for pricing
    const { data: unit, error: unitError } = await supabase
      .from('accommodation_units')
      .select('id, name, base_price, weekend_price, capacity')
      .eq('id', unit_id)
      .eq('module_id', module.id)
      .maybeSingle();

    if (unitError || !unit) {
      return res.status(404).json({ success: false, error: 'Unit not found or does not belong to this module' });
    }

    // Fetch active unit price rules for seasonal pricing
    const { data: priceRules } = await supabase
      .from('unit_price_rules')
      .select('start_date, end_date, price, price_multiplier')
      .eq('unit_id', unit_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // Calculate server-side price
    const basePrice = parseFloat(unit.base_price || '0');
    const weekendPrice = parseFloat(unit.weekend_price || unit.base_price || '0');
    const totalAmount = computeStayBaseAmount(
      checkIn,
      checkOut,
      basePrice,
      weekendPrice,
      priceRules || [],
    );

    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid pricing calculation' });
    }

    // Generate booking number
    const bookingNumber = `BK${Date.now().toString().slice(-8)}`;

    // Create the transaction
    const { data: booking, error: createError } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'time_exclusive_reservation',
        status: 'confirmed',
        customer_id: null, // Walk-in, no customer account
        module_id: module.id,
        reference_id: unit_id,
        reference_table: 'accommodation_units',
        amount: totalAmount,
        metadata: {
          booking_number: bookingNumber,
          customer_name: customer_name || 'Walk-in Guest',
          customer_phone: customer_phone || '',
          check_in_date: check_in_date,
          check_out_date: check_out_date,
          number_of_guests: 1,
          payment_method: payment_method || 'cash',
          created_by_staff: userId,
        },
      })
      .select(`
        id,
        status,
        amount,
        metadata,
        created_at,
        unit:accommodation_units!reference_id(id, name, capacity)
      `)
      .single();

    if (createError) throw createError;

    // Emit socket event for real-time updates
    emitToUnit(req.user?.tenantId || 'default', 'accommodation_units', 'booking:new', {
      bookingId: booking.id,
      unitId: unit_id,
      moduleName: module.engine_type,
    });

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'staff_booking_created',
      resource_type: 'booking',
      resource_id: booking.id,
      details: { 
        bookingNumber, 
        unitId: unit_id, 
        checkIn: check_in_date, 
        checkOut: check_out_date,
        amount: totalAmount,
        moduleSlug: slug 
      },
      tenant_id: req.user?.tenantId,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    logger.error('Error creating staff booking:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking', message: error.message });
  }
}

// ============================================
// SESSIONS (for session_access modules)
// ============================================

/**
 * Get sessions for a module by slug
 * Works for: any session_access module
 */
export async function getModuleSessions(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { date, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // Get the module
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Module is not a session access service' });
    }

    // Actual table is capacity_windows — no per-date filter, sessions are time windows not calendar days
    const { data: sessions, error } = await supabase
      .from('capacity_windows')
      .select(`
        id, name, starts_at, ends_at, max_capacity,
        tickets:transactions(id, status, customer_id, user:users!customer_id(full_name))
      `)
      .filter('tickets.engine_type', 'eq', 'shared_capacity_access')
      .eq('module_id', module.id)
      .order('starts_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: sessions || [] });
  } catch (error: any) {
    logger.error('Error fetching module sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions', message: error.message });
  }
}

/**
 * Validate a ticket for a module
 */
export async function validateModuleTicket(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { ticketNumber } = req.body;
    const supabase = getSupabase();

    // Get the module
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket validation' });
    }

    // Find the ticket — ticket_number is stored in metadata
    const { data: ticket, error } = await supabase
      .from('transactions')
      .select(`
        id, status, customer_id, metadata,
        session:capacity_windows!reference_id(id, name, max_capacity)
      `)
      .filter('metadata->>ticket_number', 'eq', ticketNumber)
      .eq('engine_type', 'shared_capacity_access')
      .eq('module_id', module.id)
      .maybeSingle();

    if (error || !ticket) {
      return res.json({
        success: true,
        data: { valid: false, reason: 'Ticket not found' }
      });
    }

    const session = Array.isArray(ticket.session) ? ticket.session[0] : ticket.session;
    const meta = (ticket.metadata ?? {}) as Record<string, unknown>;

    // Check ticket status
    if (ticket.status === 'used' || ticket.status === 'expired') {
      return res.json({
        success: true,
        data: { valid: false, reason: 'Ticket has already been used', ticket }
      });
    }

    if (ticket.status === 'cancelled') {
      return res.json({
        success: true,
        data: { valid: false, reason: 'Ticket has been cancelled', ticket }
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        ticket: {
          id: ticket.id,
          ticketNumber: (meta.ticket_number as string | undefined) ?? null,
          status: ticket.status,
          guestName: (meta.customer_name as string) || 'Guest',
          sessionName: session?.name,
          entryTime: meta.entry_time,
          exitTime: meta.exit_time,
        }
      }
    });
  } catch (error: any) {
    logger.error('Error validating ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to validate ticket', message: error.message });
  }
}

// ============================================
// ENTRY / EXIT / CAPACITY (for session_access)
// ============================================

/**
 * Record entry for a ticket holder
 */
export async function recordEntry(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { ticketId } = req.body;
    const supabase = getSupabase();

    // Verify module
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for entry operations' });
    }

    // Use engine framework for state transition
    const engineService = getEngineService();
    
    // Get current ticket from unified transactions
    const { data: currentTicket, error: fetchError } = await supabase
      .from('transactions')
      .select('status, reference_id')
      .eq('id', ticketId)
      .eq('engine_type', 'shared_capacity_access')
      .single();
      
    if (fetchError || !currentTicket) throw fetchError || new Error('Ticket not found');
    
    // Execute state transition via engine (entry = validate_entry)
    const transitionResult = await engineService.transitionState(
      module.engine_type,
      currentTicket.status,
      'validate_entry',
      'staff',
      { ticketId, sessionId: currentTicket.reference_id }
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({ success: false, error: transitionResult.error ?? 'Invalid transition' });
    }

    // Update status in transactions table
    const entryTime = new Date().toISOString();
    const { data: ticket, error: updateError } = await supabase
      .from('transactions')
      .update({ status: transitionResult.targetState, updated_at: entryTime })
      .eq('id', ticketId)
      .select('id, status, metadata, amount, created_at')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('Error recording entry:', error);
    res.status(500).json({ success: false, error: 'Failed to record entry', message: error.message });
  }
}

/**
 * Record exit for a ticket holder
 */
export async function recordExit(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { ticketId } = req.body;
    const supabase = getSupabase();

    // Verify module
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for exit operations' });
    }

    // Use engine framework for state transition
    const engineService = getEngineService();
    
    // Get current ticket from unified transactions
    const { data: currentTicket, error: fetchError } = await supabase
      .from('transactions')
      .select('status, reference_id')
      .eq('id', ticketId)
      .eq('engine_type', 'shared_capacity_access')
      .single();
      
    if (fetchError || !currentTicket) throw fetchError || new Error('Ticket not found');
    
    // Execute state transition via engine (exit = record_exit)
    const transitionResult = await engineService.transitionState(
      module.engine_type,
      currentTicket.status,
      'record_exit',
      'staff',
      { ticketId, sessionId: currentTicket.reference_id }
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({ success: false, error: transitionResult.error ?? 'Invalid transition' });
    }

    // Update status in transactions table
    const exitTime = new Date().toISOString();
    const { data: ticket, error: updateError } = await supabase
      .from('transactions')
      .update({ status: transitionResult.targetState, updated_at: exitTime })
      .eq('id', ticketId)
      .select('id, status, metadata, amount, created_at')
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('Error recording exit:', error);
    res.status(500).json({ success: false, error: 'Failed to record exit', message: error.message });
  }
}

/**
 * Get capacity/occupancy stats for a session_access module
 */
export async function getModuleCapacity(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { date } = req.query;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for capacity operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    const { data: sessions, error } = await supabase
      .from('capacity_windows')
      .select('id, name, max_capacity, starts_at, ends_at')
      .eq('module_id', module.id)
      .eq('is_active', true)
      .order('starts_at', { ascending: true });

    if (error) throw error;

    const totalCapacity = (sessions || []).reduce((sum, s) => sum + (s.max_capacity || 0), 0);

    res.json({
      success: true,
      data: {
        date: targetDate,
        totalCapacity,
        totalOccupancy: 0,
        utilizationPercent: 0,
        sessions: (sessions || []).map(s => ({
          id: s.id,
          name: s.name,
          capacity: s.max_capacity,
          currentCount: 0,
          startTime: s.starts_at,
          endTime: s.ends_at,
          utilizationPercent: 0,
        })),
      }
    });
  } catch (error: any) {
    logger.error('Error fetching module capacity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch capacity', message: error.message });
  }
}

/**
 * Get today's tickets for a session_access module
 */
export async function getTodaysTickets(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { date, status } = req.query;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('transactions')
      .select(`
        id, customer_id, status, amount, created_at, metadata,
        session:capacity_windows!reference_id(id, name, starts_at, ends_at)
      `)
      .eq('module_id', module.id)
      .eq('engine_type', 'shared_capacity_access')
      .eq('metadata->>ticket_date', targetDate) // Date is in metadata for tickets
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status as string);
    }

    const { data: tickets, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: (tickets || []).map(t => {
        const tMeta = (t.metadata ?? {}) as Record<string, unknown>;
        const rawSession = (t as Record<string, unknown>)['session'] as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
        const sess = Array.isArray(rawSession) ? rawSession[0] : rawSession;
        return {
          id: t.id,
          ticketNumber: (tMeta.ticket_number as string | undefined) ?? null,
          customerName: (tMeta.customer_name as string) ?? null,
          customerPhone: (tMeta.customer_phone as string) ?? null,
          guests: tMeta.number_of_guests,
          status: t.status,
          paymentStatus: t.status === 'completed' || t.status === 'valid' ? 'paid' : 'pending',
          entryTime: tMeta.entry_time,
          exitTime: tMeta.exit_time,
          totalAmount: t.amount,
          sessionName: sess?.name,
          sessionTime: `${sess?.starts_at ?? ''} - ${sess?.ends_at ?? ''}`,
        };
      }),
    });
  } catch (error: any) {
    logger.error('Error fetching today\'s tickets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets', message: error.message });
  }
}

// ============================================
// MAINTENANCE LOGS (for session_access modules)
// ============================================

/**
 * Get maintenance logs for a module
 */
export async function getModuleMaintenanceLogs(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for maintenance operations' });
    }

    const { data: logs, error } = await supabase
      .from('maintenance_logs')
      .select('id, type, readings, notes, created_at, performed_by, users:users!performed_by(full_name)')
      .eq('module_id', module.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, data: logs || [] });
  } catch (error: any) {
    logger.error('Error fetching maintenance logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch maintenance logs', message: error.message });
  }
}

/**
 * Create a maintenance log entry for a module
 */
export async function createModuleMaintenanceLog(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { type, notes, readings } = req.body;
    const userId = (req as any).user?.id;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || (module.engine_type !== 'shared_capacity_access' && module.engine_type !== 'session_access')) {
      return res.status(400).json({ success: false, error: 'Invalid module for maintenance operations' });
    }

    const { data: log, error } = await supabase
      .from('maintenance_logs')
      .insert({
        module_id: module.id,
        type: type || 'inspection',
        notes: notes || '',
        readings: readings || {},
        performed_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: log });
  } catch (error: any) {
    logger.error('Error creating maintenance log:', error);
    res.status(500).json({ success: false, error: 'Failed to create maintenance log', message: error.message });
  }
}

/**
 * POST /api/v1/staff/scan
 * Unified QR scanner endpoint mounted on module-staff routes.
 */
export async function scanCode(req: Request, res: Response) {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) {
      return res.status(400).json({ valid: false, message: 'code is required' });
    }

    const supabase = getSupabase();
    let parsed: { type?: string; id?: string } | null = null;
    try {
      parsed = JSON.parse(code);
    } catch {
      try {
        const decoded = Buffer.from(code, 'base64url').toString('utf-8');
        parsed = JSON.parse(decoded) as { type?: string; id?: string };
      } catch {
        parsed = null;
      }
    }

    if (!parsed?.type || !parsed?.id) {
      return res.status(400).json({
        valid: false,
        message: 'Invalid QR format. Expected JSON with { type, id }',
      });
    }

    const { id } = parsed;

    // Validate by reference_id or ticket_number (unified approach)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from('transactions').select('*');
    query = isUuid ? query.eq('id', id) : query.eq('ticket_number', id);
    
    const { data, error } = await query.single();
    if (error || !data) {
      return res.status(404).json({ valid: false, entity: null, message: 'Resource not found' });
    }
    
    return res.json({ valid: true, type: data.engine_type, entity: data, message: 'Scan successful' });
  } catch (error: any) {
    logger.error('Error scanning QR code:', error);
    res.status(500).json({ valid: false, message: 'Failed to scan code' });
  }
}

/**
 * GET /api/v1/staff/customers/search?q=...
 * Staff-safe customer search mounted on module-staff routes.
 */
export async function searchCustomers(req: Request, res: Response) {
  try {
    const q = String(req.query?.q || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: 'q query parameter is required' });
    }

    const supabase = getSupabase();
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, created_at')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .eq('scope', 'customer')
      .limit(20);

    if (error) throw error;
    const rows = users || [];
    if (rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const customerIds = rows.map((u) => u.id);
    const [orderHistory, entitlements, loyaltyAccounts] = await Promise.all([
    supabase.from('transactions').select('customer_id, amount, created_at').in('customer_id', customerIds),
    supabase.from('transactions').select('customer_id, status').eq('engine_type', 'ongoing_entitlement').in('customer_id', customerIds),
    supabase.from('loyalty_accounts').select('user_id, tier_name').in('user_id', customerIds),
    ]);

    const spendByCustomer: Record<string, number> = {};
    const recentOrderByCustomer: Record<string, string> = {};
    const membershipByCustomer: Record<string, string> = {};
    const tierByCustomer: Record<string, string> = {};

    const rollupFinancialRows = (items: Array<{ customer_id: string; amount?: string | number; created_at?: string }> = []) => {
      items.forEach((row) => {
        const amount = Number(row.amount || 0);
        spendByCustomer[row.customer_id] = (spendByCustomer[row.customer_id] || 0) + amount;
        if (row.created_at) {
          const existing = recentOrderByCustomer[row.customer_id];
          if (!existing || new Date(row.created_at) > new Date(existing)) {
            recentOrderByCustomer[row.customer_id] = row.created_at;
          }
        }
      });
    };

    rollupFinancialRows((orderHistory.data as Array<{ customer_id: string; amount?: string | number; created_at?: string }>) || []);

    ((entitlements.data as Array<{ customer_id: string; status?: string }>) || []).forEach((m) => {
      if (!membershipByCustomer[m.customer_id]) membershipByCustomer[m.customer_id] = m.status || 'inactive';
    });
    ((loyaltyAccounts.data as Array<{ user_id: string; tier_name?: string }>) || []).forEach((l) => {
      if (!tierByCustomer[l.user_id]) tierByCustomer[l.user_id] = l.tier_name || 'Standard';
    });

    const safeResults = rows.map((user) => ({
      id: user.id,
      name: user.full_name || 'Customer',
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      lifetime_spend: Number((spendByCustomer[user.id] || 0).toFixed(2)),
      loyalty_tier: tierByCustomer[user.id] || 'Standard',
      membership_status: membershipByCustomer[user.id] || 'inactive',
      last_order_at: recentOrderByCustomer[user.id] || null,
    }));

    res.json({ success: true, data: safeResults });
  } catch (error: any) {
    logger.error('Error searching customers:', error);
    res.status(500).json({ success: false, error: 'Failed to search customers', message: error.message });
  }
}

/**
 * Create a staff order for a module (instant_transaction POS)
 * POST /staff/modules/:slug/orders
 */
export async function createModuleOrder(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { serviceLocationId: reqServiceLocId, tableId, tableNumber, customerName, customerId, items, notes, orderType, paymentMethod } = req.body;
    const serviceLocationId = reqServiceLocId || tableId;
    // A staff order knows what it is: table orders are dine-in, everything else
    // (Quick Order tab, no service location) is a counter order. Persisted on
    // metadata.order_type so every downstream consumer (orders list, KDS,
    // receipt, analytics) sees a real value rather than the raw engine_type.
    const resolvedOrderType = orderType ?? (serviceLocationId ? 'dine_in' : 'counter');
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string | undefined);
    const supabase = getSupabase();

    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Module is not an instant_transaction module' });
    }

    // Verify service location if provided
    let locationName = tableNumber;
    let locationId = serviceLocationId;
    if (serviceLocationId) {
      const { data: loc } = await supabase
        .from('service_locations')
        .select('id, name')
        .eq('id', serviceLocationId)
        .eq('module_id', module.id)
        .single();
      if (loc) {
        locationName = loc.name;
        locationId = loc.id;
      }
    }

    // Stage 6 fix: staff-created orders are inserted directly as 'confirmed',
    // so the fulfillment selection must be snapshotted HERE — the confirm
    // trigger copies it into the fulfillment row and refuses to confirm an
    // order without it. Resolved + capability-validated (typed domain values).
    const fulfillmentSelection = resolveFulfillmentSelection('instant_transaction', {
      orderType: resolvedOrderType,
      serviceLocationId: locationId,
      tableNumber: locationName,
      address: req.body?.address ?? req.body?.deliveryAddress ?? null,
    });

    const orderItemsInput = Array.isArray(items) ? items : [];

    // Staff orders price through the SAME pipeline the customer path uses,
    // instead of hand-rolling qty * (client-supplied unitPrice). Prices are
    // resolved server-side from catalog_items, so a staff caller can't
    // over/under-charge by sending their own unitPrice.
    let pricing: any = null;
    let resolvedItems: Array<{
      itemId: string;
      name: string;
      basePrice: number;
      quantity: number;
      modifierAdjustment: number;
      taxCategory: string;
      metadata?: Record<string, unknown>;
    }> = [];
    let receiptLineItems: Array<Record<string, unknown>> = [];

    if (orderItemsInput.length > 0) {
      const catalogRequests = orderItemsInput.map((i: any) => ({
        catalog_item_id: i.catalogItemId || i.itemId || i.id,
        quantity: Number(i.quantity || i.qty || 1),
        ...(Array.isArray(i.selectedModifiers) && i.selectedModifiers.length > 0
          ? { metadata: { selectedModifiers: i.selectedModifiers } }
          : {}),
      }));

      const catalogResult = await resolveAndPriceCatalogItems(catalogRequests, module.id);
      if (catalogResult.validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_CATALOG_ITEMS',
          message: 'One or more items could not be priced',
          details: catalogResult.validationErrors,
        });
      }
      resolvedItems = catalogResult.resolvedItems;

      const lineItems = resolvedItems.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.basePrice + item.modifierAdjustment,
        metadata: item.metadata,
        taxCategory: item.taxCategory,
      }));

      const engineService = getEngineService();
      pricing = await engineService.calculatePricing('instant_transaction', lineItems, {
        moduleId: module.id,
        propertyId: propertyId ?? undefined,
        currency: await resolveModuleCurrency(module.id, propertyId),
        customerId: customerId ?? undefined,
        staffId: userId ?? undefined,
        conditions: { orderType: resolvedOrderType, paymentMethod: paymentMethod || 'cash' },
      });

      receiptLineItems = resolvedItems.map((item) => {
        const unitPrice = item.basePrice + item.modifierAdjustment;
        return {
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
          ...(Array.isArray(item.metadata?.selectedModifiers)
            ? { selectedModifiers: item.metadata.selectedModifiers }
            : {}),
        };
      });
    }

    const totalAmount = pricing ? pricing.totalAmount : 0;
    const taxAmount = pricing ? pricing.taxAmount : 0;
    const discountAmount = pricing ? pricing.totalDiscount : 0;

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase().slice(-5)}`;

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'instant_transaction',
        status: 'confirmed',
        amount: Math.round(totalAmount * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        discount_amount: Math.round(discountAmount * 100) / 100,
        module_id: module.id,
        service_location_id: locationId || null,
        staff_id: userId || null,
        customer_id: customerId || null,
        tenant_id: tenantId,
        property_id: propertyId,
        metadata: {
          order_number: orderNumber,
          customer_name: customerName || 'Guest',
          table_number: locationName || null,
          table_id: locationId || null,
          order_type: resolvedOrderType,
          notes: notes || null,
          // Typed fulfillment selection snapshot (see resolver above).
          fulfillment_mode: fulfillmentSelection.mode,
          fulfillment_destination_type: fulfillmentSelection.destinationType,
          fulfillment_destination_ref: fulfillmentSelection.destinationRef,
          payment_status: 'unpaid',
          // No payment-method default: an unpaid order has no method until
          // payModuleOrder settles it. Passing paymentMethod here is only
          // meaningful for flows that settle at creation time.
          payment_method: paymentMethod || null,
          // The full pricing breakdown is snapshotted at creation so
          // payModuleOrder can record the exact same numbers to the financial
          // ledger when payment actually happens (see payModuleOrder).
          ...(pricing ? { pricing } : {}),
          ...(receiptLineItems.length > 0 ? { lineItems: receiptLineItems } : {}),
        },
      })
      .select()
      .single();

    if (txError) throw txError;

    // Deduct inventory atomically with audit trail; roll back on stock failure
    if (resolvedItems.length > 0) {
      const deductionPayload = resolvedItems.map((item) => ({
        catalog_item_id: item.itemId,
        quantity: item.quantity,
      }));
      const { error: deductError } = await supabase.rpc('deduct_inventory_for_order_items', {
        p_items: deductionPayload,
        p_user_id: userId || null,
        p_order_id: transaction.id,
      });

      if (deductError) {
        logger.warn('Staff order creation rejected due to insufficient stock:', deductError.message);
        await supabase.from('transactions').delete().eq('id', transaction.id);
        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: deductError.message || 'One or more items in the order are out of stock',
        });
      }
    }

    const createdItems: any[] = [];
    if (resolvedItems.length > 0) {
      // selectedModifiers isn't sent by any current staff UI (StaffPOSTemplate /
      // AdminPOSTemplate have no customization selector today — only the
      // customer-facing MenuService/DynamicModuleRenderer flow does), so this
      // is defensive: if a caller ever does send it (future staff modifier UI,
      // a customer-cart handoff, direct API use), it's captured and actually
      // acted on below instead of silently discarded.
      const itemInserts = resolvedItems.map((item, index) => {
        const source = (orderItemsInput[index] ?? {}) as any;
        const unitPrice = item.basePrice + item.modifierAdjustment;
        return {
          transaction_id: transaction.id,
          catalog_item_id: item.itemId,
          quantity: item.quantity,
          unit_price: unitPrice,
          subtotal: Math.round(unitPrice * item.quantity * 100) / 100,
          special_instructions: source.notes || source.instructions || null,
          status: 'pending',
          // order_items.tenant_id / property_id are NOT NULL — omitting them
          // silently failed the insert for every staff order (the error was
          // swallowed as a warn), so staff orders never had order_items: the
          // kitchen never saw them and the BOM resolver found nothing to
          // allocate. Mirrors the customer path exactly.
          tenant_id: tenantId,
          property_id: propertyId,
          metadata: {
            ...(Array.isArray(item.metadata?.selectedModifiers) && item.metadata.selectedModifiers.length > 0
              ? { selectedModifiers: item.metadata.selectedModifiers }
              : {}),
          },
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(itemInserts)
        .select('*');

      if (itemsError) {
        logger.warn('Failed inserting order items for staff order:', itemsError.message);
      } else {
        createdItems.push(...(insertedItems || []));
      }

      // Process customization inventory for items with selectedModifiers.
      // Mirrors dynamic-module.router.ts's customer order path exactly —
      // same RPC, same order_type, same compensating transaction on
      // failure — so the two order-creation paths stay consistent instead
      // of silently diverging in what they deduct. Order totals now come
      // from calculatePricing (see above), so modifier price adjustments
      // are included in the charged amount and in the snapshotted pricing.
      if (createdItems.length > 0) {
        try {
          for (const orderItem of createdItems) {
            const selectedModifiers = orderItem.metadata?.selectedModifiers;
            if (!selectedModifiers || !Array.isArray(selectedModifiers) || selectedModifiers.length === 0) {
              continue;
            }

            const selections = selectedModifiers.map((mod: any) => ({
              groupId: mod.groupId,
              optionId: mod.optionId,
              quantity: mod.quantity || 1,
            }));

            const { error: customizationError } = await supabase.rpc('create_order_customization_snapshot', {
              p_order_type: 'instant_transaction',
              p_order_id: transaction.id,
              p_order_item_id: orderItem.id,
              p_entity_type: 'catalog_item',
              p_entity_id: orderItem.catalog_item_id,
              p_selections: selections,
              p_base_quantity: orderItem.quantity,
              p_execute_inventory: true,
            });

            if (customizationError) {
              logger.error('[Staff Order] Customization inventory deduction failed, rolling back order:', {
                error: customizationError.message,
                orderId: transaction.id,
              });
              await supabase.from('order_items').delete().eq('transaction_id', transaction.id);
              await supabase.from('transactions').delete().eq('id', transaction.id);
              return res.status(400).json({
                success: false,
                error: 'INSUFFICIENT_STOCK_CUSTOMIZATION',
                message: 'One or more customizations in this order are out of stock',
              });
            }
          }
        } catch (customizationErr: any) {
          logger.error('[Staff Order] Exception during customization inventory processing:', customizationErr);
          await supabase.from('order_items').delete().eq('transaction_id', transaction.id);
          await supabase.from('transactions').delete().eq('id', transaction.id);
          return res.status(400).json({
            success: false,
            error: 'INSUFFICIENT_STOCK_CUSTOMIZATION',
            message: customizationErr?.message || 'Failed to process customizations',
          });
        }
      }
    }

    // Resource allocation (plan Phase 5 — no-window invariant). The staff
    // path creates orders DIRECTLY as 'confirmed' (no choke-point confirm
    // transition), so the pre-flight allocation runs here, right after the
    // order_items exist — the same invariant the choke point enforces: an
    // order is never confirmed without its allocation. Physical stock was
    // already deducted at creation above (the ONE stock authority); this
    // records the generic reservation. On failure the order is rolled back.
    const allocation = await itemPathResourceConsumption.allocateForConfirmation(supabase, {
      transactionId: transaction.id,
      engineType: 'instant_transaction',
      mode: fulfillmentSelection.mode as FulfillmentMode | undefined,
      propertyId: String(propertyId ?? ''),
      tenantId: String(tenantId ?? ''),
      context: { orderId: transaction.id, staffCreated: true },
    });
    if (!allocation.ok) {
      logger.error('[Staff Order] Refusing staff order — resource allocation failed', {
        orderId: transaction.id,
        error: allocation.error,
      });
      await supabase.from('order_items').delete().eq('transaction_id', transaction.id);
      await supabase.from('fulfillments').delete().eq('transaction_id', transaction.id);
      await supabase.from('resource_allocations').delete().eq('transaction_id', transaction.id);
      await supabase.from('transactions').delete().eq('id', transaction.id);
      return res.status(409).json({
        success: false,
        error: 'RESOURCE_ALLOCATION_FAILED',
        message: allocation.error || 'Resource allocation failed for this order',
      });
    }

    const resultPayload = {
      id: transaction.id,
      orderNumber,
      customerName: customerName || 'Guest',
      status: transaction.status,
      totalAmount: transaction.amount,
      serviceLocationId: locationId || null,
      tableNumber: locationName || null,
      items: createdItems,
      createdAt: transaction.created_at,
    };

    try {
      emitToUnit(tenantId || 'default', slug, 'order:new', resultPayload);
      emitToUnit(tenantId || 'default', module.id, 'order:new', resultPayload);
    } catch (sErr: any) {
      logger.warn('Failed emitting order:new socket event:', sErr.message);
    }

    res.status(201).json({ success: true, data: resultPayload });
  } catch (error: any) {
    logger.error('Error creating module order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order', message: error.message });
  }
}

/**
 * Add an item to an existing staff module order
 * POST /staff/modules/:slug/orders/:orderId/items
 */
export async function addModuleOrderItem(req: Request, res: Response) {
  try {
    const { slug, orderId } = req.params;
    const { catalogItemId, itemId, quantity, notes } = req.body;
    const supabase = getSupabase();

    const targetCatalogId = catalogItemId || itemId;
    const qty = Number(quantity || 1);

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    const { data: order, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, amount, status, metadata, tenant_id, property_id, customer_id')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, error: `Cannot add items to a ${order.status} order` });
    }

    const orderMeta = (order.metadata ?? {}) as Record<string, any>;

    // Phase 5 invariant: an order whose fulfillment has already reached the
    // handoff/consumption point can never accept new items — the new
    // allocation rows could never be consumed (the completion move skips
    // consumption, by design). Fail-closed: a fulfillment read error refuses
    // the write rather than proceeding on a stale assumption.
    let fulfillmentStatus: string | null = null;
    try {
      const f = await getFulfillmentService().getForTransaction(supabase, order.id);
      fulfillmentStatus = f?.status ?? null;
    } catch (fErr) {
      logger.error('[Staff Order] Failed reading fulfillment state before adding item:', fErr);
      return res.status(500).json({ success: false, error: 'Failed to verify order state', message: 'Could not verify fulfillment state before adding the item' });
    }
    if (fulfillmentStatus === 'handed_off' || fulfillmentStatus === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot add items to an order that has already been served' });
    }

    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId ?? order.tenant_id ?? null;
    const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string | undefined) || order.property_id || null;

    // Price the FULL item set (existing order_items + the new line) through
    // the same server-side pipeline createModuleOrder uses — a staff caller
    // can't over/under-charge by sending their own unitPrice, and the
    // transaction amount + pricing snapshot stay consistent after the add.
    const { data: existingItems, error: existingErr } = await supabase
      .from('order_items')
      .select('catalog_item_id, quantity, metadata')
      .eq('transaction_id', order.id);
    if (existingErr) throw existingErr;

    const catalogRequests = [
      ...(existingItems ?? []).map((i: any) => ({
        catalog_item_id: i.catalog_item_id,
        quantity: Number(i.quantity),
        ...(i.metadata?.selectedModifiers && Array.isArray(i.metadata.selectedModifiers) && i.metadata.selectedModifiers.length > 0
          ? { metadata: { selectedModifiers: i.metadata.selectedModifiers } }
          : {}),
      })),
      {
        catalog_item_id: targetCatalogId,
        quantity: qty,
        ...(notes ? { metadata: { notes } } : {}),
      },
    ];

    const catalogResult = await resolveAndPriceCatalogItems(catalogRequests, module.id);
    if (catalogResult.validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CATALOG_ITEMS',
        message: 'One or more items could not be priced',
        details: catalogResult.validationErrors,
      });
    }
    const resolvedItems = catalogResult.resolvedItems;
    const newResolvedItem = resolvedItems.find((r) => r.itemId === targetCatalogId);
    if (!newResolvedItem) {
      return res.status(400).json({ success: false, error: 'Item could not be resolved for pricing' });
    }

    const lineItems = resolvedItems.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.basePrice + item.modifierAdjustment,
      metadata: item.metadata,
      taxCategory: item.taxCategory,
    }));

    const engineService = getEngineService();
    const pricing = await engineService.calculatePricing('instant_transaction', lineItems, {
      moduleId: module.id,
      propertyId: propertyId ?? undefined,
      currency: await resolveModuleCurrency(module.id, propertyId),
      customerId: order.customer_id ?? undefined,
      staffId: userId ?? undefined,
      conditions: {
        orderType: orderMeta.order_type ?? 'dine_in',
        paymentMethod: orderMeta.payment_method ?? 'cash',
      },
    });

    const receiptLineItems = resolvedItems.map((item) => {
      const unitPrice = item.basePrice + item.modifierAdjustment;
      return {
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        ...(Array.isArray(item.metadata?.selectedModifiers)
          ? { selectedModifiers: item.metadata.selectedModifiers }
          : {}),
      };
    });

    // Stock for the NEW line only, through the ONE inventory authority
    // (creation-time deduction RPC — same as createModuleOrder; add-item is
    // a creation-time-equivalent stock event, never a second authority).
    // The RPC raises on shortfall, rolling back its own deductions.
    const deductionPayload = [{ catalog_item_id: targetCatalogId, quantity: newResolvedItem.quantity }];
    const { error: deductError } = await supabase.rpc('deduct_inventory_for_order_items', {
      p_items: deductionPayload,
      p_user_id: userId || null,
      p_order_id: order.id,
    });
    if (deductError) {
      logger.warn('Add item rejected due to insufficient stock:', deductError.message);
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: deductError.message || 'One or more items in the order are out of stock',
      });
    }

    const newUnitPrice = newResolvedItem.basePrice + newResolvedItem.modifierAdjustment;
    const { data: newItem, error: insertErr } = await supabase
      .from('order_items')
      .insert({
        transaction_id: order.id,
        catalog_item_id: targetCatalogId,
        quantity: newResolvedItem.quantity,
        unit_price: newUnitPrice,
        subtotal: Math.round(newUnitPrice * newResolvedItem.quantity * 100) / 100,
        special_instructions: notes || null,
        status: 'pending',
        // order_items.tenant_id / property_id are NOT NULL — omitting them
        // silently failed this insert for every staff add-item (same bug as
        // createModuleOrder's item insert, fixed there).
        tenant_id: tenantId,
        property_id: propertyId,
      })
      .select('*')
      .single();

    if (insertErr) {
      await supabase.rpc('restore_inventory_for_order_items', {
        p_items: deductionPayload,
        p_user_id: userId || null,
      });
      throw insertErr;
    }

    const newTotal = Math.round(pricing.totalAmount * 100) / 100;
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        amount: newTotal,
        tax_amount: Math.round(pricing.taxAmount * 100) / 100,
        discount_amount: Math.round(pricing.totalDiscount * 100) / 100,
        metadata: { ...orderMeta, pricing, lineItems: receiptLineItems },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateErr) {
      await supabase.from('order_items').delete().eq('id', newItem.id);
      await supabase.rpc('restore_inventory_for_order_items', {
        p_items: deductionPayload,
        p_user_id: userId || null,
      });
      throw updateErr;
    }

    // Incremental generic allocation (Phase 5). allocate_resources is
    // idempotent per (transaction_id, kind, resource_ref) — re-running the
    // FULL requirement set after the item insert adds only the new rows and
    // leaves the existing allocation untouched. The served-order guard above
    // ensures any new 'allocated' rows are still consumed when this order
    // reaches handoff.
    const allocation = await itemPathResourceConsumption.allocateForConfirmation(supabase, {
      transactionId: order.id,
      engineType: 'instant_transaction',
      mode: orderMeta.fulfillment_mode as FulfillmentMode | undefined,
      propertyId: String(propertyId ?? ''),
      tenantId: String(tenantId ?? ''),
      context: { orderId: order.id, staffCreated: true, addedItem: true },
    });
    if (!allocation.ok) {
      logger.error('[Staff Order] Allocation failed after adding item — rolling back:', {
        orderId: order.id,
        error: allocation.error,
      });
      await supabase.from('order_items').delete().eq('id', newItem.id);
      await supabase.rpc('restore_inventory_for_order_items', {
        p_items: deductionPayload,
        p_user_id: userId || null,
      });
      await supabase
        .from('transactions')
        .update({ amount: order.amount, metadata: orderMeta, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      return res.status(409).json({
        success: false,
        error: 'RESOURCE_ALLOCATION_FAILED',
        message: allocation.error || 'Resource allocation failed for the added item',
      });
    }

    try {
      const updatePayload = { orderId: order.id, status: order.status, addedItem: newItem };
      emitToUnit(req.user?.tenantId || 'default', slug, 'order:updated', updatePayload);
    } catch (sErr: any) {
      logger.warn('Failed emitting socket event for added order item:', sErr.message);
    }

    res.json({ success: true, data: newItem });
  } catch (error: any) {
    logger.error('Error adding item to order:', error);
    res.status(500).json({ success: false, error: 'Failed to add item to order', message: error.message });
  }
}

/**
 * Process payment for a staff order
 * POST /staff/modules/:slug/orders/:orderId/pay
 */
export async function payModuleOrder(req: Request, res: Response) {
  try {
    const { slug, orderId } = req.params;
    const { paymentMethod = 'cash', amountPaid, tipAmount = 0 } = req.body;
    const userId = req.user?.userId;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    const { data: order, error: orderErr } = await supabase
      .from('transactions')
      .select('id, amount, status, metadata')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Cannot pay for a cancelled order' });
    }

    const orderMeta = (order.metadata ?? {}) as Record<string, any>;
    const paidAmount = Number(amountPaid ?? order.amount);
    const tip = Number(tipAmount || 0);
    const changeAmount = Math.max(0, Math.round((paidAmount - (order.amount + tip)) * 100) / 100);

    const updatedMetadata = {
      ...orderMeta,
      payment_status: 'paid',
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
      amount_paid: paidAmount,
      tip_amount: tip,
      change_amount: changeAmount,
      paid_by_staff_id: userId || null,
    };

    // Settlement write — payment records PAYMENT, never completion. A direct
    // status write here would impersonate completion: it would bypass the
    // fulfillment machine, the capability-gated completion condition
    // (required fulfillment must reach its terminal handoff state first),
    // resource consumption at handoff, and fiscal issuance. Payment and
    // completion are separate facts; only the state machine may change
    // status (plan Phase 5 mutation-path inventory — payModuleOrder was the
    // one Engine A path writing transactions.status directly).
    const { data: updatedOrder, error: updateErr } = await supabase
      .from('transactions')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Completion through the capability-gated choke point. The gate refuses
    // 'completed' until the fulfillment layer has reached its terminal
    // handoff condition — paying mid-preparation settles the order without
    // completing it (the KDS/frontend completes it at handoff). Settlement
    // already persisted above; a 400 refusal here is expected for
    // not-yet-handoff-eligible orders, and a fail-closed (500) error is
    // logged loudly rather than failing an already-settled payment.
    let completionStatus: 'completed' | 'pending_fulfillment_handoff';
    let displayStatus: string;
    if (order.status === 'completed') {
      // Already terminal — nothing to gate, nothing to read.
      completionStatus = 'completed';
      displayStatus = 'completed';
    } else {
      completionStatus = 'pending_fulfillment_handoff';
      const completion = await changeInstantTransactionOrderStatus(supabase, {
        orderId: order.id,
        moduleId: module.id,
        moduleSlug: slug,
        moduleEngineTypeRaw: module.engine_type,
        requestedStatus: 'completed',
        actor: actorForUser(req),
        userId,
        tenantId: req.user?.tenantId ?? null,
      });
      if (completion.ok) {
        completionStatus = 'completed';
        displayStatus = 'completed';
      } else {
        if (completion.status !== 400) {
          logger.error('[Staff Order] Payment settled but completion through the status gate failed', {
            orderId: order.id,
            status: completion.status,
            error: completion.error,
          });
        }
        // Canonical state for the response/socket when completion is
        // deferred: the fulfillment row's canonical state (fulfillment
        // moves leave transactions.status at 'confirmed'). Never the stale
        // pre-payment transactions.status.
        try {
          const f = await getFulfillmentService().getForTransaction(supabase, order.id);
          displayStatus = f?.status ?? updatedOrder.status;
        } catch {
          displayStatus = updatedOrder.status;
        }
      }
    }

    // Record the settled charge to the financial ledger — this is what makes a
    // staff-originated sale visible to the books (receipts, reconciliation,
    // reporting). The exact pricing snapshot was captured at creation
    // (createModuleOrder stores metadata.pricing), so the ledger gets the same
    // server-resolved numbers. Idempotent: a re-settle (already paid) skips
    // the write so a double-tap can't double the books.
    const wasAlreadyPaid = orderMeta.payment_status === 'paid';
    const pricingSnapshot = orderMeta.pricing as any;
    if (!wasAlreadyPaid && pricingSnapshot) {
      try {
        const engineService = getEngineService();
        const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string | undefined);
        await engineService.recordToLedger(pricingSnapshot, {
          tenantId: req.user?.tenantId || 'unknown',
          propertyId,
          moduleId: module.id,
          templateType: 'instant_transaction',
          entityId: order.id,
          entityType: 'order',
          transactionType: 'charge',
          actorType: 'staff',
          actorId: userId,
          entityState: displayStatus,
          paymentMethod,
          idempotencyKey: `settle:${order.id}`,
          metadata: {
            lineItems: orderMeta.lineItems ?? [],
            taxBreakdown: pricingSnapshot.taxBreakdown ?? [],
            feeBreakdown: pricingSnapshot.feeBreakdown ?? [],
          },
        });
      } catch (ledgerErr: any) {
        logger.warn('Failed to record staff payment to financial ledger', {
          orderId: order.id,
          error: ledgerErr?.message || ledgerErr,
        });
      }
    }

    // Award loyalty points for cash/staff-settled orders (idempotent, safe no-op if loyalty disabled or customer missing)
    try {
      await awardLoyaltyPointsForPayment('order', order.id, paidAmount);
    } catch (lErr: any) {
      logger.warn('Failed awarding loyalty points for staff paid order:', lErr?.message || lErr);
    }

    try {
      emitToUnit(req.user?.tenantId || 'default', slug, 'order:updated', {
        orderId: order.id,
        status: displayStatus,
        paymentStatus: 'paid',
      });
    } catch (sErr: any) {
      logger.warn('Failed emitting socket event for paid order:', sErr.message);
    }

    res.json({
      success: true,
      data: {
        id: updatedOrder.id,
        status: displayStatus,
        completionStatus,
        paymentStatus: 'paid',
        paymentMethod,
        totalAmount: updatedOrder.amount,
        amountPaid: paidAmount,
        changeAmount,
        tipAmount: tip,
      },
    });
  } catch (error: any) {
    logger.error('Error paying module order:', error);
    res.status(500).json({ success: false, error: 'Failed to process payment', message: error.message });
  }
}

/**
 * Generate print payload for an order receipt or kitchen ticket
 * POST /staff/modules/:slug/orders/:orderId/print
 */
export async function printModuleOrderReceipt(req: Request, res: Response) {
  try {
    const { slug, orderId } = req.params;
    const { printType = 'receipt' } = req.body;
    const supabase = getSupabase();

    const { data: module } = await supabase
      .from('modules')
      .select('id, name, engine_type')
      .eq('slug', slug)
      .single();

    if (!module || module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    const { data: order, error: orderErr } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, metadata, service_location_id')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('id, catalog_item_id, quantity, unit_price, subtotal, special_instructions')
      .eq('transaction_id', order.id);

    const catalogIds = [...new Set((items || []).map((i) => i.catalog_item_id).filter(Boolean))];
    const { data: catalogItems } = catalogIds.length > 0
      ? await supabase.from('catalog_items').select('id, name').in('id', catalogIds)
      : { data: [] };

    const nameMap = new Map((catalogItems || []).map((c) => [c.id, c.name]));
    const formattedItems = (items || []).map((i) => ({
      name: nameMap.get(i.catalog_item_id) || 'Item',
      quantity: i.quantity,
      unitPrice: i.unit_price,
      subtotal: i.subtotal,
      instructions: i.special_instructions,
    }));

    const meta = (order.metadata ?? {}) as Record<string, any>;
    const printPayload = {
      printType,
      moduleName: module.name,
      orderId: order.id,
      orderNumber: getOrderNumber(order.id, meta),
      tableNumber: meta.table_number || null,
      customerName: meta.customer_name || 'Guest',
      createdAt: order.created_at,
      items: formattedItems,
      totalAmount: order.amount,
      paymentStatus: meta.payment_status || 'unpaid',
      paymentMethod: meta.payment_method || 'cash',
      printedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: printPayload });
  } catch (error: any) {
    logger.error('Error printing order receipt:', error);
    res.status(500).json({ success: false, error: 'Failed to generate print job', message: error.message });
  }
}

// ============================================
// Batched menu customizations (kills the per-item N+1)
// ============================================

interface MenuCustomizationOption {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  customizationType: string;
  priceAdjustment: number;
  priceType: string;
  maxQuantity: number;
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  inventoryItemId?: string | null;
  quantityPerSelection: number;
  sortOrder: number;
}

interface MenuCustomizationGroup {
  groupId: string;
  groupName: string;
  groupNameAr?: string | null;
  displayName?: string | null;
  displayNameAr?: string | null;
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: MenuCustomizationOption[];
}

/**
 * Batch-fetch customization groups + options for a set of catalog items in a
 * CONSTANT number of queries (links → groups → options), replacing the previous
 * one get_entity_customizations RPC call per menu item.
 *
 * Mirrors the RPC's logic (explicit entity links + global groups, override
 * fields, time-based availability, option filtering/stock), but scoped to the
 * module's tenant/property — the RPC runs under the service role and returned
 * every tenant's global groups, which is a cross-tenant leak for a per-property
 * menu.
 */
async function fetchMenuCustomizationsBatched(
  supabase: ReturnType<typeof getSupabase>,
  itemIds: string[],
  module: { id: string; tenant_id?: string | null; property_id?: string | null }
): Promise<Map<string, MenuCustomizationGroup[]>> {
  const result = new Map<string, MenuCustomizationGroup[]>();
  if (itemIds.length === 0) return result;

  // 1. Explicit entity_customizations links for these items.
  const { data: links, error: linksErr } = await supabase
    .from('entity_customizations')
    .select('entity_id, customization_group_id, is_required_override, min_selections_override, max_selections_override, price_multiplier, sort_order')
    .eq('entity_type', 'catalog_item')
    .in('entity_id', itemIds)
    .eq('is_enabled', true);
  if (linksErr) throw linksErr;

  const linkedGroupIds = [...new Set((links || []).map((l) => l.customization_group_id).filter(Boolean))];

  // 2. Candidate groups: linked ones + global groups applicable to
  //    'catalog_item', scoped to this module's tenant/property.
  let globalQuery = supabase
    .from('customization_groups')
    .select('id, name, name_ar, display_name, display_name_ar, selection_mode, min_selections, max_selections, is_required, is_global, applicable_entity_types, available_from, available_until, available_days, sort_order')
    .is('deleted_at', null)
    .eq('is_available', true)
    .eq('is_global', true);
  if (module.tenant_id) globalQuery = globalQuery.eq('tenant_id', module.tenant_id);
  if (module.property_id) globalQuery = globalQuery.eq('property_id', module.property_id);
  const { data: globalGroups, error: globalErr } = await globalQuery;
  if (globalErr) throw globalErr;

  const allGroupIds = [...new Set([...linkedGroupIds, ...(globalGroups || []).map((g) => g.id)])];
  const { data: linkedGroups, error: linkedGroupsErr } = allGroupIds.length > 0
    ? await supabase
        .from('customization_groups')
        .select('id, name, name_ar, display_name, display_name_ar, selection_mode, min_selections, max_selections, is_required, is_global, applicable_entity_types, available_from, available_until, available_days, sort_order')
        .in('id', allGroupIds)
        .is('deleted_at', null)
        .eq('is_available', true)
    : { data: [] as any[], error: null };
  if (linkedGroupsErr) throw linkedGroupsErr;

  // 3. Options for every candidate group.
  const { data: optionRows, error: optionsErr } = allGroupIds.length > 0
    ? await supabase
        .from('customization_options')
        .select('id, group_id, name, name_ar, description, customization_type, price_adjustment, price_type, max_quantity, is_default, is_popular, badge_text, image_url, is_available, available_stock, inventory_item_id, quantity_per_selection, sort_order')
        .in('group_id', allGroupIds)
        .is('deleted_at', null)
        .eq('is_available', true)
    : { data: [] as any[], error: null };
  if (optionsErr) throw optionsErr;

  const optionsByGroup = new Map<string, any[]>();
  for (const o of optionRows || []) {
    const list = optionsByGroup.get(o.group_id) ?? [];
    list.push(o);
    optionsByGroup.set(o.group_id, list);
  }

  // 4. Time-based availability, same as the RPC (available_from/until as
  //    HH:MM:SS strings; available_days as DOW 0=Sunday..6=Saturday).
  const nowTime = new Date().toTimeString().slice(0, 8);
  const todayDow = new Date().getDay();
  const isGroupAvailableNow = (g: any) => {
    if (g.available_from && nowTime < g.available_from) return false;
    if (g.available_until && nowTime > g.available_until) return false;
    if (Array.isArray(g.available_days) && g.available_days.length > 0 && !g.available_days.includes(todayDow)) return false;
    return true;
  };

  const groupById = new Map((linkedGroups || []).map((g) => [g.id, g]));
  const applicableGlobalIds = new Set(
    (globalGroups || [])
      .filter((g) => Array.isArray(g.applicable_entity_types) && g.applicable_entity_types.includes('catalog_item'))
      .map((g) => g.id)
  );

  // 5. Assemble per item: linked groups (with per-link overrides) + applicable
  //    global groups, sorted by sort_order like the RPC.
  const assembleGroup = (g: any, link: any): MenuCustomizationGroup => {
    const multiplier = link?.price_multiplier ?? 1;
    const rawOptions = (optionsByGroup.get(g.id) ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name ?? '').localeCompare(String(b.name ?? '')));
    const options: MenuCustomizationOption[] = rawOptions.map((o) => ({
      id: o.id,
      name: o.name,
      nameAr: o.name_ar ?? null,
      description: o.description ?? null,
      customizationType: o.customization_type,
      priceAdjustment: Number(o.price_adjustment ?? 0) * multiplier,
      priceType: o.price_type,
      maxQuantity: o.max_quantity ?? 1,
      isDefault: o.is_default ?? false,
      isPopular: o.is_popular ?? false,
      badgeText: o.badge_text ?? null,
      imageUrl: o.image_url ?? null,
      isAvailable: Boolean(o.is_available) && (o.available_stock == null || o.available_stock > 0),
      inventoryItemId: o.inventory_item_id ?? null,
      quantityPerSelection: o.quantity_per_selection ?? 1,
      sortOrder: o.sort_order ?? 0,
    }));
    return {
      groupId: g.id,
      groupName: g.name,
      groupNameAr: g.name_ar ?? null,
      displayName: g.display_name ?? null,
      displayNameAr: g.display_name_ar ?? null,
      selectionMode: g.selection_mode,
      minSelections: link?.min_selections_override ?? g.min_selections ?? 0,
      maxSelections: link?.max_selections_override ?? g.max_selections ?? 99,
      isRequired: link?.is_required_override ?? g.is_required ?? false,
      sortOrder: link?.sort_order ?? g.sort_order ?? 0,
      options,
    };
  };

  for (const itemId of itemIds) {
    const itemGroups: MenuCustomizationGroup[] = [];
    const seen = new Set<string>();
    for (const link of (links || []).filter((l) => l.entity_id === itemId)) {
      const g = groupById.get(link.customization_group_id);
      if (!g || seen.has(g.id) || !isGroupAvailableNow(g)) continue;
      seen.add(g.id);
      itemGroups.push(assembleGroup(g, link));
    }
    for (const g of globalGroups || []) {
      if (seen.has(g.id) || !applicableGlobalIds.has(g.id) || !isGroupAvailableNow(g)) continue;
      seen.add(g.id);
      itemGroups.push(assembleGroup(g, undefined));
    }
    itemGroups.sort((a, b) => a.sortOrder - b.sortOrder || a.groupName.localeCompare(b.groupName));
    result.set(itemId, itemGroups);
  }

  return result;
}

/**
 * Fetch catalog categories and active catalog items for order entry UI
 * GET /staff/modules/:slug/menu
 */
export async function getModuleMenu(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data: module, error: moduleErr } = await supabase
      .from('modules')
      .select('id, engine_type, tenant_id, property_id')
      .eq('slug', slug)
      .single();

    if (moduleErr || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.engine_type !== 'instant_transaction') {
      return res.status(400).json({ success: false, error: 'Module is not an instant_transaction module' });
    }

    const [categoriesRes, itemsRes] = await Promise.all([
      supabase
        .from('catalog_categories')
        .select('id, name, description, sort_order')
        .eq('module_id', module.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('catalog_items')
        .select('id, category_id, name, description, price, image_url, is_available')
        .eq('module_id', module.id)
        .eq('is_available', true)
        .order('name', { ascending: true }),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (itemsRes.error) throw itemsRes.error;

    const baseItems = (itemsRes.data || []).map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price ?? 0,
      unitPrice: item.price ?? 0,
      imageUrl: item.image_url,
      isAvailable: item.is_available,
    }));

    // Enrich each item with its customization groups + options so the Quick
    // Order tab can offer modifier selection. Done in a constant number of
    // queries (links → groups → options) rather than one RPC per item.
    // Optional by design — a failure to load modifiers must not take down the
    // whole menu.
    let customizationsByItem: Map<string, MenuCustomizationGroup[]> = new Map();
    try {
      customizationsByItem = await fetchMenuCustomizationsBatched(supabase, baseItems.map((i) => i.id), module);
    } catch (err) {
      logger.warn('Failed to load menu customizations in batch', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const itemsWithCustomizations = baseItems.map((item) => ({
      ...item,
      customizations: customizationsByItem.get(item.id) ?? [],
    }));

    res.json({
      success: true,
      data: {
        categories: categoriesRes.data || [],
        items: itemsWithCustomizations,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching module menu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch module menu', message: error.message });
  }
}

/**
 * Seat a walk-in guest at a service location (table)
 * POST /staff/modules/:slug/walk-in
 */
export async function createWalkInSeating(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { serviceLocationId, partySize = 2, guestName = 'Walk-in Guest', guestPhone, notes } = req.body;
    const supabase = getSupabase();
    const tenantId = (req.user as any)?.tenantId;
    const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string | undefined);

    const { data: module } = await supabase
      .from('modules')
      .select('id, property_id, tenant_id')
      .eq('slug', slug)
      .single();

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const effectiveTenantId = tenantId || module.tenant_id;
    const effectivePropertyId = propertyId || module.property_id;

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .insert({
        tenant_id: effectiveTenantId,
        property_id: effectivePropertyId,
        module_id: module.id,
        service_location_id: serviceLocationId || null,
        party_size: Number(partySize),
        reserved_for: new Date().toISOString(),
        duration_minutes: 90,
        status: 'seated',
        guest_name: guestName,
        guest_phone: guestPhone || null,
        notes: notes || 'Walk-in',
        checked_in_at: new Date().toISOString(),
        created_by: req.user?.userId || null,
      })
      .select('*')
      .single();

    if (resError) throw resError;

    let assignedStaffId: string | null = null;
    if (serviceLocationId) {
      assignedStaffId = await autoAssignStaffToLocation(supabase, {
        tenantId: effectiveTenantId,
        propertyId: effectivePropertyId,
        moduleId: module.id,
        serviceLocationId,
      });

      if (assignedStaffId) {
        await supabase
          .from('reservations')
          .update({ assigned_staff_id: assignedStaffId })
          .eq('id', reservation.id);
      }
    }

    emitToUnit(effectiveTenantId, module.id, 'walkin:seated', {
      reservationId: reservation.id,
      serviceLocationId,
      assignedStaffId,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...reservation,
        assigned_staff_id: assignedStaffId,
      },
    });
  } catch (error: any) {
    logger.error('Error creating walk-in seating:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to seat walk-in' });
  }
}

/**
 * Free a service location (table), unassigning staff and completing open orders
 * POST /staff/service-locations/:id/free
 */
export async function freeServiceLocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    // 1. Unassign staff
    await reassignStaffToLocation(supabase, id, null);

    // 2. Complete active transactions on this location — routed through the
    // consolidated status-change path (see order-status.service.ts) instead
    // of a raw .update(). That function was deliberately consolidated from
    // two divergent implementations into one; a direct update here would
    // reintroduce a third path that skips the order:status/emitToOrder push
    // (open KDS/dispatch screens for the order wouldn't see the change) and
    // the audit-log write that every other status change gets.
    const { data: activeTxs } = await supabase
      .from('transactions')
      .select('id, tenant_id, module_id')
      .eq('service_location_id', id)
      .eq('engine_type', 'instant_transaction')
      .not('status', 'in', '(completed,cancelled)');

    if (activeTxs && activeTxs.length > 0) {
      const moduleIds = [...new Set(activeTxs.map((t) => t.module_id))];
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, slug, engine_type')
        .in('id', moduleIds);
      const moduleById = new Map((modulesData || []).map((m) => [m.id, m]));

      const freedTransactionIds: string[] = [];
      for (const tx of activeTxs) {
        const module = moduleById.get(tx.module_id);
        if (!module) {
          logger.warn(`freeServiceLocation: module ${tx.module_id} not found for order ${tx.id}, skipping`);
          continue;
        }
        const result = await changeInstantTransactionOrderStatus(supabase, {
          orderId: tx.id,
          moduleId: module.id,
          moduleSlug: module.slug,
          moduleEngineTypeRaw: module.engine_type,
          requestedStatus: 'completed',
          actor: 'staff',
          userId: req.user?.userId,
          tenantId: tx.tenant_id,
        });
        if (result.ok) {
          freedTransactionIds.push(tx.id);
        } else {
          logger.warn(`freeServiceLocation: failed to complete order ${tx.id}: ${result.error}`);
        }
      }

      const firstTx = activeTxs[0];
      if (firstTx && freedTransactionIds.length > 0) {
        emitToUnit(firstTx.tenant_id, firstTx.module_id, 'location:freed', {
          serviceLocationId: id,
          freedTransactionIds,
        });
      }
    }

    // 3. Mark active reservations on this table as completed
    await supabase
      .from('reservations')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('service_location_id', id)
      .in('status', ['booked', 'seated']);

    return res.json({ success: true, message: 'Table freed successfully' });
  } catch (error: any) {
    logger.error('Error freeing service location:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to free table' });
  }
}

/**
 * Get active checked-in rooms for POS room charging
 */
export async function getCheckedInRooms(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    const supabase = getSupabase();

    // Verify module
    const { data: module } = await supabase
      .from('modules')
      .select('id, engine_type')
      .eq('slug', slug)
      .single();

    if (!module) {
      return res.status(400).json({ success: false, error: 'Module not found' });
    }

    // Get checked-in bookings for time_exclusive_reservation engine
    const { data: bookings, error } = await supabase
      .from('transactions')
      .select('id, metadata, customer_id, created_at, users(full_name, email, phone)')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('status', 'checked_in')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get units to enrich unit names/numbers
    const { data: units } = await supabase
      .from('accommodation_units')
      .select('id, name, unit_number');

    const unitMap = new Map((units || []).map((u) => [u.id, u]));

    // Fetch ledger balances for all checked-in bookings
    const bookingIds = (bookings || []).map((b) => b.id);
    const ledgerMap = new Map<string, number>();

    if (bookingIds.length > 0) {
      const { data: ledgerRows } = await supabase
        .from('payment_ledger')
        .select('reference_id, event_type, amount')
        .eq('reference_type', 'room_folio')
        .in('reference_id', bookingIds)
        .eq('status', 'completed');

      (ledgerRows || []).forEach((row) => {
        const current = ledgerMap.get(row.reference_id) || 0;
        const delta = row.event_type === 'charge' ? Number(row.amount) : -Number(row.amount);
        ledgerMap.set(row.reference_id, Math.max(0, current + delta));
      });
    }

    // Map bookings into structured checked-in room options
    let result = (bookings || []).map((b) => {
      const meta = (b.metadata as Record<string, any>) || {};
      const unitId = meta.unit_id || meta.chalet_id;
      const unit = unitMap.get(unitId);

      const unitName = unit?.name || meta.unit_name || meta.chalet_name || 'Room';
      const unitNumber = unit?.unit_number || meta.unit_number || '';
      const guestName = (b.users as any)?.full_name || meta.guest_name || meta.customer_name || 'Guest';
      const guestPhone = (b.users as any)?.phone || meta.guest_phone || meta.customer_phone || '';
      const balance = ledgerMap.get(b.id) || 0;

      return {
        id: b.id,
        bookingNumber: meta.booking_number || b.id.slice(0, 8),
        unitId,
        unitName,
        unitNumber,
        guestName,
        guestPhone,
        checkInDate: meta.check_in_date || b.created_at,
        checkOutDate: meta.check_out_date,
        balance,
      };
    });

    if (search) {
      result = result.filter(
        (r) =>
          r.unitName.toLowerCase().includes(search) ||
          r.unitNumber.toLowerCase().includes(search) ||
          r.guestName.toLowerCase().includes(search) ||
          r.guestPhone.toLowerCase().includes(search) ||
          r.bookingNumber.toLowerCase().includes(search)
      );
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error fetching checked in rooms:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch checked-in rooms' });
  }
}




