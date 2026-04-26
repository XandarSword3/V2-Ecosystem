/**
 * Pool Tickets Controller
 * Handles ticket purchase, validation, and management
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from "../../../database/connection.js";
import { emailService } from "../../../services/email.service.js";
import { purchasePoolTicketSchema, validateBody } from "../../../validation/schemas.js";
import { logger } from "../../../utils/logger.js";
import { logActivity } from "../../../utils/activityLogger.js";
import QRCode from 'qrcode';
import dayjs from 'dayjs';
import { emitToUnit } from "../../../socket/index.js";

function generateTicketNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P-${date}-${random}`;
}

/**
 * Purchase a pool ticket
 * Uses atomic RPC to prevent capacity over-sell race conditions.
 * The DB function locks the session row with FOR UPDATE, checks capacity,
 * and inserts the ticket in a single transaction.
 */
export const purchaseTicket = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validateBody(purchasePoolTicketSchema, req.body);

    const supabase = getSupabase();
    const {
      sessionId,
      ticketDate,
      customerName,
      customerEmail,
      customerPhone,
      numberOfGuests,
      paymentMethod,
      numberOfAdults,
      numberOfChildren,
    } = validatedData;

    const ticketNumber = generateTicketNumber();
    const targetDate = dayjs(ticketDate).startOf('day').toISOString();

    // Generate QR code before the atomic call (pure compute, no race risk)
    const qrData = JSON.stringify({
      ticketNumber,
      sessionId,
      date: ticketDate,
      guests: numberOfGuests,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Atomic capacity check + ticket insert via DB function
    // This locks the session row with FOR UPDATE to prevent concurrent over-sell
    const { data: result, error: rpcError } = await supabase.rpc(
      'purchase_pool_ticket_atomic',
      {
        p_session_id: sessionId,
        p_ticket_date: targetDate,
        p_ticket_number: ticketNumber,
        p_customer_id: req.user?.userId || null,
        p_customer_name: customerName,
        p_customer_phone: customerPhone || null,
        p_number_of_guests: numberOfGuests,
        p_number_of_adults: typeof numberOfAdults === 'number' ? numberOfAdults : 0,
        p_number_of_children: typeof numberOfChildren === 'number' ? numberOfChildren : 0,
        p_payment_method: paymentMethod,
        p_qr_code: qrCode,
      }
    );

    // Fallback removed - strictly use atomic function


    if (rpcError) {
      logger.error('[purchaseTicket] Atomic RPC error', { error: rpcError });
      throw rpcError;
    }

    const row = result?.[0] || result;
    if (!row?.success) {
      return res.status(400).json({
        success: false,
        error: row?.error_message || 'Failed to purchase ticket',
        available: row?.available_capacity ?? undefined,
      });
    }

    // Fetch the created ticket for the response
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', row.ticket_id)
      .single();

    if (ticketError) throw ticketError;

    // Fetch session info for email (lightweight query, no race risk)
    const { data: session } = await supabase
      .from('pool_sessions')
      .select('name, start_time, end_time')
      .eq('id', sessionId)
      .single();

    emitToUnit('pool', 'pool:ticket:new', {
      ...ticket,
      sessionId: ticket.session_id,
      ticketDate: ticket.ticket_date,
    });

    logActivity({
      user_id: req.user?.userId || 'guest',
      action: 'ticket_purchased',
      resource: 'pool_ticket',
      resource_id: ticket.id,
      new_value: { 
        ticket_number: ticketNumber, 
        session_id: sessionId, 
        guests: numberOfGuests,
        total: ticket.total_amount 
      },
      ip_address: req.ip,
    });

    // Send ticket email
    if (customerEmail && session) {
      emailService.sendTicketWithQR({
        customerEmail,
        customerName,
        ticketNumber: ticket.ticket_number,
        sessionName: session.name,
        ticketDate: dayjs(ticketDate).format('MMMM D, YYYY'),
        sessionTime: `${session.start_time} - ${session.end_time}`,
        numberOfGuests,
        qrCodeDataUrl: qrCode,
      }).catch((err) => {
        logger.warn('Failed to send ticket email:', err);
      });
    }

    res.status(201).json({ success: true, data: ticket });
});

/**
 * Get a ticket by ID
 */
export const getTicket = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }
      throw ticketError;
    }

    // Security check
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = ticket.customer_id === userId;
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');
    const isGuestTicket = !ticket.customer_id;

    if (!isOwner && !isAdminOrStaff && !isGuestTicket) {
      return res.json({
        success: true,
        data: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          status: ticket.status,
          ticket_date: ticket.ticket_date
        }
      });
    }

    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('pool_sessions')
      .select('*')
      .eq('id', ticket.session_id)
      .single();

    if (sessionError) throw sessionError;

    res.json({ success: true, data: { ...ticket, session } });
});

/**
 * Get current user's tickets
 */
export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: tickets, error } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('customer_id', req.user!.userId)
      .order('ticket_date', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: tickets || [] });
});

/**
 * Cancel a ticket
 */
export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { reason } = req.body;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }
      throw ticketError;
    }

    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = ticket.customer_id === userId;
    const isAdminOrStaff = userRoles.some(role => 
      ['admin', 'super_admin', 'pool_admin', 'pool_staff', 'staff'].includes(role)
    );

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this ticket' });
    }

    if (ticket.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Ticket is already cancelled' });
    }

    if (ticket.status === 'used' || ticket.entry_time) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel a ticket that has already been used' 
      });
    }

    const today = dayjs().startOf('day');
    const ticketDay = dayjs(ticket.ticket_date).startOf('day');
    if (ticketDay.isBefore(today)) {
      return res.status(400).json({ success: false, error: 'Cannot cancel a ticket for a past date' });
    }

    const { data: cancelledTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || null,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    emitToUnit('pool', 'pool:ticket:cancelled', {
      ticketId: ticket.id,
      sessionId: ticket.session_id,
      ticketDate: ticket.ticket_date,
      guestsFreed: ticket.number_of_guests,
    });

    logActivity({
      user_id: userId || 'system',
      action: 'ticket_cancelled',
      resource: 'pool_ticket',
      resource_id: id,
      new_value: { reason },
      ip_address: req.ip,
    });

    res.json({ success: true, data: cancelledTicket });
});

/**
 * Validate a ticket (staff)
 */
export const validateTicket = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { ticketNumber } = req.body;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketNumber);
    let query = supabase.from('pool_tickets').select('*, pool_sessions(*)');
    
    if (isUuid) {
        query = query.eq('id', ticketNumber);
    } else {
        query = query.eq('ticket_number', ticketNumber);
    }

    const { data: ticket, error: ticketError } = await query.single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Ticket not found',
          validation: { isValid: false, reason: 'TICKET_NOT_FOUND' }
        });
      }
      throw ticketError;
    }

    // Validation checks
    const today = dayjs().startOf('day');
    const ticketDay = dayjs(ticket.ticket_date).startOf('day');

    if (ticket.status === 'cancelled') {
      return res.json({
        success: true,
        data: ticket,
        validation: { isValid: false, reason: 'TICKET_CANCELLED' }
      });
    }

    if (ticket.status === 'used') {
      return res.json({
        success: true,
        data: ticket,
        validation: { isValid: false, reason: 'TICKET_ALREADY_USED' }
      });
    }

    if (!ticketDay.isSame(today, 'day')) {
      return res.json({
        success: true,
        data: ticket,
        validation: { 
          isValid: false, 
          reason: ticketDay.isBefore(today) ? 'TICKET_EXPIRED' : 'TICKET_NOT_YET_VALID'
        }
      });
    }

    res.json({
      success: true,
      data: ticket,
      validation: { isValid: true, reason: 'VALID' }
    });
});

/**
 * Staff sell ticket for walk-in guests
 */
export const createStaffTicket = asyncHandler(async (req: Request, res: Response) => {
    const {
      session_id,
      ticket_type,
      customer_id,
      customer_name,
      customer_phone,
      payment_method,
      quantity,
    } = req.body as {
      session_id: string;
      ticket_type?: 'adult' | 'child' | 'family' | 'VIP';
      customer_id?: string;
      customer_name?: string;
      customer_phone?: string;
      payment_method?: 'cash' | 'card' | 'comp';
      quantity: number;
    };

    if (!session_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, error: 'session_id and valid quantity are required' });
    }

    const supabase = getSupabase();
    const { data: session, error: sessionError } = await supabase
      .from('pool_sessions')
      .select('*')
      .eq('id', session_id)
      .single();
    if (sessionError || !session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();
    const { data: existingTickets, error: ticketsError } = await supabase
      .from('pool_tickets')
      .select('number_of_guests')
      .eq('session_id', session_id)
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .in('status', ['valid', 'used', 'active']);
    if (ticketsError) throw ticketsError;

    const soldGuests = (existingTickets || []).reduce((sum, row) => sum + Number(row.number_of_guests || 0), 0);
    if (soldGuests + quantity > Number(session.max_capacity || 0)) {
      return res.status(400).json({
        success: false,
        error: 'Not enough capacity available',
        available: Math.max(0, Number(session.max_capacity || 0) - soldGuests),
      });
    }

    const unitPrice = ticket_type === 'child'
      ? parseFloat(session.child_price ?? session.price)
      : parseFloat(session.adult_price ?? session.price);
    const totalAmount = unitPrice * quantity;
    const ticketNumber = generateTicketNumber();
    const qrCode = await QRCode.toDataURL(JSON.stringify({
      type: 'pool_ticket',
      id: ticketNumber,
      sessionId: session_id,
      quantity,
    }));

    const { data: ticket, error: insertError } = await supabase
      .from('pool_tickets')
      .insert({
        ticket_number: ticketNumber,
        session_id,
        module_id: session.module_id,
        customer_id: customer_id || req.user?.userId || null,
        customer_name: customer_name || 'Walk-in Guest',
        customer_phone: customer_phone || null,
        ticket_date: today,
        number_of_guests: quantity,
        total_amount: totalAmount.toFixed(2),
        status: 'valid',
        payment_status: payment_method === 'comp' ? 'paid' : 'pending',
        payment_method: payment_method || 'cash',
        qr_code: qrCode,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    emitToUnit('pool', 'pool:ticket:new', {
      ...ticket,
      sessionId: ticket.session_id,
      ticketDate: ticket.ticket_date,
    });

    res.status(201).json({ success: true, data: ticket });
});

/**
 * Record pool entry
 */
export const recordEntry = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const ticketNumber = req.params.id;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketNumber);
    let query = supabase.from('pool_tickets').select('*');
    
    if (isUuid) {
        query = query.eq('id', ticketNumber);
    } else {
        query = query.eq('ticket_number', ticketNumber);
    }

    const { data: ticket, error: ticketError } = await query.single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }
      throw ticketError;
    }

    // Allow entry for valid tickets. If status is already used, check if we need to re-admit?
    // The test expects 'active' or 'checked_in' status logic, but schema only has 'valid' | 'used'.
    // If ticket is 'valid', we mark it 'used' (entered).
    // If ticket is 'used' AND has entry_time but NO exit_time, they are arguably 'active'.
    // Use 'used' as the DB status, but we might need to interpret this.

    if (ticket.status !== 'valid' && !(ticket.status === 'used' && ticket.entry_time && !ticket.exit_time)) {
       // If it is 'used' and they are inside (no exit time), maybe we are just updating?
       // But strictly for checking in:
       if (ticket.status === 'used') {
           return res.status(400).json({ success: false, error: 'Ticket already used' });
       }
       return res.status(400).json({ 
        success: false, 
        error: `Cannot record entry for ticket with status: ${ticket.status}` 
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'used',
        entry_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) throw updateError;

    emitToUnit('pool', 'pool:entry', {
      ticketId: ticket.id,
      sessionId: ticket.session_id,
      guests: ticket.number_of_guests,
    });

    res.json({ success: true, data: updated });
});

/**
 * Record pool exit
 */
export const recordExit = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const ticketNumber = req.params.id;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketNumber);
    let query = supabase.from('pool_tickets').select('*');
    
    if (isUuid) {
        query = query.eq('id', ticketNumber);
    } else {
        query = query.eq('ticket_number', ticketNumber);
    }

    const { data: ticket, error: ticketError } = await query.single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
         return res.status(404).json({ success: false, error: 'Ticket not found' });
      }
      throw ticketError;
    }

    if (!ticket.entry_time) {
      return res.status(400).json({ success: false, error: 'No entry recorded for this ticket' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        exit_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) throw updateError;

    emitToUnit('pool', 'pool:exit', {
      ticketId: ticket.id,
      sessionId: ticket.session_id,
      guests: ticket.number_of_guests,
    });

    res.json({ success: true, data: updated });
});

/**
 * Get today's tickets (admin)
 */
export const getTodayTickets = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: tickets, error } = await supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: tickets || [] });
});
