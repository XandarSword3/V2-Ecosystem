import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { getCallerTenantId as tenantScopeFor, requireTenantScope } from '../../security/tenant-scope.js';
import { getCallerPropertyId, requireCallerPropertyId } from '../../security/property-scope.js';

// Validation schemas
const recordWastageSchema = z.object({
  itemId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  reason: z.enum(['expired', 'spoiled', 'damaged', 'preparation_error', 'theft', 'other']),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

const physicalCountSchema = z.object({
  itemId: z.string().uuid(),
  actualQuantity: z.number().min(0),
  notes: z.string().optional(),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDelivery: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
    unitCost: z.number().positive().optional(),
  })),
});

const receivePurchaseOrderSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantityReceived: z.number().min(0),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    actualUnitCost: z.number().positive().optional(),
  })),
});

export class InventoryAdvancedController {
  /**
   * Record wastage
   */
  async recordWastage(req: Request, res: Response) {
    try {
      const validation = recordWastageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const tenantId = tenantScopeFor(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      // Get current item info — scoped to caller's tenant/property so a
      // wastage report can't be filed against another tenant's stock.
      let itemQuery = supabase
        .from('inventory_items')
        .select('*, cost_per_unit')
        .eq('id', data.itemId);
      if (tenantId) itemQuery = itemQuery.eq('tenant_id', tenantId);
      itemQuery = itemQuery.eq('property_id', propertyId);
      const { data: item, error: itemError } = await itemQuery.maybeSingle();

      if (itemError || !item) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      // Calculate cost impact
      const costImpact = data.quantity * (parseFloat(item.cost_per_unit) || 0);

      // Record wastage
      const { data: wastage, error: wastageError } = await supabase
        .from('inventory_wastage')
        .insert({
          item_id: data.itemId,
          batch_id: data.batchId,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes,
          photo_url: data.photoUrl,
          cost_impact: costImpact,
          reported_by: userId,
          approval_status: data.quantity > 10 ? 'pending' : 'approved', // Auto-approve small amounts
          tenant_id: requireTenantScope(req),
          property_id: propertyId,
        })
        .select()
        .single();

      if (wastageError) throw wastageError;

      // Deduct from stock using FIFO if approved
      if (wastage.approval_status === 'approved') {
        await supabase.rpc('deduct_stock_fifo', {
          p_item_id: data.itemId,
          p_quantity: data.quantity,
          p_reason: 'wastage',
          p_user_id: userId,
        });
      }

      res.status(201).json({ success: true, data: wastage });
    } catch (error: any) {
      logger.error('Error recording wastage:', error);
      res.status(500).json({ success: false, error: 'Failed to record wastage', message: error.message });
    }
  }

  /**
   * Approve wastage
   */
  async approveWastage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const tenantId = tenantScopeFor(req);
      const propertyId = getCallerPropertyId(req);
      const supabase = getSupabase();

      let wastageQuery = supabase
        .from('inventory_wastage')
        .select('*')
        .eq('id', id);
      if (tenantId) wastageQuery = wastageQuery.eq('tenant_id', tenantId);
      if (propertyId) wastageQuery = wastageQuery.eq('property_id', propertyId);
      const { data: wastage, error: fetchError } = await wastageQuery.maybeSingle();

      if (fetchError || !wastage) {
        return res.status(404).json({ success: false, error: 'Wastage record not found' });
      }

      if (wastage.approval_status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Wastage already processed' });
      }

      // Approve and deduct stock. The tenant/property filter here is
      // defense-in-depth — the fetch above already proved ownership — but
      // keeps this update from ever being separated from that check.
      let updateQuery = supabase
        .from('inventory_wastage')
        .update({ approval_status: 'approved', approved_by: userId })
        .eq('id', id);
      if (tenantId) updateQuery = updateQuery.eq('tenant_id', tenantId);
      if (propertyId) updateQuery = updateQuery.eq('property_id', propertyId);
      const { data: updated, error: updateError } = await updateQuery
        .select()
        .single();

      if (updateError) throw updateError;

      // Deduct stock
      await supabase.rpc('deduct_stock_fifo', {
        p_item_id: wastage.item_id,
        p_quantity: wastage.quantity,
        p_reason: 'wastage',
        p_user_id: userId,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error approving wastage:', error);
      res.status(500).json({ success: false, error: 'Failed to approve wastage', message: error.message });
    }
  }

  /**
   * Perform physical count and record variance
   */
  async recordPhysicalCount(req: Request, res: Response) {
    try {
      const validation = physicalCountSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const tenantId = tenantScopeFor(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      // Get current system quantity — scoped so a count can't be filed
      // against another tenant/property's item.
      let itemQuery = supabase
        .from('inventory_items')
        .select('current_stock, cost_per_unit')
        .eq('id', data.itemId);
      if (tenantId) itemQuery = itemQuery.eq('tenant_id', tenantId);
      itemQuery = itemQuery.eq('property_id', propertyId);
      const { data: item, error: itemError } = await itemQuery.maybeSingle();

      if (itemError || !item) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      const systemQty = parseFloat(item.current_stock) || 0;
      const variance = data.actualQuantity - systemQty;
      const variancePercent = systemQty > 0 ? (variance / systemQty) * 100 : 0;
      const varianceCost = Math.abs(variance) * (parseFloat(item.cost_per_unit) || 0);

      // Record variance
      const { data: varianceRecord, error: varianceError } = await supabase
        .from('inventory_variance')
        .insert({
          item_id: data.itemId,
          count_date: new Date().toISOString().split('T')[0],
          system_quantity: systemQty,
          actual_quantity: data.actualQuantity,
          variance_quantity: variance,
          variance_percentage: variancePercent,
          variance_cost: varianceCost,
          reason: data.notes,
          counted_by: userId,
          status: Math.abs(variancePercent) > 5 ? 'pending' : 'approved', // Auto-approve small variances
          tenant_id: requireTenantScope(req),
          property_id: propertyId,
        })
        .select()
        .single();

      if (varianceError) throw varianceError;

      // If approved, adjust stock
      if (varianceRecord.status === 'approved') {
        let stockUpdate = supabase
          .from('inventory_items')
          .update({ current_stock: data.actualQuantity, updated_at: new Date().toISOString() })
          .eq('id', data.itemId);
        if (tenantId) stockUpdate = stockUpdate.eq('tenant_id', tenantId);
        stockUpdate = stockUpdate.eq('property_id', propertyId);
        await stockUpdate;

        // Record adjustment transaction
        await supabase.from('inventory_transactions').insert({
          item_id: data.itemId,
          transaction_type: 'adjustment',
          quantity: Math.abs(variance),
          stock_before: systemQty,
          stock_after: data.actualQuantity,
          reference_type: 'physical_count',
          notes: `Physical count adjustment: ${data.notes || 'No notes'}`,
          performed_by: userId,
          tenant_id: requireTenantScope(req),
          property_id: propertyId,
        });
      }

      res.status(201).json({
        success: true,
        data: {
          ...varianceRecord,
          requires_approval: varianceRecord.status === 'pending',
        },
      });
    } catch (error: any) {
      logger.error('Error recording physical count:', error);
      res.status(500).json({ success: false, error: 'Failed to record physical count', message: error.message });
    }
  }

  /**
   * Get variance report (property-scoped, flattened for frontend).
   * Returns a flat array at data.data — each row has the fields the
   * inventory/page.tsx Operations tab expects: item_name, unit,
   * cost_per_unit, system_quantity, actual_quantity, counted_at.
   */
  async getVarianceReport(req: Request, res: Response) {
    try {
      const propertyId = getCallerPropertyId(req);
      const tenantId = tenantScopeFor(req);
      const { startDate, endDate, status } = req.query;
      const supabase = getSupabase();

      // Property scoping: resolve item IDs that belong to this property.
      // inventory_variance also has a direct tenant_id/property_id column
      // (added since this comment was written) — filtered directly below —
      // but the item_id indirection stays too since it's what lets this
      // report join in item name/sku/unit without a second round trip.
      let itemIdFilter: string[] | null = null;
      if (propertyId) {
        let propertyItemsQuery = supabase
          .from('inventory_items')
          .select('id')
          .eq('property_id', propertyId);
        if (tenantId) propertyItemsQuery = propertyItemsQuery.eq('tenant_id', tenantId);
        const { data: propertyItems } = await propertyItemsQuery;
        itemIdFilter = (propertyItems || []).map((i: any) => i.id);
        if (itemIdFilter.length === 0) {
          return res.json({ success: true, data: [] });
        }
      }

      let query = supabase
        .from('inventory_variance')
        .select(`
          id,
          count_date,
          system_quantity,
          actual_quantity,
          variance_quantity,
          variance_cost,
          status,
          item:inventory_items!item_id(name, sku, unit, cost_per_unit),
          counter:users!fk_variance_counted_by(full_name)
        `)
        .order('count_date', { ascending: false });

      if (tenantId) query = query.eq('tenant_id', tenantId);
      if (propertyId) query = query.eq('property_id', propertyId);
      if (itemIdFilter) query = query.in('item_id', itemIdFilter);
      if (startDate) query = query.gte('count_date', startDate as string);
      if (endDate) query = query.lte('count_date', endDate as string);
      if (status) query = query.eq('status', status as string);

      const { data: variances, error } = await query.limit(100);

      if (error) throw error;

      // Flatten: frontend iterates over data.data as an array and reads
      // item_name, unit, cost_per_unit, system_quantity, actual_quantity, counted_at
      const flat = (variances || []).map((v: any) => ({
        id: v.id,
        item_name: v.item?.name ?? 'Unknown',
        sku: v.item?.sku ?? '',
        unit: v.item?.unit ?? '',
        cost_per_unit: v.item?.cost_per_unit ?? null,
        system_quantity: v.system_quantity,
        actual_quantity: v.actual_quantity,
        variance_quantity: v.variance_quantity,
        variance_cost: v.variance_cost,
        status: v.status,
        counted_at: v.count_date,
        counted_by_name: v.counter?.full_name ?? null,
      }));

      res.json({ success: true, data: flat });
    } catch (error: any) {
      logger.error('Error fetching variance report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch variance report', message: error.message });
    }
  }

  /**
   * Get purchase orders
   */
  async getPurchaseOrders(req: Request, res: Response) {
    try {
      // propertyId was previously read here but never applied to the query
      // below — every tenant's purchase orders were returned regardless of
      // the caller's property. Now wired in alongside tenant_id.
      const propertyId = getCallerPropertyId(req);
      const tenantId = tenantScopeFor(req);
      const { status } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_purchase_orders')
        .select(`
          *,
          supplier:inventory_suppliers(id, name, contact_name),
          items:inventory_purchase_order_items(
            *,
            inventory_item:inventory_items(id, name, sku, unit)
          )
        `)
        .order('created_at', { ascending: false });

      if (tenantId) query = query.eq('tenant_id', tenantId);
      if (propertyId) query = query.eq('property_id', propertyId);
      if (status) query = query.eq('status', status as string);

      const { data: orders, error } = await query.limit(100);

      if (error) throw error;

      res.json({ success: true, data: orders || [] });
    } catch (error: any) {
      logger.error('Error fetching purchase orders:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch purchase orders', message: error.message });
    }
  }

  /**
   * Create purchase order
   */
  async createPurchaseOrder(req: Request, res: Response) {
    try {
      const validation = createPurchaseOrderSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const tenantId = requireTenantScope(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      // Generate PO number
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

      // Calculate total
      const totalAmount = data.items.reduce((sum, item) => 
        sum + (item.quantity * (item.unitCost || 0)), 0);

      // Create PO
      const { data: po, error: poError } = await supabase
        .from('inventory_purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: data.supplierId,
          status: 'draft',
          total_amount: totalAmount,
          expected_delivery: data.expectedDelivery,
          notes: data.notes,
          created_by: userId,
          tenant_id: tenantId,
          property_id: propertyId,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items
      const poItems = data.items.map(item => ({
        purchase_order_id: po.id,
        item_id: item.itemId,
        quantity_ordered: item.quantity,
        unit_cost: item.unitCost,
        total_cost: item.quantity * (item.unitCost || 0),
        tenant_id: tenantId,
        property_id: propertyId,
      }));

      await supabase.from('inventory_purchase_order_items').insert(poItems);

      res.status(201).json({ success: true, data: po });
    } catch (error: any) {
      logger.error('Error creating purchase order:', error);
      res.status(500).json({ success: false, error: 'Failed to create purchase order', message: error.message });
    }
  }

  /**
   * Receive purchase order (creates batches)
   */
  async receivePurchaseOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = receivePurchaseOrderSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const tenantId = tenantScopeFor(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      // Get PO — scoped to caller's tenant/property. Previously unscoped:
      // any tenant's staff/admin could receive (and mutate stock +
      // cost_per_unit) on any other tenant's purchase order. maybeSingle()
      // + 404 rather than 403 so a mismatch doesn't reveal that a PO with
      // this id exists under a different tenant.
      let poQuery = supabase
        .from('inventory_purchase_orders')
        .select('*, items:inventory_purchase_order_items(*)')
        .eq('id', id);
      if (tenantId) poQuery = poQuery.eq('tenant_id', tenantId);
      poQuery = poQuery.eq('property_id', propertyId);
      const { data: po, error: poError } = await poQuery.maybeSingle();

      if (poError || !po) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      if (po.status === 'received' || po.status === 'cancelled') {
        return res.status(400).json({ success: false, error: `PO already ${po.status}` });
      }

      // Process each received item
      for (const item of data.items) {
        if (item.quantityReceived <= 0) continue;

        // Create batch
        await supabase.from('inventory_batches').insert({
          item_id: item.itemId,
          batch_number: item.batchNumber || `${po.po_number}-${Date.now()}`,
          quantity: item.quantityReceived,
          remaining_quantity: item.quantityReceived,
          cost_per_unit: item.actualUnitCost,
          purchase_order_id: po.id,
          expiry_date: item.expiryDate,
          tenant_id: tenantId,
          property_id: propertyId,
        });

        // Update item stock
        await supabase.rpc('deduct_stock_fifo', {
          p_item_id: item.itemId,
          p_quantity: -item.quantityReceived, // Negative to add
          p_reason: 'purchase',
          p_user_id: userId,
        });

        // Actually, let's use a simpler approach for adding stock
        const { data: currentItem } = await supabase
          .from('inventory_items')
          .select('current_stock')
          .eq('id', item.itemId)
          .single();

        const newStock = (parseFloat(currentItem?.current_stock) || 0) + item.quantityReceived;

        await supabase
          .from('inventory_items')
          .update({ 
            current_stock: newStock,
            cost_per_unit: item.actualUnitCost || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.itemId);

        // Record transaction
        await supabase.from('inventory_transactions').insert({
          item_id: item.itemId,
          transaction_type: 'purchase',
          quantity: item.quantityReceived,
          stock_before: parseFloat(currentItem?.current_stock) || 0,
          stock_after: newStock,
          reference_type: 'purchase_order',
          reference_id: po.id,
          notes: `Received from PO ${po.po_number}`,
          performed_by: userId,
        });

        // Update PO item received quantity
        let poItemUpdate = supabase
          .from('inventory_purchase_order_items')
          .update({ quantity_received: item.quantityReceived })
          .eq('purchase_order_id', id)
          .eq('item_id', item.itemId);
        if (tenantId) poItemUpdate = poItemUpdate.eq('tenant_id', tenantId);
        poItemUpdate = poItemUpdate.eq('property_id', propertyId);
        await poItemUpdate;
      }

      // Update PO status
      let poStatusUpdate = supabase
        .from('inventory_purchase_orders')
        .update({ status: 'received', received_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (tenantId) poStatusUpdate = poStatusUpdate.eq('tenant_id', tenantId);
      poStatusUpdate = poStatusUpdate.eq('property_id', propertyId);
      const { data: updated } = await poStatusUpdate
        .select()
        .single();

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error receiving purchase order:', error);
      res.status(500).json({ success: false, error: 'Failed to receive purchase order', message: error.message });
    }
  }

  /**
   * Get suppliers
   */
  async getSuppliers(req: Request, res: Response) {
    try {
      const tenantId = tenantScopeFor(req);
      const propertyId = getCallerPropertyId(req);
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (tenantId) query = query.eq('tenant_id', tenantId);
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data: suppliers, error } = await query;

      if (error) throw error;

      res.json({ success: true, data: suppliers || [] });
    } catch (error: any) {
      logger.error('Error fetching suppliers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch suppliers', message: error.message });
    }
  }

  /**
   * Create supplier
   */
  async createSupplier(req: Request, res: Response) {
    try {
      const { name, contactName, email, phone, address, paymentTerms, leadTimeDays, notes } = req.body;
      const tenantId = requireTenantScope(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      const { data: supplier, error } = await supabase
        .from('inventory_suppliers')
        .insert({
          name,
          contact_name: contactName,
          email,
          phone,
          address,
          payment_terms: paymentTerms,
          lead_time_days: leadTimeDays,
          notes,
          tenant_id: tenantId,
          property_id: propertyId,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: supplier });
    } catch (error: any) {
      logger.error('Error creating supplier:', error);
      res.status(500).json({ success: false, error: 'Failed to create supplier', message: error.message });
    }
  }

  /**
   * Get batches for an item (FIFO view)
   */
  async getItemBatches(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const tenantId = tenantScopeFor(req);
      const propertyId = getCallerPropertyId(req);
      const supabase = getSupabase();

      let query = supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', itemId)
        .eq('status', 'active')
        .gt('remaining_quantity', 0)
        .order('received_date', { ascending: true });
      if (tenantId) query = query.eq('tenant_id', tenantId);
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data: batches, error } = await query;

      if (error) throw error;

      res.json({ success: true, data: batches || [] });
    } catch (error: any) {
      logger.error('Error fetching batches:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch batches', message: error.message });
    }
  }

  // ============================================
  // DEDUCTION FOR ORDERS
  // ============================================

  /**
   * Deduct inventory based on order completion
   * 
   * DORMANT ENDPOINT - NOT CALLED BY PRODUCTION CODE
   * 
   * This endpoint is not currently used in the production codebase. The actual automatic
   * inventory deduction on order status changes is handled by:
   * - engines/inventory-side-effects.ts (calls deduct_inventory_for_order RPC directly)
   * - dynamic-module.router.ts (calls deduct_inventory_for_order_items at order creation)
   * 
   * This function is kept for potential manual testing or future use, but should not be
   * considered the primary inventory deduction path. If modifying inventory deduction logic,
   * ensure changes are also made to:
   * 1. deduct_inventory_for_order RPC (database function)
   * 2. deduct_inventory_for_order_items RPC (database function)
   * 3. engines/inventory-side-effects.ts
   * 4. dynamic-module.router.ts
   */
  async deductForOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;
      // Required (throwing) variants: this method inserts/upserts rows with
      // NOT NULL tenant_id/property_id columns, so a missing scope should
      // fail fast with a clear 400/403 rather than surface as an opaque
      // 500 from a Postgres not-null violation.
      const tenantId = requireTenantScope(req);
      const propertyId = requireCallerPropertyId(req);
      const supabase = getSupabase();

      // Get order items
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select('catalog_item_id, quantity')
        .eq('order_id', orderId);

      if (orderError) throw orderError;

      const deductionResults: any[] = [];

      for (const orderItem of orderItems || []) {
        // Get ingredients for this catalog item from menu_item_ingredients
        const { data: ingredients } = await supabase
          .from('menu_item_ingredients')
          .select(`
            inventory_item_id,
            quantity_required,
            is_optional
          `)
          .eq('catalog_item_id', orderItem.catalog_item_id);

        if (!ingredients || ingredients.length === 0) continue; // No ingredients = no deduction

        // Deduct each required ingredient
        for (const ingredient of ingredients) {
          if (ingredient.is_optional) continue;

          const deductQty = ingredient.quantity_required * orderItem.quantity;

          // Get current stock — scoped so an order can't deduct against
          // another tenant/property's inventory item via a stray ingredient row.
          let itemQuery = supabase
            .from('inventory_items')
            .select('current_stock, name')
            .eq('id', ingredient.inventory_item_id);
          if (tenantId) itemQuery = itemQuery.eq('tenant_id', tenantId);
          if (propertyId) itemQuery = itemQuery.eq('property_id', propertyId);
          const { data: item } = await itemQuery.maybeSingle();

          if (!item) continue;

          const currentStock = parseFloat(item.current_stock) || 0;
          const newStock = Math.max(0, currentStock - deductQty);

          // Update stock
          let stockUpdate = supabase
            .from('inventory_items')
            .update({ current_stock: newStock })
            .eq('id', ingredient.inventory_item_id);
          if (tenantId) stockUpdate = stockUpdate.eq('tenant_id', tenantId);
          if (propertyId) stockUpdate = stockUpdate.eq('property_id', propertyId);
          await stockUpdate;

          // Record transaction
          await supabase.from('inventory_transactions').insert({
            item_id: ingredient.inventory_item_id,
            transaction_type: 'sale',
            quantity: -deductQty,
            stock_before: currentStock,
            stock_after: newStock,
            reference_type: 'order',
            reference_id: orderId,
            notes: `Auto-deducted for order`,
            performed_by: userId,
            tenant_id: tenantId,
            property_id: propertyId,
          });

          deductionResults.push({
            itemId: ingredient.inventory_item_id,
            itemName: item.name,
            deducted: deductQty,
            newStock,
          });

          // Check for low stock alert
          let itemInfoQuery = supabase
            .from('inventory_items')
            .select('min_stock_level')
            .eq('id', ingredient.inventory_item_id);
          if (tenantId) itemInfoQuery = itemInfoQuery.eq('tenant_id', tenantId);
          if (propertyId) itemInfoQuery = itemInfoQuery.eq('property_id', propertyId);
          const { data: itemInfo } = await itemInfoQuery.maybeSingle();

          if (itemInfo && newStock <= (parseFloat(itemInfo.min_stock_level) || 0)) {
            await supabase.from('inventory_alerts').upsert({
              item_id: ingredient.inventory_item_id,
              alert_type: 'low_stock',
              message: `Low stock alert: ${item.name} is at ${newStock} units`,
              severity: newStock === 0 ? 'critical' : 'warning',
              is_resolved: false,
              tenant_id: tenantId,
              property_id: propertyId,
            }, { onConflict: 'item_id,alert_type' });
          }
        }
      }

      res.json({
        success: true,
        data: {
          orderId,
          deductions: deductionResults,
          message: `Deducted ${deductionResults.length} ingredient(s) from inventory`,
        },
      });
    } catch (error: any) {
      logger.error('Error deducting inventory for order:', error);
      res.status(500).json({ success: false, error: 'Failed to deduct inventory', message: error.message });
    }
  }

  /**
   * Get cost analysis for a menu item
   */
  async getMenuItemCostAnalysis(req: Request, res: Response) {
    try {
      const { menuItemId } = req.params;
      const supabase = getSupabase();

      // Get menu item
      const { data: menuItem, error: menuError } = await supabase
        .from('catalog_items')
        .select('id, name, price')
        .eq('id', menuItemId)
        .maybeSingle();

      if (menuError || !menuItem) {
        return res.status(404).json({ success: false, error: 'Menu item not found' });
      }

      // Get recipe from menu_item_ingredients (the authoritative table for deductions)
      const { data: ingredients } = await supabase
        .from('menu_item_ingredients')
        .select(`
          quantity_required,
          unit,
          inventory_item:inventory_items(id, name, cost_per_unit)
        `)
        .eq('catalog_item_id', menuItemId);

      if (!ingredients || ingredients.length === 0) {
        return res.json({
          success: true,
          data: {
            menuItem,
            hasRecipe: false,
            message: 'No recipe found - cost analysis unavailable',
          },
        });
      }

      // Calculate costs
      const ingredientCosts = ingredients.map((ing: any) => {
        const unitCost = parseFloat(ing.inventory_item?.cost_per_unit) || 0;
        const totalCost = ing.quantity_required * unitCost;
        return {
          name: ing.inventory_item?.name,
          quantity: ing.quantity_required,
          unit: ing.unit,
          unitCost,
          totalCost,
        };
      });

      const totalCost = ingredientCosts.reduce((sum: number, i: { totalCost: number }) => sum + i.totalCost, 0);
      const sellingPrice = parseFloat(menuItem.price) || 0;
      const grossProfit = sellingPrice - totalCost;
      const grossMargin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

      res.json({
        success: true,
        data: {
          menuItem,
          hasRecipe: true,
          costAnalysis: {
            ingredientCosts,
            totalCost: totalCost.toFixed(2),
            sellingPrice: sellingPrice.toFixed(2),
            grossProfit: grossProfit.toFixed(2),
            grossMarginPercent: grossMargin.toFixed(1),
          },
        },
      });
    } catch (error: any) {
      logger.error('Error getting cost analysis:', error);
      res.status(500).json({ success: false, error: 'Failed to get cost analysis', message: error.message });
    }
  }

  /**
   * Get inventory dashboard stats
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get counts
      const [itemsResult, alertsResult, lowStockResult, expiringResult] = await Promise.all([
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
        supabase.from('inventory_alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }).lte('current_stock', 10), // Below 10 units
        supabase.from('inventory_items').select('id', { count: 'exact', head: true })
          .not('expiry_date', 'is', null)
          .lte('expiry_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      ]);

      // Get total inventory value
      const { data: items } = await supabase
        .from('inventory_items')
        .select('current_stock, cost_per_unit');

      const totalValue = (items || []).reduce((sum, item) => {
        return sum + ((parseFloat(item.current_stock) || 0) * (parseFloat(item.cost_per_unit) || 0));
      }, 0);

      // Get recent transactions count (last 24h)
      const { count: recentTransactions } = await supabase
        .from('inventory_transactions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get wastage stats (last 30 days)
      const { data: wastageData } = await supabase
        .from('inventory_wastage')
        .select('cost_impact')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const wastageTotal = (wastageData || []).reduce((sum, w) => sum + (parseFloat(w.cost_impact) || 0), 0);

      res.json({
        success: true,
        data: {
          totalItems: itemsResult.count || 0,
          activeAlerts: alertsResult.count || 0,
          lowStockItems: lowStockResult.count || 0,
          expiringItems: expiringResult.count || 0,
          totalInventoryValue: totalValue.toFixed(2),
          recentTransactions: recentTransactions || 0,
          wastage30Days: wastageTotal.toFixed(2),
        },
      });
    } catch (error: any) {
      logger.error('Error getting dashboard stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get dashboard stats', message: error.message });
    }
  }
}

export const inventoryAdvancedController = new InventoryAdvancedController();


