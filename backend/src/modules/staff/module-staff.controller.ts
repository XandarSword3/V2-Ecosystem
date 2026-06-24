import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { validateBody } from '../../validation/schemas.js';
import { emitToUnit } from '../../socket/index.js';
import { getEngineService } from '../../engines/engine-service.js';
import { TEMPLATE_TO_ENGINE } from '../../engines/types.js';

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

    if (module.engine_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Module is not a menu service' });
    }

    // Build query for orders — use transactions table for instant_transaction engine
    let query = supabase
      .from('transactions')
      .select(`
        id, order_number, customer_id, engine_type, status, amount, created_at, 
        reference_id, reference_table, customer_name, customer_phone, table_id, staff_id, metadata
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

    // Transform data for frontend
    const transformedOrders = (orders || []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name || 'Guest',
      customerId: order.customer_id,
      orderType: order.engine_type,
      status: order.status,
      items: [], // Items would need to be fetched separately from order items table
      totalAmount: order.amount,
      tableNumber: order.table_id,
      createdAt: order.created_at,
    }));

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

    if (!module || module.engine_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Invalid module for table operations' });
    }

    // Tabs are open instant_transactions with tab_state: 'open' in metadata
    const { data: sourceTab } = await supabase
      .from('transactions')
      .select('id, customer_id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .filter('metadata->>table_id', 'eq', tableId)
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
      .filter('metadata->>table_id', 'eq', newTableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .maybeSingle();

    if (existingTarget) {
      return res.status(409).json({ success: false, error: 'Target table already has an open tab' });
    }

    const sourceMeta = sourceTab.metadata as Record<string, any>;
    const { data: newTab, error: createError } = await supabase
      .from('transactions')
      .insert({
        engine_type: 'instant_transaction',
        status: 'pending',
        customer_id: sourceTab.customer_id,
        module_id: module.id,
        amount: 0,
        metadata: {
          ...sourceMeta,
          table_id: newTableId,
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

    if (!module || module.engine_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Invalid module for table operations' });
    }

    const { data: sourceTab } = await supabase
      .from('transactions')
      .select('id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .filter('metadata->>table_id', 'eq', tableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: targetTab } = await supabase
      .from('transactions')
      .select('id, metadata')
      .eq('engine_type', 'instant_transaction')
      .eq('status', 'pending')
      .filter('metadata->>table_id', 'eq', targetTableId)
      .filter('metadata->>tab_state', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sourceTab || !targetTab) {
      return res.status(404).json({ success: false, error: 'Both source and target tables must have open tabs' });
    }

    // Reassign all orders from source tab to target tab (via metadata)
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

    if (!module || module.engine_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    // Valid status transitions
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Update the order in the unified transactions table
    // Use engine framework for state transitions
    const engineService = getEngineService();
    
    // Get current order to determine state transition
    const { data: currentOrder, error: fetchError } = await supabase
      .from('transactions')
      .select('status, module_id')
      .eq('engine_type', 'instant_transaction')
      .eq('id', orderId)
      .single();
      
    if (fetchError || !currentOrder) throw fetchError || new Error('Order not found');
    
    // Map status to engine action
    let engineAction: string;
    switch (status) {
      case 'preparing': engineAction = 'start_preparation'; break;
      case 'ready': engineAction = 'mark_ready'; break;
      case 'served': engineAction = 'mark_served'; break;
      case 'completed': engineAction = 'complete'; break;
      case 'cancelled': engineAction = 'cancel'; break;
      default: throw new Error(`Invalid status: ${status}`);
    }
    
    // Execute state transition via engine
    // Read module config to determine the correct engine type dynamically
    const { data: moduleConfig } = await supabase
      .from('modules')
      .select('engine_type')
      .eq('id', currentOrder.module_id)
      .single();
    
    // Use TEMPLATE_TO_ENGINE constant for consistent mapping
    const engineType = TEMPLATE_TO_ENGINE[moduleConfig?.engine_type] || 'instant_transaction';

    const transitionResult = await engineService.transitionState(
      engineType,
      currentOrder.status,
      engineAction,
      'staff',
      { 
        orderId,
        staffId: userId,
        ...(status === 'preparing' ? { estimated_ready_time: new Date(Date.now() + 20 * 60000).toISOString() } : {}),
        ...(status === 'ready' ? { actual_ready_time: new Date().toISOString() } : {}),
        ...(status === 'served' ? { served_at: new Date().toISOString() } : {}),
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
      }
    );
    
    // Get updated order
    const { data: order, error: updateError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', orderId)
      .single();

    if (updateError) throw updateError;

    // Log activity (non-critical, don't fail if table doesn't exist)
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'order_status_update',
        resource_type: 'order',
        resource_id: orderId,
        details: { newStatus: status, moduleSlug: slug },
      });
    } catch (logError: any) {
      logger.warn('Failed to log activity:', logError.message);
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    logger.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order', message: error.message });
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

    if (module.engine_type !== 'multi_day_booking') {
      return res.status(400).json({ success: false, error: 'Module is not a booking service' });
    }

    // Build query — actual table is transactions
    let query = supabase
      .from('transactions')
      .select(`
        *,
        unit:accommodation_units!reference_id(id, name, capacity),
        user:users!customer_id(id, full_name, email, phone)
      `)
      .eq('engine_type', 'time_exclusive_reservation');

    // Filter by date (check-in or check-out on this date)
    if (date) {
      query = query.or(`check_in_date.eq.${date},check_out_date.eq.${date}`);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query = query.order('check_in_date', { ascending: true })
      .range(offset, offset + parseInt(limit as string) - 1);

    const { data: bookings, error, count } = await query;

    if (error) throw error;

    // Transform for frontend
    // Transform for frontend
    const transformedBookings = (bookings || []).map(booking => ({
      id: booking.id,
      bookingNumber: booking.booking_number,
      guestName: booking.customer_name || (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.full_name || 'Guest',
      guestEmail: booking.customer_email || (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.email,
      guestPhone: (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.phone,
      unitId: booking.reference_id,
      unitName: (Array.isArray((booking as any).unit) ? (booking as any).unit[0] : (booking as any).unit)?.name || 'Unit',
      checkIn: booking.metadata?.check_in_date,
      checkOut: booking.metadata?.check_out_date,
      status: booking.status,
      totalPrice: (booking as any).amount,
      guestCount: (booking as any).metadata?.number_of_guests,
      specialRequests: booking.metadata?.special_requests,
      createdAt: booking.created_at,
    }));

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

    if (!module || module.engine_type !== 'multi_day_booking') {
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
      .select('status, reference_id, booking_number')
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
          notes: `Auto-generated from checkout. Booking #${booking.booking_number}`,
          reference_id: bookingId,
          reference_table: 'transactions'
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
    });

    res.json({ success: true, data: booking });
  } catch (error: any) {
    logger.error('Error updating booking status:', error);
    res.status(500).json({ success: false, error: 'Failed to update booking', message: error.message });
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

    if (module.engine_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Module is not a session access service' });
    }

    // Get sessions for today or specified date
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Actual table is capacity_windows
    const { data: sessions, error } = await supabase
      .from('capacity_windows')
      .select(`
        id, name, start_time, end_time, capacity, current_count, status,
        tickets:transactions(id, ticket_number, status, customer_id, user:users!customer_id(full_name))
      `)
      .filter('tickets.engine_type', 'eq', 'shared_capacity_access')
      .eq('date', targetDate)
      .order('start_time', { ascending: true });

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

    if (!module || module.engine_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket validation' });
    }

    // Find the ticket from unified transactions
    const { data: ticket, error } = await supabase
      .from('transactions')
      .select(`
        id, ticket_number, status, customer_id, customer_name, metadata,
        session:capacity_windows!reference_id(id, name, capacity)
      `)
      .eq('ticket_number', ticketNumber)
      .eq('engine_type', 'shared_capacity_access')
      .single();

    if (error || !ticket) {
      return res.json({
        success: true,
        data: { valid: false, reason: 'Ticket not found' }
      });
    }

    // Verify ticket belongs to this module
    const session = Array.isArray(ticket.session) ? ticket.session[0] : ticket.session;

    // Check ticket status
    if (ticket.status === 'used') {
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
          ticketNumber: ticket.ticket_number,
          status: ticket.status,
          guestName: ticket.customer_name || 'Guest',
          sessionName: session?.name,
          entryTime: ticket.metadata?.entry_time,
          exitTime: ticket.metadata?.exit_time,
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

    if (!module || module.engine_type !== 'session_access') {
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

    if (!module || module.engine_type !== 'session_access') {
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

    if (!module || module.engine_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for capacity operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    const { data: sessions, error } = await supabase
      .from('capacity_windows')
      .select('id, name, max_capacity, start_time, end_time')
      .eq('module_id', module.id)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

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
          startTime: s.start_time,
          endTime: s.end_time,
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

    if (!module || module.engine_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('transactions')
      .select(`
        id, ticket_number, customer_name, customer_phone,
        status, payment_status, amount, created_at, metadata,
        session:capacity_windows!reference_id(id, name, start_time, end_time)
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
      data: (tickets || []).map(t => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        customerName: t.customer_name,
        customerPhone: t.customer_phone,
        guests: t.metadata?.number_of_guests,
        status: t.status,
        paymentStatus: t.payment_status,
        entryTime: t.metadata?.entry_time,
        exitTime: t.metadata?.exit_time,
        totalAmount: t.amount,
        sessionName: (Array.isArray(t.session) ? t.session[0] : t.session)?.name,
        sessionTime: `${(Array.isArray(t.session) ? t.session[0] : t.session)?.start_time} - ${(Array.isArray(t.session) ? t.session[0] : t.session)?.end_time}`,
      })),
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

    if (!module || module.engine_type !== 'session_access') {
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

    if (!module || module.engine_type !== 'session_access') {
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

    const rollupFinancialRows = (items: Array<{ customer_id: string; total_amount?: string | number; created_at?: string }> = []) => {
    items.forEach((row) => {
    const amount = Number(row.total_amount || 0);
    spendByCustomer[row.customer_id] = (spendByCustomer[row.customer_id] || 0) + amount;
    if (row.created_at) {
    const existing = recentOrderByCustomer[row.customer_id];
    if (!existing || new Date(row.created_at) > new Date(existing)) {
    recentOrderByCustomer[row.customer_id] = row.created_at;
    }
    }
    });
    };

    rollupFinancialRows((orderHistory.data as any[]) || []);

    ((entitlements.data as any[]) || []).forEach((m) => {
    if (!membershipByCustomer[m.customer_id]) membershipByCustomer[m.customer_id] = m.status || 'inactive';
    });
    ((loyaltyAccounts.data as any[]) || []).forEach((l) => {
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


