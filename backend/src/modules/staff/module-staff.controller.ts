import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { validateBody } from '../../validation/schemas.js';
import { emitToUnit } from '../../socket/index.js';
import { autoAssignStaffToLocation, reassignStaffToLocation } from '../reservations/reservations.service.js';
import { getEngineService } from '../../engines/engine-service.js';
import { TEMPLATE_TO_ENGINE } from '../../engines/types.js';
import { changeInstantTransactionOrderStatus } from '../../engines/order-status.service.js';
import { computeStayBaseAmount } from '../../utils/stay-pricing.js';
import { getOrderNumber } from '../../utils/order-number.js';
import { awardLoyaltyPointsForPayment } from '../payments/loyalty-integration.js';
import dayjs from 'dayjs';

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

    // Build query for orders — use transactions table for instant_transaction engine
    let query = supabase
      .from('transactions')
      .select(`
        id, customer_id, staff_id, engine_type, status, amount, created_at,
        reference_id, reference_table, metadata, service_location_id
      `)
      .eq('engine_type', 'instant_transaction')
      .eq('module_id', moduleId || module.id)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status) {
      const statuses = (status as string).split(',');
      query = query.in('status', statuses);
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
        .from('profiles')
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
      return {
        id: order.id,
        orderNumber: getOrderNumber(order.id, meta),
        customerName: (meta.customer_name as string) || 'Guest',
        customerId: order.customer_id,
        staffId,
        staffName,
        orderType: order.engine_type,
        status: order.status,
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

    // Valid status transitions. 'delivered' is the real instant_transaction
    // engine state (instant-transaction.ts) — staff-facing UI still calls
    // this step "Served", but the value written to transactions.status has
    // to match what the engine actually recognizes. Fast-fail here before
    // touching the DB; changeInstantTransactionOrderStatus independently
    // validates against the real engine either way.
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];
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
      .select('id, status, module_id, metadata')
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

    // Auto-derive the parent order's status once every item hits the same
    // milestone. Only for 'ready'/'served' — 'preparing' has no order-level
    // action worth forcing, and a cancelled/completed order is never
    // touched by this regardless of item states.
    //
    // Two bugs fixed here: this used to run as actor 'system', but
    // mark_ready's allowedActors on the engine is ['staff'] only — so this
    // was rejected every single time, never just "sometimes." Runs as
    // 'staff' now, which is accurate anyway: a staff member did trigger
    // this, just indirectly by bumping the order's last item. It also used
    // to ask for a 'mark_served' action that has never existed on the
    // engine — the item milestone is still called 'served', but the order
    // status it derives to is the engine's real 'delivered'.
    if (status === 'ready' || status === 'served') {
      const derivedOrderStatus = status === 'ready' ? 'ready' : 'delivered';

      const { data: siblingItems, error: siblingError } = await supabase
        .from('order_items')
        .select('status')
        .eq('transaction_id', orderId);

      const allAtStatus = !siblingError && (siblingItems ?? []).length > 0
        && (siblingItems ?? []).every((i) => i.status === status);

      if (allAtStatus && parentOrder.status !== derivedOrderStatus
          && parentOrder.status !== 'cancelled' && parentOrder.status !== 'completed') {
        const engineService = getEngineService();
        const engineAction = status === 'ready' ? 'mark_ready' : 'deliver';
        const transitionResult = await engineService.transitionState(
          'instant_transaction',
          parentOrder.status,
          engineAction,
          'staff',
          { orderId, derivedFromItems: true },
        );

        if (transitionResult.allowed) {
          const orderMeta = (parentOrder.metadata ?? {}) as Record<string, unknown>;
          const timestampField = status === 'ready'
            ? { actual_ready_time: new Date().toISOString() }
            : { served_at: new Date().toISOString() };

          const { data: derivedOrder } = await supabase
            .from('transactions')
            .update({
              status: transitionResult.targetState,
              updated_at: new Date().toISOString(),
              metadata: { ...orderMeta, ...timestampField },
            })
            .eq('id', orderId)
            .select('id, status')
            .single();

          if (derivedOrder) {
            emitToUnit(req.user?.tenantId || 'default', slug, 'order:status', derivedOrder);
            emitToUnit(req.user?.tenantId || 'default', module.id, 'order:status', derivedOrder);
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
      .eq('role', 'customer')
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
    const { serviceLocationId: reqServiceLocId, tableId, tableNumber, customerName, customerId, items, notes } = req.body;
    const serviceLocationId = reqServiceLocId || tableId;
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

    const orderItemsInput = Array.isArray(items) ? items : [];
    let calculatedAmount = 0;
    for (const item of orderItemsInput) {
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.unitPrice || item.price || 0);
      calculatedAmount += qty * price;
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase().slice(-5)}`;

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'instant_transaction',
        status: 'confirmed',
        amount: Math.round(calculatedAmount * 100) / 100,
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
          notes: notes || null,
          payment_status: 'unpaid',
          payment_method: 'cash',
        },
      })
      .select()
      .single();

    if (txError) throw txError;

    // Deduct inventory atomically with audit trail; roll back on stock failure
    if (orderItemsInput.length > 0) {
      const deductionPayload = orderItemsInput.map((i: any) => ({
        catalog_item_id: i.catalogItemId || i.itemId || i.id,
        quantity: Number(i.quantity || i.qty || 1),
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
    if (orderItemsInput.length > 0) {
      // selectedModifiers isn't sent by any current staff UI (StaffPOSTemplate /
      // AdminPOSTemplate have no customization selector today — only the
      // customer-facing MenuService/DynamicModuleRenderer flow does), so this
      // is defensive: if a caller ever does send it (future staff modifier UI,
      // a customer-cart handoff, direct API use), it's captured and actually
      // acted on below instead of silently discarded. Previously this field
      // was dropped entirely — the item would be charged for and recorded,
      // but its ingredients/add-ons were never deducted, which is a much
      // harder bug to notice after the fact than a loud failure now.
      const itemInserts = orderItemsInput.map((i: any) => ({
        transaction_id: transaction.id,
        catalog_item_id: i.catalogItemId || i.itemId || i.id,
        quantity: Number(i.quantity || i.qty || 1),
        unit_price: Number(i.unitPrice || i.price || 0),
        subtotal: Math.round(Number(i.quantity || i.qty || 1) * Number(i.unitPrice || i.price || 0) * 100) / 100,
        special_instructions: i.notes || i.instructions || null,
        status: 'pending',
        metadata: {
          ...(Array.isArray(i.selectedModifiers) && i.selectedModifiers.length > 0
            ? { selectedModifiers: i.selectedModifiers }
            : {}),
        },
      }));

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
      // of silently diverging in what they deduct.
      //
      // Known gap NOT addressed here: calculatedAmount above is qty*price
      // only and doesn't include any totalPriceAdjustment from selections
      // (the customer path's total comes from a separate PricingPipeline
      // this staff endpoint doesn't call at all). Inventory deduction is
      // correct after this change; the order total is not, if modifiers
      // carry a price adjustment. That's a pricing-pipeline gap, not an
      // inventory one — flagging rather than folding into this fix.
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
    const { catalogItemId, itemId, quantity, unitPrice, price, notes } = req.body;
    const supabase = getSupabase();

    const targetCatalogId = catalogItemId || itemId;
    const qty = Number(quantity || 1);
    const itemPrice = Number(unitPrice || price || 0);

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
      .select('id, amount, status, metadata')
      .eq('id', orderId)
      .eq('module_id', module.id)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ success: false, error: 'Order not found for this module' });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, error: `Cannot add items to a ${order.status} order` });
    }

    const subtotal = Math.round(qty * itemPrice * 100) / 100;

    const { data: newItem, error: insertErr } = await supabase
      .from('order_items')
      .insert({
        transaction_id: order.id,
        catalog_item_id: targetCatalogId,
        quantity: qty,
        unit_price: itemPrice,
        subtotal,
        special_instructions: notes || null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    const newTotal = Math.round(((order.amount || 0) + subtotal) * 100) / 100;
    await supabase
      .from('transactions')
      .update({ amount: newTotal, updated_at: new Date().toISOString() })
      .eq('id', order.id);

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

    const targetStatus = ['delivered', 'ready', 'preparing', 'confirmed', 'pending'].includes(order.status)
      ? 'completed'
      : order.status;

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('transactions')
      .update({
        status: targetStatus,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Award loyalty points for cash/staff-settled orders (idempotent, safe no-op if loyalty disabled or customer missing)
    try {
      await awardLoyaltyPointsForPayment('order', order.id, paidAmount);
    } catch (lErr: any) {
      logger.warn('Failed awarding loyalty points for staff paid order:', lErr?.message || lErr);
    }

    try {
      emitToUnit(req.user?.tenantId || 'default', slug, 'order:updated', {
        orderId: order.id,
        status: targetStatus,
        paymentStatus: 'paid',
      });
    } catch (sErr: any) {
      logger.warn('Failed emitting socket event for paid order:', sErr.message);
    }

    res.json({
      success: true,
      data: {
        id: updatedOrder.id,
        status: updatedOrder.status,
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
      .select('id, engine_type')
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
        .select('id, category_id, name, description, price, unit_price, image_url, is_available')
        .eq('module_id', module.id)
        .eq('is_available', true)
        .order('name', { ascending: true }),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (itemsRes.error) throw itemsRes.error;

    const formattedItems = (itemsRes.data || []).map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price ?? item.unit_price ?? 0,
      unitPrice: item.unit_price ?? item.price ?? 0,
      imageUrl: item.image_url,
      isAvailable: item.is_available,
    }));

    res.json({
      success: true,
      data: {
        categories: categoriesRes.data || [],
        items: formattedItems,
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




