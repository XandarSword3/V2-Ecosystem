/**
 * Pool Tickets Controller
 * Handles ticket purchase, validation, and management
 */

import { Request, Response, NextFunction } from 'express';
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
 */
export async function purchaseTicket(req: Request, res: Response, next: NextFunction) {
  try {
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

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('pool_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      throw sessionError;
    }

    // Check availability
    const targetDate = dayjs(ticketDate).startOf('day').toISOString();
    const endOfDay = dayjs(ticketDate).endOf('day').toISOString();

    const { data: existingTickets, error: ticketsError } = await supabase
      .from('pool_tickets')
      .select('number_of_guests')
      .eq('session_id', sessionId)
      .gte('ticket_date', targetDate)
      .lte('ticket_date', endOfDay)
      .in('status', ['valid', 'used']);

    if (ticketsError) throw ticketsError;

    const soldGuests = (existingTickets || []).reduce((sum, t) => sum + t.number_of_guests, 0);
    if (soldGuests + numberOfGuests > session.max_capacity) {
      return res.status(400).json({
        success: false,
        error: 'Not enough capacity available',
        available: Math.max(0, session.max_capacity - soldGuests),
      });
    }

    // Calculate total
    const safeNumberOfAdults = typeof numberOfAdults === 'number' ? numberOfAdults : 0;
    const safeNumberOfChildren = typeof numberOfChildren === 'number' ? numberOfChildren : 0;
    let totalAmount = 0;
    if (session.adult_price !== undefined && session.child_price !== undefined) {
      totalAmount = (parseFloat(session.adult_price) * safeNumberOfAdults) + (parseFloat(session.child_price) * safeNumberOfChildren);
    } else {
      totalAmount = parseFloat(session.price) * numberOfGuests;
    }
    const ticketNumber = generateTicketNumber();

    // Generate QR code
    const qrData = JSON.stringify({
      ticketNumber,
      sessionId,
      date: ticketDate,
      guests: numberOfGuests,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .insert({
        ticket_number: ticketNumber,
        session_id: sessionId,
        module_id: session.module_id,
        customer_id: req.user?.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        ticket_date: targetDate,
        number_of_guests: numberOfGuests,
        total_amount: totalAmount.toFixed(2),
        status: 'valid',
        payment_status: 'pending',
        payment_method: paymentMethod,
        qr_code: qrCode,
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

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
        total: totalAmount 
      },
      ip_address: req.ip,
    });

    // Send ticket email
    if (customerEmail) {
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
  } catch (error) {
    next(error);
  }
}

/**
 * Get a ticket by ID
 */
export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user's tickets
 */
export async function getMyTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: tickets, error } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('customer_id', req.user!.userId)
      .order('ticket_date', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: tickets || [] });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a ticket
 */
export async function cancelTicket(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

/**
 * Validate a ticket (staff)
 */
export async function validateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { ticketNumber } = req.params;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .eq('ticket_number', ticketNumber)
      .single();

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
  } catch (error) {
    next(error);
  }
}

/**
 * Record pool entry
 */
export async function recordEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { ticketNumber } = req.params;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }
      throw ticketError;
    }

    if (ticket.status !== 'valid') {
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
  } catch (error) {
    next(error);
  }
}

/**
 * Record pool exit
 */
export async function recordExit(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { ticketNumber } = req.params;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();

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
  } catch (error) {
    next(error);
  }
}

/**
 * Get today's tickets (admin)
 */
export async function getTodayTickets(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}
