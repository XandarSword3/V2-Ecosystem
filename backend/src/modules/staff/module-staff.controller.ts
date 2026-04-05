import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

/**
 * Dynamic Module Staff Controller
 * Handles staff operations for any module type based on slug
 * This replaces hardcoded /restaurant/staff/orders, /chalets/staff/bookings etc
 * 
 * TABLE MAPPINGS (actual DB table names):
 *  - menu_service orders → restaurant_orders / restaurant_order_items / menu_items
 *  - multi_day_booking → chalet_bookings / chalets
 *  - session_access → pool_sessions / pool_tickets
 */

// ============================================
// ORDERS (for menu_service modules)
// ============================================

/**
 * Get orders for a module by slug
 * Works for: restaurant, snack_bar, any menu_service module
 */
export async function getModuleOrders(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { status, moduleId, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // First, get the module by slug to verify it's a menu_service type
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.template_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Module is not a menu service' });
    }

    // Build query for orders — actual table is restaurant_orders (shared across all menu_service modules)
    let query = supabase
      .from('restaurant_orders')
      .select(`
        id, order_number, customer_id, order_type, status, total_amount,
        table_id, special_instructions, created_at,
        customer:users!customer_id(id, full_name),
        items:restaurant_order_items(id, quantity, unit_price, special_instructions, menu_items(id, name))
      `)
      .eq('module_id', moduleId || module.id)
      .is('deleted_at', null);

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
      customerName: (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.full_name || 'Guest',
      customerId: order.customer_id,
      orderType: order.order_type,
      status: order.status,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        name: item.menu_items?.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        specialInstructions: item.special_instructions,
      })),
      totalAmount: order.total_amount,
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'menu_service') {
      return res.status(400).json({ success: false, error: 'Invalid module for order operations' });
    }

    // Valid status transitions
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Update the order — actual table is restaurant_orders
    // Columns: completed_at, cancelled_at exist; actual_ready_time for ready; estimated_ready_time for preparing
    const { data: order, error } = await supabase
      .from('restaurant_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'preparing' ? { estimated_ready_time: new Date(Date.now() + 20 * 60000).toISOString() } : {}),
        ...(status === 'ready' ? { actual_ready_time: new Date().toISOString() } : {}),
        ...(status === 'served' ? { served_at: new Date().toISOString() } : {}),
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

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
 * Works for: chalets, villas, any multi_day_booking module
 */
export async function getModuleBookings(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { moduleId, date, status, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // Get the module
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.template_type !== 'multi_day_booking') {
      return res.status(400).json({ success: false, error: 'Module is not a booking service' });
    }

    // Build query — actual table is chalet_bookings
    let query = supabase
      .from('chalet_bookings')
      .select(`
        id, booking_number, customer_id, chalet_id, check_in_date, check_out_date, status,
        total_amount, number_of_guests, special_requests, created_at, customer_name, customer_email,
        chalet:chalets!chalet_id(id, name, capacity),
        user:users!customer_id(id, full_name, email, phone)
      `);

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
    const transformedBookings = (bookings || []).map(booking => ({
      id: booking.id,
      bookingNumber: booking.booking_number,
      guestName: booking.customer_name || (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.full_name || 'Guest',
      guestEmail: booking.customer_email || (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.email,
      guestPhone: (Array.isArray((booking as any).user) ? (booking as any).user[0] : (booking as any).user)?.phone,
      unitId: booking.chalet_id,
      unitName: (Array.isArray((booking as any).chalet) ? (booking as any).chalet[0] : (booking as any).chalet)?.name || 'Unit',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      status: booking.status,
      totalPrice: (booking as any).total_amount,
      guestCount: (booking as any).number_of_guests,
      specialRequests: booking.special_requests,
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'multi_day_booking') {
      return res.status(400).json({ success: false, error: 'Invalid module for booking operations' });
    }

    // Valid statuses
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Get current booking — actual table is chalet_bookings
    const { data: currentBooking } = await supabase
      .from('chalet_bookings')
      .select('status, chalet_id, booking_number')
      .eq('id', bookingId)
      .single();

    // Update booking
    const { data: booking, error } = await supabase
      .from('chalet_bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'checked_in' ? { actual_check_in: new Date().toISOString() } : {}),
        ...(status === 'checked_out' ? { actual_check_out: new Date().toISOString() } : {}),
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw error;

    // If checked out, trigger housekeeping
    if (status === 'checked_out' && currentBooking?.chalet_id) {
      // This will be handled by a database trigger or can be called here
      try {
        await supabase.from('housekeeping_tasks').insert({
          chalet_id: currentBooking.chalet_id,
          task_type: 'turnover',
          priority: 'high',
          status: 'pending',
          notes: `Auto-generated from checkout. Booking #${booking.booking_number}`,
          booking_id: bookingId,
        });

        await supabase.from('chalets').update({
          cleaning_status: 'dirty',
          updated_at: new Date().toISOString(),
        }).eq('id', currentBooking.chalet_id);
      } catch (hkError) {
        logger.error('Error creating housekeeping task:', hkError);
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
 * Works for: pool, spa, any session_access module
 */
export async function getModuleSessions(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    const { date, page = '1', limit = '50' } = req.query;
    const supabase = getSupabase();

    // Get the module
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (moduleError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    if (module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Module is not a session access service' });
    }

    // Get sessions for today or specified date
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Actual table is pool_sessions / pool_tickets
    const { data: sessions, error } = await supabase
      .from('pool_sessions')
      .select(`
        id, name, start_time, end_time, capacity, current_count, status,
        tickets:pool_tickets(id, ticket_number, status, user_id, user:users!user_id(full_name))
      `)
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket validation' });
    }

    // Find the ticket — actual table is pool_tickets
    const { data: ticket, error } = await supabase
      .from('pool_tickets')
      .select(`
        id, ticket_number, status, customer_id, customer_name, session_id, entry_time, exit_time,
        session:pool_sessions!session_id(id, name, max_capacity)
      `)
      .eq('ticket_number', ticketNumber)
      .single();

    if (error || !ticket) {
      return res.json({
        success: true,
        data: { valid: false, reason: 'Ticket not found' }
      });
    }

    // Verify ticket belongs to this module (pool_sessions may not have module_id)
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
          entryTime: ticket.entry_time,
          exitTime: ticket.exit_time,
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for entry operations' });
    }

    // Update ticket with entry time
    const { data: ticket, error } = await supabase
      .from('pool_tickets')
      .update({
        entry_time: new Date().toISOString(),
        status: 'used',
      })
      .eq('id', ticketId)
      .select('*, session:pool_sessions!session_id(id, name)')
      .single();

    if (error) throw error;

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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for exit operations' });
    }

    // Update ticket with exit time
    const { data: ticket, error } = await supabase
      .from('pool_tickets')
      .update({
        exit_time: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select('*, session:pool_sessions!session_id(id, name)')
      .single();

    if (error) throw error;

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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for capacity operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    const { data: sessions, error } = await supabase
      .from('pool_sessions')
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for ticket operations' });
    }

    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('pool_tickets')
      .select(`
        id, ticket_number, customer_name, customer_phone, number_of_guests,
        status, payment_status, entry_time, exit_time, total_amount,
        session:pool_sessions!session_id(id, name, start_time, end_time)
      `)
      .eq('module_id', module.id)
      .eq('ticket_date', targetDate)
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
        guests: t.number_of_guests,
        status: t.status,
        paymentStatus: t.payment_status,
        entryTime: t.entry_time,
        exitTime: t.exit_time,
        totalAmount: t.total_amount,
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for maintenance operations' });
    }

    const { data: logs, error } = await supabase
      .from('pool_maintenance_logs')
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
      .select('id, template_type')
      .eq('slug', slug)
      .single();

    if (!module || module.template_type !== 'session_access') {
      return res.status(400).json({ success: false, error: 'Invalid module for maintenance operations' });
    }

    const { data: log, error } = await supabase
      .from('pool_maintenance_logs')
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


