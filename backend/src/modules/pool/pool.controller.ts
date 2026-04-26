import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection.js";
import { emailService } from "../../services/email.service.js";
import { purchasePoolTicketSchema, validateBody } from "../../validation/schemas.js";
import { logger } from "../../utils/logger.js";
import { logActivity } from "../../utils/activityLogger.js";
import QRCode from 'qrcode';
import { config } from "../../config/index.js";
import dayjs from 'dayjs';
import { emitToUnit } from "../../socket/index.js";
import { PoolSessionRow } from "../../types/index.js";
import { getEngineService } from '../../engines/engine-service.js';
import type { PricingLineItem, PricingContext } from '../../engines/types.js';

function generateTicketNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P-${date}-${random}`;
}

// Extended session type with optional price fields
interface PoolSessionWithPrices extends PoolSessionRow {
  adult_price?: string | number | null;
  child_price?: string | number | null;
}

// ============================================
// Public Routes
// ============================================

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { moduleId, gender } = req.query;

        let query = supabase
          .from('pool_sessions')
          .select('*')
          .eq('is_active', true);

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    // Filter by gender restriction if specified
    if (gender && ['male', 'female'].includes(gender as string)) {
      query = query.or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`);
    }

        const { data: sessions, error } = await query;
        if (error) throw error;
        // Normalize price fields for frontend compatibility
        const sessionsWithPrices = (sessions || []).map((s: PoolSessionWithPrices) => ({
          ...s,
          adult_price: s.adult_price ?? s.price ?? 0,
          child_price: s.child_price ?? s.price ?? 0,
          genderRestriction: (s as unknown as Record<string, unknown>).gender_restriction || 'mixed',
        }));
        res.json({ success: true, data: sessionsWithPrices });
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from('pool_sessions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      throw error;
    }
    // Normalize price fields for frontend compatibility
    const sessionWithPrices = session ? {
      ...session,
      adult_price: session.adult_price ?? session.price ?? 0,
      child_price: session.child_price ?? session.price ?? 0,
      genderRestriction: session.gender_restriction || 'mixed',
    } : null;
    res.json({ success: true, data: sessionWithPrices });
});

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { date, sessionId, moduleId, gender } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, error: 'date required' });
    }

    const targetDate = dayjs(date as string).startOf('day').toISOString();
    const endOfDay = dayjs(date as string).endOf('day').toISOString();

    // Get all sessions
    let sessionsQuery = supabase
      .from('pool_sessions')
      .select('*')
      .eq('is_active', true);

    if (moduleId) {
      sessionsQuery = sessionsQuery.eq('module_id', moduleId);
    }

    // Filter by gender restriction if specified
    // If gender is 'male', show sessions with 'mixed' or 'male' restriction
    // If gender is 'female', show sessions with 'mixed' or 'female' restriction
    if (gender && ['male', 'female'].includes(gender as string)) {
      sessionsQuery = sessionsQuery.or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) throw sessionsError;

    // Get sold tickets for the date
    const { data: tickets, error: ticketsError } = await supabase
      .from('pool_tickets')
      .select('*')
      .gte('ticket_date', targetDate)
      .lte('ticket_date', endOfDay)
      .eq('status', 'valid');

    if (ticketsError) throw ticketsError;

    // Calculate availability per session
    const availability = (sessions || []).map(session => {
      const sessionTickets = (tickets || []).filter(t => t.session_id === session.id);
      const soldGuests = sessionTickets.reduce((sum, t) => sum + t.number_of_guests, 0);
      const available = session.max_capacity - soldGuests;

      return {
        sessionId: session.id,
        sessionName: session.name,
        startTime: session.start_time,
        endTime: session.end_time,
        maxCapacity: session.max_capacity,
        sold: soldGuests,
        available: Math.max(0, available),
        adult_price: session.adult_price ?? session.price ?? 0,
        child_price: session.child_price ?? session.price ?? 0,
        genderRestriction: session.gender_restriction || 'mixed',
      };
    });

    if (sessionId) {
      const filtered = availability.find(a => a.sessionId === sessionId);
      return res.json({ success: true, data: filtered });
    }

    res.json({ success: true, data: availability });
});

// ============================================
// Customer Routes
// ============================================

export const purchaseTicket = asyncHandler(async (req: Request, res: Response) => {
    // Validate input
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
      .in('status', ['valid', 'used']); // All booked spots count against total session capacity

    if (ticketsError) throw ticketsError;

    const soldGuests = (existingTickets || []).reduce((sum, t) => sum + t.number_of_guests, 0);
    if (soldGuests + numberOfGuests > session.max_capacity) {
      return res.status(400).json({
        success: false,
        error: 'Not enough capacity available',
        available: Math.max(0, session.max_capacity - soldGuests),
      });
    }

    // === ENGINE-POWERED PRICING (Engine C: shared_capacity_access) ===
    const safeNumberOfAdults = typeof numberOfAdults === 'number' ? numberOfAdults : 0;
    const safeNumberOfChildren = typeof numberOfChildren === 'number' ? numberOfChildren : 0;
    
    const engineService = getEngineService();
    const pricingLineItems: PricingLineItem[] = [];
    
    if (session.adult_price !== undefined && session.child_price !== undefined) {
      if (safeNumberOfAdults > 0) {
        pricingLineItems.push({
          name: 'Adult Ticket',
          unitPrice: parseFloat(session.adult_price),
          quantity: safeNumberOfAdults,
        });
      }
      if (safeNumberOfChildren > 0) {
        pricingLineItems.push({
          name: 'Child Ticket',
          unitPrice: parseFloat(session.child_price),
          quantity: safeNumberOfChildren,
        });
      }
    } else {
      pricingLineItems.push({
        name: 'General Ticket',
        unitPrice: parseFloat(session.price),
        quantity: numberOfGuests,
      });
    }

    const pricing = await engineService.calculatePricing('session_access', pricingLineItems, {});
    const totalAmount = pricing.totalAmount;
    const ticketNumber = generateTicketNumber();

    // Use engine initial state
    const initialState = engineService.getInitialState('session_access');

    // Generate QR code
    const qrData = JSON.stringify({
      type: 'pool_ticket',
      id: ticketNumber,
      sessionId,
      date: ticketDate,
      guests: numberOfGuests,
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Create ticket (using engine initial state)
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
        subtotal: pricing.subtotal.toFixed(2),
        tax_amount: pricing.taxAmount.toFixed(2),
        status: initialState,
        payment_status: paymentMethod === 'cash' ? 'pending' : 'pending',
        payment_method: paymentMethod,
        qr_code: qrCode,
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Emit socket event for real-time capacity updates
    emitToUnit('pool', 'pool:ticket:new', {
      ...ticket,
      sessionId: ticket.session_id,
      ticketDate: ticket.ticket_date,
    });

    // Audit log for ticket purchase
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

    // Send ticket email with QR code
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
});

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

    // Security: Only ticket owner or admin/staff can view full ticket details
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = ticket.customer_id === userId;
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');
    const isGuestTicket = !ticket.customer_id; // Allow guest tickets (no owner)

    if (!isOwner && !isAdminOrStaff && !isGuestTicket) {
      // For non-owners, only return limited info (validation status)
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

export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { reason } = req.body;

    // Fetch the ticket
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

    // Check ownership or admin permission
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const isOwner = ticket.customer_id === userId;
    const isAdminOrStaff = userRoles.some(role => 
      ['admin', 'super_admin', 'pool_admin', 'pool_staff', 'staff'].includes(role)
    );

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this ticket' });
    }

    // === ENGINE-POWERED STATE TRANSITION (Engine C: shared_capacity_access) ===
    // Use state machine to validate cancellation instead of ad-hoc checks
    const engineService = getEngineService();
    const actor = req.user?.roles?.some((role: string) => 
      ['admin', 'super_admin', 'pool_admin', 'pool_staff', 'staff'].includes(role)
    ) ? 'staff' : 'customer';

    const transitionResult = await engineService.transitionState(
      'session_access',
      ticket.status,
      'cancel',
      actor
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({
        success: false,
        error: transitionResult.error || `Cannot cancel ticket with status ${ticket.status}`,
      });
    }

    // Cancel the ticket
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

    // Emit socket event for real-time capacity updates
    emitToUnit('pool', 'pool:ticket:cancelled', {
      ticketId: ticket.id,
      sessionId: ticket.session_id,
      ticketDate: ticket.ticket_date,
      numberOfGuests: ticket.number_of_guests,
    });

    // Audit log
    logActivity({
      user_id: userId || 'system',
      action: 'ticket_cancelled',
      resource: 'pool_ticket',
      resource_id: ticket.id,
      old_value: { status: ticket.status },
      new_value: { status: 'cancelled', reason },
      ip_address: req.ip,
    });

    res.json({ 
      success: true, 
      data: cancelledTicket,
      message: 'Ticket cancelled successfully',
    });
});

// ============================================
// Staff Routes
// ============================================

export const validateTicket = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { ticketNumber, qrData } = req.body;

    let ticketId: string | undefined;

    if (ticketNumber) {
      const { data: ticket, error } = await supabase
        .from('pool_tickets')
        .select('id')
        .eq('ticket_number', ticketNumber)
        .single();

      if (!error) ticketId = ticket?.id;
    } else if (qrData) {
      try {
        const parsed = JSON.parse(qrData);
        const lookupId = parsed.id || parsed.ticketNumber;
        const { data: ticket, error } = await supabase
          .from('pool_tickets')
          .select('id')
          .eq('ticket_number', lookupId)
          .single();

        if (!error) ticketId = ticket?.id;
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid QR code' });
      }
    }

    if (!ticketId) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Validate ticket
    // Check if ticket is already used (has exit_time) or currently in pool (has entry_time but no exit_time)
    if (ticket.status === 'used') {
      return res.status(400).json({
        success: false,
        error: 'Ticket already used',
        validatedAt: ticket.validated_at,
      });
    }
    
    // Check if guest is currently in pool (entered but not exited)
    if (ticket.entry_time && !ticket.exit_time) {
      return res.status(400).json({
        success: false,
        error: 'Guest is currently in the pool. Record exit first.',
        entryTime: ticket.entry_time,
      });
    }

    if (ticket.status === 'expired' || ticket.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: `Ticket is ${ticket.status}`,
      });
    }

    // Check if ticket is for today
    // Compare dates in local timezone - the ticket_date stores midnight UTC for the booking day
    // Add 2 hours to the UTC time to get Lebanon timezone (UTC+2), then compare dates
    const today = dayjs().format('YYYY-MM-DD');
    const ticketDay = dayjs(ticket.ticket_date).add(2, 'hour').format('YYYY-MM-DD');
    if (ticketDay !== today) {
      return res.status(400).json({
        success: false,
        error: 'Ticket is not valid for today',
        ticketDate: ticket.ticket_date,
      });
    }

    // Mark as used (Entered) - status stays 'valid' but with entry_time recorded
    // The ticket is still valid and tracks entry/exit via timestamps
    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        validated_at: new Date().toISOString(),
        validated_by: req.user!.userId,
        entry_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Emit entry event
    emitToUnit('pool', 'pool:entry', { ticketId: ticket.id });
    emitToUnit('pool', 'pool:ticket:updated', updatedTicket);

    res.json({
      success: true,
      data: updatedTicket,
      message: `Valid! ${ticket.number_of_guests} guest(s) admitted.`,
    });
});

export const recordEntry = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // === ENGINE-POWERED STATE TRANSITION (Engine C: shared_capacity_access) ===
    const engineService = getEngineService();
    const transitionResult = await engineService.transitionState(
      'session_access',
      ticket.status,
      'validate_entry',
      'staff'
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({
        success: false,
        error: transitionResult.error || `Cannot enter from status ${ticket.status}`,
      });
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: transitionResult.targetState,
        entry_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    emitToUnit('pool', 'pool:entry', { ticketId: id });
    emitToUnit('pool', 'pool:ticket:updated', updatedTicket);

    res.json({ success: true, data: updatedTicket });
});

export const recordExit = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // === ENGINE-POWERED STATE TRANSITION (Engine C: shared_capacity_access) ===
    // FIX: Previously had NO validation — could record exit for tickets that never entered.
    // Engine C state machine enforces: only 'active' tickets can exit (valid→active→used).
    const engineService = getEngineService();
    const transitionResult = await engineService.transitionState(
      'session_access',
      ticket.status,
      'record_exit',
      'staff'
    );

    if (!transitionResult.allowed) {
      return res.status(400).json({
        success: false,
        error: transitionResult.error || `Cannot exit from status ${ticket.status}`,
      });
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: transitionResult.targetState,
        exit_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    emitToUnit('pool', 'pool:exit', { ticketId: id });
    emitToUnit('pool', 'pool:ticket:updated', updatedTicket);

    res.json({ success: true, data: updatedTicket });
});

export const getCurrentCapacity = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: sessions, error: sessionsError } = await supabase
      .from('pool_sessions')
      .select('*')
      .eq('is_active', true);

    if (sessionsError) throw sessionsError;

    const { data: tickets, error: ticketsError } = await supabase
      .from('pool_tickets')
      .select('*')
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay);

    if (ticketsError) throw ticketsError;

    const capacity = (sessions || []).map(session => {
      const sessionTickets = (tickets || []).filter(t => t.session_id === session.id);
      const validTickets = sessionTickets.filter(t => t.status === 'valid');
      const activeTickets = sessionTickets.filter(t => t.status === 'active');
      const usedTickets = sessionTickets.filter(t => t.status === 'used');

      const pendingGuests = validTickets.reduce((sum, t) => sum + t.number_of_guests, 0);
      const activeGuests = activeTickets.reduce((sum, t) => sum + t.number_of_guests, 0);
      const usedGuests = usedTickets.reduce((sum, t) => sum + t.number_of_guests, 0);

      const admittedGuests = activeGuests + usedGuests;

      return {
        sessionId: session.id,
        sessionName: session.name,
        startTime: session.start_time,
        endTime: session.end_time,
        maxCapacity: session.max_capacity,
        sold: pendingGuests + admittedGuests,
        admitted: admittedGuests,
        pending: pendingGuests,
        available: session.max_capacity - pendingGuests - admittedGuests,
      };
    });

    const totalAdmitted = capacity.reduce((sum, c) => sum + c.admitted, 0);

    res.json({
      success: true,
      data: {
        sessions: capacity,
        totalAdmitted,
      },
    });
});

export const getTodayTickets = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: tickets, error } = await supabase
      .from('pool_tickets')
      .select('*, users:customer_id(full_name, email)')
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: tickets || [] });
});

// ============================================
// Admin Routes
// ============================================

export const createSession = asyncHandler(async (req: Request, res: Response) => {
    // Support both camelCase and snake_case field names from frontend
    const name = req.body.name;
    const startTime = req.body.startTime || req.body.start_time;
    const endTime = req.body.endTime || req.body.end_time;
    const maxCapacity = req.body.maxCapacity ?? req.body.max_capacity;
    const moduleId = req.body.moduleId || req.body.module_id;
    const adult_price = req.body.adult_price;
    const child_price = req.body.child_price;
    const genderRestriction = req.body.genderRestriction || req.body.gender_restriction;

    // Validate required fields
    if (!name || !startTime || !endTime || maxCapacity === undefined || adult_price === undefined || child_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, startTime, endTime, maxCapacity, adult_price, child_price'
      });
    }

    // Validate genderRestriction if provided
    if (genderRestriction && !['mixed', 'male', 'female'].includes(genderRestriction)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid genderRestriction. Must be one of: mixed, male, female'
      });
    }

    const supabase = getSupabase();
    
    // Use RPC function to bypass PostgREST schema cache issues
    const { data: session, error: rpcError } = await supabase.rpc('insert_pool_session', {
      p_name: name,
      p_start_time: startTime,
      p_end_time: endTime,
      p_max_capacity: Number(maxCapacity),
      p_adult_price: Number(adult_price),
      p_child_price: Number(child_price),
      p_gender_restriction: genderRestriction || 'mixed',
      p_module_id: moduleId || null,
    });

    if (rpcError) {
      logger.error('Pool session creation error:', JSON.stringify(rpcError));
      return res.status(500).json({ success: false, message: rpcError.message, details: rpcError.details, hint: rpcError.hint, code: rpcError.code });
    }

    res.status(201).json({ success: true, data: session });
});

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.startTime !== undefined) updateData.start_time = req.body.startTime;
    if (req.body.endTime !== undefined) updateData.end_time = req.body.endTime;
    if (req.body.maxCapacity !== undefined) updateData.max_capacity = req.body.maxCapacity;
    if (req.body.adult_price !== undefined) updateData.adult_price = req.body.adult_price.toString();
    if (req.body.child_price !== undefined) updateData.child_price = req.body.child_price.toString();
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;
    if (req.body.genderRestriction !== undefined) {
      // Validate gender restriction value
      if (!['mixed', 'male', 'female'].includes(req.body.genderRestriction)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid genderRestriction. Must be one of: mixed, male, female'
        });
      }
      updateData.gender_restriction = req.body.genderRestriction;
    }

    const { data: session, error } = await supabase
      .from('pool_sessions')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: session });
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('pool_sessions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Session deleted' });
});

export const getDailyReport = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { date } = req.query;
    const targetDate = date ? dayjs(date as string) : dayjs();
    const startOfDay = targetDate.startOf('day').toISOString();
    const endOfDay = targetDate.endOf('day').toISOString();

    const { data: tickets, error } = await supabase
      .from('pool_tickets')
      .select('*')
      .gte('ticket_date', startOfDay)
      .lte('ticket_date', endOfDay);

    if (error) throw error;

    const allTickets = tickets || [];
    const validTickets = allTickets.filter(t => ['valid', 'used'].includes(t.status));
    const totalRevenue = validTickets.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
    const totalGuests = validTickets.reduce((sum, t) => sum + t.number_of_guests, 0);

    res.json({
      success: true,
      data: {
        date: targetDate.format('YYYY-MM-DD'),
        totalTickets: validTickets.length,
        totalGuests,
        totalRevenue,
        byStatus: {
          valid: allTickets.filter(t => t.status === 'valid').length,
          used: allTickets.filter(t => t.status === 'used').length,
          cancelled: allTickets.filter(t => t.status === 'cancelled').length,
        },
      },
    });
});

// ============================================
// Pool Settings
// ============================================

export const getPoolSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    // Get settings from site_settings table with pool category
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('category', 'pool');

    if (error) throw error;

    // Convert to object format
    const settingsObj: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsObj[s.key] = s.value;
    });

    // Default settings if none exist
    const defaultSettings = {
      maxCapacity: '100',
      ticketPrice: '15.00',
      childPrice: '10.00',
      operatingHours: 'Open 8:00 AM - 8:00 PM',
      isOpen: 'true',
      ...settingsObj,
    };

    res.json({ success: true, data: defaultSettings });
});

export const updatePoolSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const settings = req.body;

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      await supabase
        .from('site_settings')
        .upsert(
          {
            key,
            value: String(value),
            category: 'pool',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key,category' }
        );
    }

    res.json({ success: true, message: 'Pool settings updated' });
});

export const resetOccupancy = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    // Reset current occupancy to 0
    await supabase
      .from('site_settings')
      .upsert(
        {
          key: 'current_occupancy',
          value: '0',
          category: 'pool',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key,category' }
      );

    res.json({ success: true, message: 'Occupancy reset to 0' });
});

// ============================================
// Maintenance Logs
// ============================================

export const getMaintenanceLogs = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { moduleId } = req.query;

    let query = supabase
      .from('pool_maintenance_logs')
      .select('*, users:performed_by(full_name)')
      .order('created_at', { ascending: false });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data: logs, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: logs || [] });
});

export const createMaintenanceLog = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { type, readings, notes, moduleId } = req.body;

    const { data: log, error } = await supabase
      .from('pool_maintenance_logs')
      .insert({
        type,
        readings,
        notes,
        module_id: moduleId,
        performed_by: req.user!.userId
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data: log });
});

// ============================================
// Bracelet Management
// ============================================

/**
 * Assign a bracelet to a ticket
 */
export const assignBracelet = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { braceletNumber, braceletColor } = req.body;

    if (!braceletNumber) {
      return res.status(400).json({ success: false, error: 'braceletNumber is required' });
    }

    // Verify ticket exists and is valid
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (ticket.status !== 'valid' && ticket.status !== 'used') {
      return res.status(400).json({ success: false, error: 'Ticket is not valid for bracelet assignment' });
    }

    // Check if bracelet is already in use today
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: existingBracelet, error: braceletCheckError } = await supabase
      .from('pool_tickets')
      .select('id, customer_name')
      .eq('bracelet_number', braceletNumber)
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .is('bracelet_returned_at', null)
      .neq('id', id);

    if (braceletCheckError) throw braceletCheckError;

    if (existingBracelet && existingBracelet.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: `Bracelet ${braceletNumber} is already assigned to ${existingBracelet[0].customer_name}` 
      });
    }

    // Assign the bracelet
    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        bracelet_number: braceletNumber,
        bracelet_color: braceletColor || null,
        bracelet_assigned_at: new Date().toISOString(),
        bracelet_assigned_by: req.user!.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity({
      user_id: req.user!.userId,
      action: 'bracelet_assigned',
      resource: 'pool_ticket',
      resource_id: id,
    });

    logger.info(`Bracelet ${braceletNumber} assigned to ticket ${ticket.ticket_number}`);
    res.json({ success: true, data: updatedTicket });
});

/**
 * Return a bracelet (mark as returned)
 */
export const returnBracelet = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    // Verify ticket exists and has a bracelet assigned
    const { data: ticket, error: ticketError } = await supabase
      .from('pool_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (!ticket.bracelet_number) {
      return res.status(400).json({ success: false, error: 'No bracelet assigned to this ticket' });
    }

    if (ticket.bracelet_returned_at) {
      return res.status(400).json({ success: false, error: 'Bracelet has already been returned' });
    }

    // Mark bracelet as returned
    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        bracelet_returned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity({
      user_id: req.user!.userId,
      action: 'bracelet_returned',
      resource: 'pool_ticket',
      resource_id: id,
    });

    logger.info(`Bracelet ${ticket.bracelet_number} returned for ticket ${ticket.ticket_number}`);
    res.json({ success: true, data: updatedTicket });
});

/**
 * Get all active bracelets (assigned but not returned) for today
 */
export const getActiveBracelets = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: bracelets, error } = await supabase
      .from('pool_tickets')
      .select(`
        id,
        ticket_number,
        customer_name,
        number_of_guests,
        bracelet_number,
        bracelet_color,
        bracelet_assigned_at,
        pool_sessions (name, start_time, end_time)
      `)
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .not('bracelet_number', 'is', null)
      .is('bracelet_returned_at', null)
      .order('bracelet_assigned_at', { ascending: false });

    if (error) throw error;

    res.json({ 
      success: true, 
      data: bracelets,
      count: bracelets?.length || 0
    });
});

/**
 * Search for a ticket by bracelet number
 */
export const searchByBracelet = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { braceletNumber } = req.query;

    if (!braceletNumber) {
      return res.status(400).json({ success: false, error: 'braceletNumber query parameter is required' });
    }

    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    const { data: ticket, error } = await supabase
      .from('pool_tickets')
      .select(`
        *,
        pool_sessions (id, name, start_time, end_time)
      `)
      .eq('bracelet_number', braceletNumber)
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'No ticket found with this bracelet number today' });
      }
      throw error;
    }

    res.json({ success: true, data: ticket });
});
