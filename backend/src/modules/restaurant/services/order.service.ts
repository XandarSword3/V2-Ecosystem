import { getSupabase } from "../../../database/connection.js";
import { emitToUnit } from "../../../socket/index.js";
import { emailService } from "../../../services/email.service.js";
import { logger } from "../../../utils/logger.js";
import dayjs from 'dayjs';

const TAX_RATE = 0.11; // 11% VAT in Lebanon

function generateOrderNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `R-${date}-${random}${suffix}`;
}

export async function createOrder(data: {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  tableId?: string;
  tableNumber?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
  specialInstructions?: string;
  paymentMethod?: 'cash' | 'card' | 'whish' | 'online' | 'room_charge';
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

  // Calculate totals
  let subtotal = 0;
  const orderItems = data.items.map(item => {
    const menuItem = itemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
    if (!menuItem.is_available) throw new Error(`${menuItem.name} is not available`);

    const unitPrice = parseFloat(menuItem.price);
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;

    return {
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal,
      special_instructions: item.specialInstructions,
    };
  });

  const taxAmount = subtotal * TAX_RATE;
  const serviceCharge = data.orderType === 'dine_in' ? subtotal * 0.1 : 0; // 10% service for dine-in
  const deliveryFee = data.orderType === 'delivery' ? 5 : 0; // Flat delivery fee
  const preDiscountTotal = subtotal + taxAmount + serviceCharge + deliveryFee;

  // Initialize discount tracking
  let totalDiscount = 0;
  let couponDiscount = 0;
  let taxSavings = 0; // Track tax reduction from pre-tax coupons
  let couponId: string | undefined;
  let giftCardAmount = 0;
  const giftCardRedemptions: Array<{ code: string; amount: number; giftCardId: string }> = [];
  let loyaltyPointsUsed = 0;
  let loyaltyDiscount = 0;

  // Estimate ready time (average prep time + buffer)
  const avgPrepTime = Math.max(...(menuItemsList || []).map(i => i.preparation_time_minutes || 15));
  const estimatedReadyTime = dayjs().add(avgPrepTime + 5, 'minute').toISOString();

  // Create order first (we need the ID for discount tracking)
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
      status: 'pending',
      subtotal: subtotal.toFixed(2),
      tax_amount: taxAmount.toFixed(2),
      service_charge: serviceCharge.toFixed(2),
      delivery_fee: deliveryFee.toFixed(2),
      discount_amount: '0', // Will be updated after discounts
      total_amount: preDiscountTotal.toFixed(2), // Will be updated
      special_instructions: data.specialInstructions,
      estimated_ready_time: estimatedReadyTime,
      payment_status: 'pending',
      payment_method: data.paymentMethod,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items
  const { error: insertItemsError } = await supabase
    .from('restaurant_order_items')
    .insert(orderItems.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price.toFixed(2),
      subtotal: item.subtotal.toFixed(2),
      special_instructions: item.special_instructions,
    })));

  if (insertItemsError) throw insertItemsError;

  // === APPLY DISCOUNTS (Order: Coupon -> Gift Cards -> Loyalty Points) ===
  let remainingTotal = preDiscountTotal;

  // 1. Apply Coupon (if provided)
  if (data.couponCode) {
    try {
      const { data: couponResult, error: couponError } = await supabase.rpc(
        'apply_coupon_atomic',
        {
          p_code: data.couponCode.toUpperCase(),
          p_user_id: data.customerId || null,
          p_order_total: subtotal, // Coupon applies to subtotal
          p_order_id: order.id,
          p_module_type: 'all',
        }
      );

      if (couponError) {
        logger.warn('[ORDER SERVICE] Coupon application failed:', couponError);
      } else if (couponResult && couponResult[0]?.success) {
        couponDiscount = parseFloat(couponResult[0].discount_amount) || 0;
        couponId = couponResult[0].coupon_id;
        
        // Coupons are pre-tax, so we need to reduce the tax amount
        const currentTaxSavings = couponDiscount * TAX_RATE;
        taxSavings += currentTaxSavings;
        
        totalDiscount += couponDiscount;
        // Reduce remaining total by discount AND the tax that is no longer applicable
        remainingTotal -= (couponDiscount + currentTaxSavings);
        
        logger.info('[ORDER SERVICE] Coupon applied:', { code: data.couponCode, discount: couponDiscount, taxSavings: currentTaxSavings });
      } else if (couponResult && couponResult[0]?.error_message) {
        logger.warn('[ORDER SERVICE] Coupon invalid:', couponResult[0].error_message);
      }
    } catch (err) {
      logger.warn('[ORDER SERVICE] Coupon error (non-fatal):', err);
    }
  }

  // 2. Apply Gift Cards (if provided)
  if (data.giftCardRedemptions && data.giftCardRedemptions.length > 0) {
    for (const gc of data.giftCardRedemptions) {
      if (remainingTotal <= 0) break;

      try {
        const { data: gcResult, error: gcError } = await supabase.rpc(
          'redeem_giftcard_atomic',
          {
            p_code: gc.code.toUpperCase(),
            p_amount: Math.min(gc.amount, remainingTotal),
            p_order_id: order.id,
          }
        );

        if (gcError) {
          logger.warn('[ORDER SERVICE] Gift card redemption failed:', gcError);
        } else if (gcResult && gcResult[0]?.success) {
          const redeemed = parseFloat(gcResult[0].amount_redeemed) || 0;
          giftCardAmount += redeemed;
          totalDiscount += redeemed;
          remainingTotal -= redeemed;
          giftCardRedemptions.push({
            code: gc.code,
            amount: redeemed,
            giftCardId: gcResult[0].gift_card_id,
          });
          logger.info('[ORDER SERVICE] Gift card redeemed:', { code: gc.code, amount: redeemed });
        }
      } catch (err) {
        logger.warn('[ORDER SERVICE] Gift card error (non-fatal):', err);
      }
    }
  }

  // 3. Apply Loyalty Points (if provided)
  if (data.loyaltyPointsToRedeem && data.loyaltyPointsToRedeem > 0 && data.customerId) {
    try {
      const pointsDollarValue = data.loyaltyPointsDollarValue || (data.loyaltyPointsToRedeem / 100);
      const redeemAmount = Math.min(pointsDollarValue, remainingTotal);

      const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc(
        'redeem_loyalty_points_atomic',
        {
          p_user_id: data.customerId,
          p_points: data.loyaltyPointsToRedeem,
          p_order_id: order.id,
          p_dollar_value: redeemAmount,
        }
      );

      if (loyaltyError) {
        logger.warn('[ORDER SERVICE] Loyalty redemption failed:', loyaltyError);
      } else if (loyaltyResult && loyaltyResult[0]?.success) {
        loyaltyPointsUsed = loyaltyResult[0].points_redeemed || 0;
        loyaltyDiscount = redeemAmount;
        totalDiscount += loyaltyDiscount;
        remainingTotal -= loyaltyDiscount;
        logger.info('[ORDER SERVICE] Loyalty points redeemed:', { points: loyaltyPointsUsed, value: loyaltyDiscount });
      }
    } catch (err) {
      logger.warn('[ORDER SERVICE] Loyalty error (non-fatal):', err);
    }
  }

  // Calculate final total
  // original preDiscountTotal included full tax. We subtract the discount amounts AND the tax savings.
  const finalTotal = Math.max(0, preDiscountTotal - totalDiscount - taxSavings);
  const finalTaxAmount = Math.max(0, taxAmount - taxSavings);

  // Update order with discount information if any discounts were applied
  if (totalDiscount > 0) {
    await supabase
      .from('restaurant_orders')
      .update({
        discount_amount: totalDiscount.toFixed(2),
        total_amount: finalTotal.toFixed(2),
        tax_amount: finalTaxAmount.toFixed(2), // Update tax to reflect pre-tax discount
        coupon_id: couponId,
        coupon_code: data.couponCode,
        coupon_discount: couponDiscount.toFixed(2),
        gift_card_amount: giftCardAmount.toFixed(2),
        loyalty_points_used: loyaltyPointsUsed,
        loyalty_discount: loyaltyDiscount.toFixed(2),
      })
      .eq('id', order.id);
    
    // Update local order object
    order.discount_amount = totalDiscount.toFixed(2);
    order.total_amount = finalTotal.toFixed(2);
    order.tax_amount = finalTaxAmount.toFixed(2);
  }

  // === EARN LOYALTY POINTS (if customer is logged in) ===
  let loyaltyPointsEarned = 0;
  if (data.customerId && finalTotal > 0) {
    try {
      const { data: earnResult } = await supabase.rpc(
        'earn_loyalty_points_atomic',
        {
          p_user_id: data.customerId,
          p_order_total: finalTotal,
          p_order_id: order.id,
          p_points_per_dollar: 1, // Could be configurable
        }
      );

      if (earnResult && earnResult[0]?.success) {
        loyaltyPointsEarned = earnResult[0].points_earned || 0;
        logger.info('[ORDER SERVICE] Loyalty points earned:', loyaltyPointsEarned);
      }
    } catch (err) {
      logger.warn('[ORDER SERVICE] Points earning error (non-fatal):', err);
    }
  }

  // === DEDUCT INVENTORY (for ingredients linked to menu items) ===
  try {
    const { data: inventoryResult, error: inventoryError } = await supabase.rpc(
      'deduct_inventory_for_order',
      { p_order_id: order.id }
    );

    if (inventoryError) {
      logger.warn('[ORDER SERVICE] Inventory deduction failed:', inventoryError);
    } else if (inventoryResult && inventoryResult[0]?.items_deducted > 0) {
      logger.info('[ORDER SERVICE] Inventory deducted:', inventoryResult[0].items_deducted, 'items');
    }
  } catch (err) {
    logger.warn('[ORDER SERVICE] Inventory deduction error (non-fatal):', err);
  }

  logger.info('[ORDER SERVICE] Order created:', order.order_number, {
    subtotal,
    totalDiscount,
    finalTotal,
    pointsEarned: loyaltyPointsEarned,
  });

  // Create status history
  await supabase
    .from('restaurant_order_status_history')
    .insert({
      order_id: order.id,
      to_status: 'pending',
    });

  // Emit real-time event to restaurant staff
  emitToUnit('restaurant', 'order:new', {
    orderId: order.id,
    orderNumber: order.order_number,
    orderType: order.order_type,
    totalAmount: order.total_amount,
    moduleId: order.module_id,
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
