import dayjs from 'dayjs';
import { getSupabase } from "../../../database/connection.js";
import { emitToUnit, emitToRole } from "../../../socket/index.js";
import { emailService } from "../../../services/email.service.js";
import { logger } from "../../../utils/logger.js";
import { taxService } from "../../../services/tax.service.js";
import { orderConfigService } from "../../../services/order-config.service.js";
import { getEngineService } from '../../../engines/engine-service.js';
import type { PricingLineItem, PricingContext } from '../../../engines/types.js';

function generateOrderNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `R-${date}-${random}${suffix}`;
}

// Type for selected modifiers passed from frontend
interface SelectedModifier {
  optionId: string;
  optionName: string;
  groupId: string;
  groupName: string;
  modifierType: 'add' | 'remove' | 'swap';
  priceAdjustment: number;
  quantity: number;
  inventoryItemId?: string;
  inventoryQuantity?: number;
}

/**
 * Propagate a restaurant order to the kitchen display system.
 * Creates a kitchen_orders record + kitchen_order_items for each line item.
 * This is called automatically when a restaurant order is created.
 */
async function propagateToKitchen(
  orderId: string,
  orderNumber: string,
  tableId: string | undefined,
  orderItems: Array<{ menu_item_id: string; quantity: number; special_instructions?: string; selected_modifiers?: SelectedModifier[] }>,
  menuItemMap: Map<string, any>,
  estimatedReadyTime: string
) {
  const supabase = getSupabase();

  try {
    // Calculate estimated prep time in minutes from items
    const maxPrepTime = Math.max(
      ...Array.from(menuItemMap.values()).map((i: any) => i.preparation_time_minutes || 15)
    );

    // Insert kitchen order
    const { data: kitchenOrder, error: koError } = await supabase
      .from('kitchen_orders')
      .insert({
        order_number: orderNumber,
        source_order_id: orderId,
        table_id: tableId || null,
        status: 'PENDING',
        priority: 'NORMAL',
        estimated_time: maxPrepTime,
        notes: null,
      })
      .select()
      .single();

    if (koError) {
      logger.warn('[KITCHEN SYNC] Failed to create kitchen order:', koError);
      return; // Non-fatal — restaurant order still succeeds
    }

    // Insert kitchen order items
    const kitchenItems = orderItems.map(item => {
      const menuItem = menuItemMap.get(item.menu_item_id);

      // Build modifications array from special instructions + selected modifiers
      const modifications: string[] = [];
      if (item.special_instructions) {
        modifications.push(item.special_instructions);
      }
      if (item.selected_modifiers && item.selected_modifiers.length > 0) {
        item.selected_modifiers.forEach(mod => {
          modifications.push(`${mod.modifierType}: ${mod.optionName}`);
        });
      }

      return {
        order_id: kitchenOrder.id,
        menu_item_id: item.menu_item_id,
        name: menuItem?.name || 'Unknown Item',
        quantity: item.quantity,
        modifications: modifications.length > 0 ? modifications : null,
        notes: item.special_instructions || null,
        status: 'PENDING',
      };
    });

    const { error: kiError } = await supabase
      .from('kitchen_order_items')
      .insert(kitchenItems);

    if (kiError) {
      logger.warn('[KITCHEN SYNC] Failed to create kitchen order items:', kiError);
    }

    // Emit socket event to kitchen display
    try {
      const { getIO } = await import('../../../socket/index.js');
      const io = getIO();
      io.to('kitchen').emit('kitchen:new-order', {
        id: kitchenOrder.id,
        orderNumber: kitchenOrder.order_number,
        tableId: kitchenOrder.table_id,
        status: kitchenOrder.status,
        priority: kitchenOrder.priority,
        items: kitchenItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          modifications: i.modifications,
          notes: i.notes,
        })),
        createdAt: kitchenOrder.created_at,
        estimatedTime: maxPrepTime,
      });
    } catch (socketErr) {
      logger.warn('[KITCHEN SYNC] Socket emit failed (non-fatal):', socketErr);
    }

    logger.info(`[KITCHEN SYNC] Kitchen order ${kitchenOrder.id} created for restaurant order ${orderNumber}`);
  } catch (err) {
    logger.warn('[KITCHEN SYNC] Propagation error (non-fatal):', err);
  }
}

export async function createOrder(data: {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  tableId?: string;
  tableNumber?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
    selectedModifiers?: SelectedModifier[];
    modifierTotal?: number;
  }>;
  specialInstructions?: string;
  paymentMethod?: 'cash' | 'card' | 'whish' | 'online' | 'room_charge';
  taxExempt?: boolean;
  // Discount integration fields
  couponCode?: string;
  giftCardRedemptions?: Array<{ code: string; amount: number }>;
  loyaltyPointsToRedeem?: number;
  loyaltyPointsDollarValue?: number;
}) {
  const supabase = getSupabase();

  // Resolve Table ID from number if ID is missing
  let finalTableId = data.tableId;
  if (!finalTableId && data.tableNumber) {
    const { data: tableRes } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('table_number', data.tableNumber)
      .eq('is_active', true)
      .single();

    if (tableRes) {
      finalTableId = tableRes.id;
    }
  }

  // Get menu items for pricing
  const itemIds = data.items.map(i => i.menuItemId);
  const { data: menuItemsList, error: itemsError } = await supabase
    .from('menu_items')
    .select('*')
    .in('id', itemIds);

  if (itemsError) throw itemsError;

  const itemMap = new Map((menuItemsList || []).map(i => [i.id, i]));

  // Infer module_id from the first item (assuming all items are from the same module)
  // If mixed modules is possible in backend but not frontend, this might be risky, 
  // but frontend now enforces single module per checkout.
  const moduleId = menuItemsList?.[0]?.module_id;

  // Pre-fetch all modifier option prices from DB for accurate pricing
  const allModifierOptionIds = data.items
    .flatMap(item => (item.selectedModifiers || []).map(m => m.optionId))
    .filter(Boolean);
  
  let modifierPriceMap = new Map<string, number>();
  if (allModifierOptionIds.length > 0) {
    const { data: modOpts } = await supabase
      .from('menu_modifier_options')
      .select('id, price_adjustment')
      .in('id', allModifierOptionIds);
    if (modOpts) {
      modifierPriceMap = new Map(modOpts.map(o => [o.id, parseFloat(o.price_adjustment) || 0]));
    }
  }

  // Calculate totals (including modifiers)
  let subtotal = 0;
  const orderItems = data.items.map(item => {
    const menuItem = itemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
    if (!menuItem.is_available) throw new Error(`${menuItem.name} is not available`);

    // FIX Iter-1: Use discount_price when available, fall back to regular price
    // Previously only used menuItem.price, causing overcharge when items are on sale
    const unitPrice = menuItem.discount_price != null && parseFloat(menuItem.discount_price) > 0
      ? parseFloat(menuItem.discount_price)
      : parseFloat(menuItem.price);

    // Calculate modifier total for this item using DB prices (not client-provided)
    let modifierTotal = 0;
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      modifierTotal = item.selectedModifiers.reduce((sum, mod) => {
        const dbPrice = modifierPriceMap.get(mod.optionId) ?? mod.priceAdjustment;
        const qty = mod.quantity || 1;
        return sum + (dbPrice * qty);
      }, 0);
    }

    // Item subtotal = (base price + modifier total) * quantity
    const itemSubtotal = (unitPrice + modifierTotal) * item.quantity;
    subtotal += itemSubtotal;

    return {
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal,
      modifier_total: modifierTotal,
      special_instructions: item.specialInstructions,
      selected_modifiers: item.selectedModifiers || [],
    };
  });

  // === ENGINE-POWERED PRICING (Engine A: instant_transaction) ===
  // Route through unified pricing pipeline instead of inline calculation.
  // This handles: tax, service charge, delivery fee, coupons, gift cards, loyalty points.
  const engineService = getEngineService();
  const pricingLineItems: PricingLineItem[] = orderItems.map(item => ({
    name: itemMap.get(item.menu_item_id)?.name || 'Unknown',
    unitPrice: item.unit_price,
    quantity: item.quantity,
    unitAdjustment: item.modifier_total,
  }));
  const pricingContext: PricingContext = {
    moduleId,
    conditions: { orderType: data.orderType, taxExempt: data.taxExempt },
    couponCode: data.couponCode,
    giftCardCodes: data.giftCardRedemptions?.map(g => g.code),
    loyaltyPointsToRedeem: data.loyaltyPointsToRedeem,
    customerId: data.customerId,
  };
  const pricing = await engineService.calculatePricing('menu_service', pricingLineItems, pricingContext);

  // Extract discount details from pricing result for DB storage
  const couponDiscount = pricing.discounts.find(d => d.type === 'coupon')?.amount || 0;
  const giftCardAmount = pricing.discounts.filter(d => d.type === 'gift_card').reduce((sum, d) => sum + d.amount, 0);
  const loyaltyPointsUsed = (pricing.discounts.find(d => d.type === 'loyalty')?.metadata?.pointsUsed as number) || 0;
  const loyaltyDiscount = pricing.discounts.find(d => d.type === 'loyalty')?.amount || 0;
  const couponId = pricing.discounts.find(d => d.type === 'coupon')?.referenceId;

  // Estimate ready time (average prep time + buffer)
  const avgPrepTime = Math.max(...(menuItemsList || []).map(i => i.preparation_time_minutes || 15));
  const estimatedReadyTime = dayjs().add(avgPrepTime + 5, 'minute').toISOString();

  // Use initial state from engine
  const initialState = engineService.getInitialState('menu_service');

  // Create order with engine-calculated totals
  const { data: order, error: orderError } = await supabase
    .from('restaurant_orders')
    .insert({
      order_number: generateOrderNumber(),
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      table_id: finalTableId,
      module_id: moduleId,
      order_type: data.orderType,
      status: initialState,
      subtotal: pricing.subtotal.toFixed(2),
      tax_amount: pricing.taxAmount.toFixed(2),
      service_charge: pricing.serviceCharge.toFixed(2),
      delivery_fee: pricing.deliveryFee.toFixed(2),
      discount_amount: pricing.totalDiscount.toFixed(2),
      total_amount: pricing.totalAmount.toFixed(2),
      coupon_id: couponId,
      coupon_code: data.couponCode,
      coupon_discount: couponDiscount.toFixed(2),
      gift_card_amount: giftCardAmount.toFixed(2),
      loyalty_points_used: loyaltyPointsUsed,
      loyalty_discount: loyaltyDiscount.toFixed(2),
      special_instructions: data.specialInstructions,
      estimated_ready_time: estimatedReadyTime,
      payment_status: 'pending',
      payment_method: data.paymentMethod,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items (including modifiers data for inventory deduction)
  const { error: insertItemsError } = await supabase
    .from('restaurant_order_items')
    .insert(orderItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price.toFixed(2),
      subtotal: item.subtotal.toFixed(2),
      modifier_total: item.modifier_total.toFixed(2),
      special_instructions: item.special_instructions,
      selected_modifiers: item.selected_modifiers,
    })));

  if (insertItemsError) throw insertItemsError;

  // === DEDUCT INVENTORY (for ingredients linked to menu items AND modifiers) ===
  try {
    const { data: inventoryResult, error: inventoryError } = await supabase.rpc(
      'deduct_inventory_for_order_v2', // Use v2 that handles modifiers
      { p_order_id: order.id }
    );

    if (inventoryError) {
      logger.warn('[ORDER SERVICE] Inventory deduction failed:', inventoryError);
    } else if (inventoryResult && inventoryResult[0]) {
      const { base_items_deducted, modifier_items_deducted, skipped_removals } = inventoryResult[0];
      logger.info('[ORDER SERVICE] Inventory deducted:', {
        baseItems: base_items_deducted,
        modifierItems: modifier_items_deducted,
        skippedRemovals: skipped_removals,
      });
    }
  } catch (err) {
    logger.warn('[ORDER SERVICE] Inventory deduction error (non-fatal):', err);
  }

  logger.info('[ORDER SERVICE] Order created:', order.order_number, {
    subtotal: pricing.subtotal,
    totalDiscount: pricing.totalDiscount,
    finalTotal: pricing.totalAmount,
    pointsEarned: pricing.loyaltyPointsEarned,
  });

  // Create status history
  await supabase
    .from('restaurant_order_status_history')
    .insert({
      order_id: order.id,
      to_status: 'pending',
    });

  // Calculate estimated ready time for kitchen
  const maxPrepTime = Math.max(...data.items.map(i => itemMap.get(i.menuItemId)?.preparation_time_minutes || 15));
  const kitchenReadyTime = dayjs().add(maxPrepTime, 'minute').toISOString();

  // FIX: Issue 3 — Propagate order to kitchen display system
  propagateToKitchen(
    order.id,
    order.order_number,
    finalTableId,
    data.items.map(i => ({
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
      special_instructions: i.specialInstructions,
      selected_modifiers: i.selectedModifiers
    })),
    itemMap,
    kitchenReadyTime
  ).catch(err => {
    logger.warn('[ORDER SERVICE] Kitchen propagation failed (non-fatal):', err);
  });

  // Emit real-time event to restaurant staff
  emitToUnit('restaurant', 'order:new', {
    orderId: order.id,
    orderNumber: order.order_number,
    orderType: order.order_type,
    totalAmount: order.total_amount,
    moduleId: order.module_id,
  });

  // Notify admin dashboard of new revenue activity
  emitToRole('admin', 'dashboard:activity', {
    type: 'new_order',
    source: 'restaurant',
    amount: order.total_amount,
    orderNumber: order.order_number,
    timestamp: new Date().toISOString(),
  });

  // Send order confirmation email if customer email is available
  if (data.customerEmail) {
    const formattedItems = orderItems.map((item) => {
      const menuItem = itemMap.get(item.menu_item_id);
      return {
        name: menuItem?.name || 'Unknown Item',
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.subtotal,
      };
    });

    emailService.sendOrderConfirmation({
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      orderNumber: order.order_number,
      orderDate: dayjs(order.created_at).format('MMMM D, YYYY h:mm A'),
      estimatedTime: dayjs(order.estimated_ready_time).format('h:mm A'),
      items: formattedItems,
      totalAmount: parseFloat(order.total_amount),
    }).catch((err) => {
      // Don't fail the order if email fails
      logger.warn('Failed to send order confirmation email:', err);
    });
  }

  return order;
}

export async function getOrderById(id: string) {
  const supabase = getSupabase();

  const { data: order, error: orderError } = await supabase
    .from('restaurant_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError) {
    if (orderError.code === 'PGRST116') return null;
    throw orderError;
  }

  const { data: items, error: itemsError } = await supabase
    .from('restaurant_order_items')
    .select(`
      id,
      quantity,
      unit_price,
      subtotal,
      special_instructions,
      menu_items (
        id,
        name,
        name_ar,
        image_url
      )
    `)
    .eq('order_id', id);

  if (itemsError) throw itemsError;

  // Transform items to match frontend expectations
  const transformedItems = (items || []).map((item: Record<string, unknown>) => ({
    ...item,
    menu_item: item.menu_items, // Frontend expects menu_item (singular)
    total_price: item.subtotal, // Frontend expects total_price
  }));

  return { ...order, items: transformedItems };
}

export async function getOrderStatus(id: string) {
  // Return full order details for confirmation page
  return getOrderById(id);
}

export async function getOrdersByCustomer(customerId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('restaurant_orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getOrders(filters: { status?: string; date?: string; moduleId?: string }) {
  const supabase = getSupabase();

  let query = supabase
    .from('restaurant_orders')
    .select(`
      *,
      order_items:restaurant_order_items (
        id,
        quantity,
        unit_price,
        special_instructions,
        selected_modifiers,
        modifier_total,
        menu_items (
          id,
          name,
          module_id
        )
      ),
      customer:users!customer_id (
        full_name
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filters.moduleId) {
    query = query.eq('module_id', filters.moduleId);
  }

  if (filters.status) {
    // Handle comma-separated status values
    const statuses = filters.status.split(',').map(s => s.trim());
    if (statuses.length > 1) {
      query = query.in('status', statuses);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters.date) {
    const startOfDay = dayjs(filters.date).startOf('day').toISOString();
    const endOfDay = dayjs(filters.date).endOf('day').toISOString();
    query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getLiveOrders(moduleId?: string) {
  const supabase = getSupabase();
  const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready'];

  let query = supabase
    .from('restaurant_orders')
    .select(`
      *,
      order_items:restaurant_order_items (
        id,
        quantity,
        unit_price,
        special_instructions,
        selected_modifiers,
        modifier_total,
        menu_items (
          id,
          name
        )
      ),
      customer:users!customer_id (
        full_name
      )
    `)
    .in('status', activeStatuses)
    .order('created_at', { ascending: true });

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateOrderStatus(
  id: string,
  status: string,
  changedBy: string,
  notes?: string
) {
  const supabase = getSupabase();

  // Get current order
  const { data: currentOrder, error: fetchError } = await supabase
    .from('restaurant_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw new Error('Order not found');

  // === ENGINE-POWERED STATE TRANSITION (Engine A: instant_transaction) ===
  const engineService = getEngineService();
  
  // Map target status → engine action. Special statuses (voided, comped) bypass engine.
  const isSpecialStatus = ['voided', 'comped'].includes(status);
  if (!isSpecialStatus) {
    const statusToAction: Record<string, string> = {
      confirmed: 'confirm',
      preparing: 'start_preparation',
      ready: 'mark_ready',
      served: 'deliver', // served maps to deliver action
      delivered: 'deliver',
      completed: ['ready', 'delivered', 'served'].includes(currentOrder.status) ? 'complete' : 'deliver',
      cancelled: 'cancel',
    };
    const action = statusToAction[status];
    if (action) {
      const actor = changedBy ? 'staff' : 'system'; // Could check roles for admin
      const transitionResult = await engineService.transitionState(
        'menu_service',
        currentOrder.status,
        action,
        actor
      );

      if (!transitionResult.allowed) {
        throw new Error(transitionResult.error || `Cannot transition from ${currentOrder.status} to ${status}`);
      }
      // Use the engine's target state (may differ from requested status)
      status = transitionResult.targetState;
    }
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'ready') {
    updateData.actual_ready_time = new Date().toISOString();
  }
  if (status === 'served') {
    updateData.served_at = new Date().toISOString();
  }
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    // Mark as paid when order is completed (for stress testing & realistic flow)
    updateData.payment_status = 'paid';
  }
  if (status === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString();
    updateData.cancellation_reason = notes;
  }
  if (status === 'voided') {
    updateData.cancelled_at = new Date().toISOString();
    updateData.cancellation_reason = notes || 'Voided by manager';
    updateData.payment_status = 'voided';
  }
  if (status === 'comped') {
    updateData.cancelled_at = new Date().toISOString();
    updateData.cancellation_reason = notes || 'Complimentary';
    updateData.payment_status = 'comped';
    updateData.total_amount = '0.00';
  }

  const { data: order, error: updateError } = await supabase
    .from('restaurant_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Record status history
  await supabase
    .from('restaurant_order_status_history')
    .insert({
      order_id: id,
      from_status: currentOrder.status,
      to_status: status,
      changed_by: changedBy,
      notes,
    });

  // Emit real-time update
  emitToUnit('restaurant', 'order:updated', {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    moduleId: order.module_id,
  });

  return order;
}

export async function getDailyReport(dateStr?: string, moduleId?: string) {
  const supabase = getSupabase();
  const date = dateStr ? dayjs(dateStr) : dayjs();
  const startOfDay = date.startOf('day').toISOString();
  const endOfDay = date.endOf('day').toISOString();

  let query = supabase
    .from('restaurant_orders')
    .select('*')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .is('deleted_at', null);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data: orders, error } = await query;

  if (error) throw error;

  const allOrders = orders || [];
  const completedOrders = allOrders.filter(o => o.status === 'completed');
  const cancelledOrders = allOrders.filter(o => o.status === 'cancelled');

  const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
  const totalTax = completedOrders.reduce((sum, o) => sum + parseFloat(o.tax_amount), 0);

  return {
    date: date.format('YYYY-MM-DD'),
    totalOrders: allOrders.length,
    completedOrders: completedOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalRevenue,
    totalTax,
    averageOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
  };
}

export async function getSalesReport(startDate: string, endDate: string, moduleId?: string) {
  const supabase = getSupabase();
  const start = dayjs(startDate).startOf('day').toISOString();
  const end = dayjs(endDate).endOf('day').toISOString();

  let query = supabase
    .from('restaurant_orders')
    .select('*')
    .gte('created_at', start)
    .lte('created_at', end)
    .eq('status', 'completed')
    .is('deleted_at', null);

  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data: orders, error } = await query;

  if (error) throw error;

  const allOrders = orders || [];
  const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  return {
    startDate,
    endDate,
    totalOrders: allOrders.length,
    totalRevenue,
    averageOrderValue: allOrders.length > 0 ? totalRevenue / allOrders.length : 0,
  };
}
