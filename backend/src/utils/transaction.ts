/**
 * Transaction Helper for Supabase
 * 
 * Provides transactional semantics for multi-step database operations.
 * Uses Supabase RPC for true database transactions.
 */

import { getSupabase } from '../database/supabase.js';
import { logger } from './logger.js';

export interface TransactionContext {
  supabase: ReturnType<typeof getSupabase>;
  rollbackHandlers: Array<() => Promise<void>>;
}

/**
 * Execute a series of operations with rollback capability.
 * If any operation fails, all rollback handlers are executed in reverse order.
 * 
 * @example
 * await withTransaction(async (ctx) => {
 *   const booking = await createBooking(ctx, data);
 *   ctx.rollbackHandlers.push(() => deleteBooking(booking.id));
 *   
 *   const payment = await createPayment(ctx, booking.id);
 *   ctx.rollbackHandlers.push(() => deletePayment(payment.id));
 *   
 *   return { booking, payment };
 * });
 */
export async function withTransaction<T>(
  operation: (ctx: TransactionContext) => Promise<T>
): Promise<T> {
  const supabase = getSupabase();
  const ctx: TransactionContext = {
    supabase,
    rollbackHandlers: [],
  };

  try {
    const result = await operation(ctx);
    return result;
  } catch (error) {
    // Execute rollback handlers in reverse order
    logger.error('Transaction failed, executing rollback handlers...', { error });
    
    for (let i = ctx.rollbackHandlers.length - 1; i >= 0; i--) {
      try {
        await ctx.rollbackHandlers[i]();
        logger.info(`Rollback handler ${i + 1} executed successfully`);
      } catch (rollbackError) {
        logger.error(`Rollback handler ${i + 1} failed`, { rollbackError });
      }
    }
    
    throw error;
  }
}

/**
 * Helper to create a booking with associated add-ons transactionally.
 * Automatically registers rollback handlers for cleanup.
 */
export async function createBookingTransactional(
  ctx: TransactionContext,
  bookingData: Record<string, unknown>,
  addOnItems: Array<{ add_on_id: string; quantity: number; unit_price: number; subtotal: number }>
): Promise<{ booking: Record<string, unknown>; addOns: Record<string, unknown>[] }> {
  // Insert booking
  const { data: booking, error: bookingError } = await ctx.supabase
    .from('chalet_bookings')
    .insert(bookingData)
    .select()
    .single();

  if (bookingError || !booking) {
    throw new Error(`Failed to create booking: ${bookingError?.message || 'Unknown error'}`);
  }

  // Register rollback handler
  ctx.rollbackHandlers.push(async () => {
    await ctx.supabase
      .from('chalet_bookings')
      .delete()
      .eq('id', booking.id);
    logger.info(`Rolled back booking ${booking.id}`);
  });

  // Insert add-ons if present
  let addOns: Record<string, unknown>[] = [];
  if (addOnItems.length > 0) {
    const addOnsData = addOnItems.map(item => ({
      booking_id: booking.id,
      add_on_id: item.add_on_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));

    const { data: addOnsResult, error: addOnsError } = await ctx.supabase
      .from('chalet_booking_add_ons')
      .insert(addOnsData)
      .select();

    if (addOnsError) {
      throw new Error(`Failed to create booking add-ons: ${addOnsError.message}`);
    }

    addOns = addOnsResult || [];

    // Register rollback handler for add-ons
    ctx.rollbackHandlers.push(async () => {
      await ctx.supabase
        .from('chalet_booking_add_ons')
        .delete()
        .eq('booking_id', booking.id);
      logger.info(`Rolled back add-ons for booking ${booking.id}`);
    });
  }

  return { booking: booking as Record<string, unknown>, addOns };
}

/**
 * Helper to create an order with items transactionally.
 */
export async function createOrderTransactional(
  ctx: TransactionContext,
  orderData: Record<string, unknown>,
  orderItems: Array<Record<string, unknown>>
): Promise<{ order: Record<string, unknown>; items: Record<string, unknown>[] }> {
  // Insert order
  const { data: order, error: orderError } = await ctx.supabase
    .from('restaurant_orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message || 'Unknown error'}`);
  }

  // Register rollback handler
  ctx.rollbackHandlers.push(async () => {
    await ctx.supabase
      .from('restaurant_orders')
      .delete()
      .eq('id', order.id);
    logger.info(`Rolled back order ${order.id}`);
  });

  // Insert order items
  let items: Record<string, unknown>[] = [];
  if (orderItems.length > 0) {
    const itemsData = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { data: itemsResult, error: itemsError } = await ctx.supabase
      .from('restaurant_order_items')
      .insert(itemsData)
      .select();

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    items = itemsResult || [];

    // Register rollback handler for items
    ctx.rollbackHandlers.push(async () => {
      await ctx.supabase
        .from('restaurant_order_items')
        .delete()
        .eq('order_id', order.id);
      logger.info(`Rolled back items for order ${order.id}`);
    });
  }

  return { order: order as Record<string, unknown>, items };
}
