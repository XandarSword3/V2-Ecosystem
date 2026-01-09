import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import { emailService } from "../../services/email.service.js";
import { purchasePoolTicketSchema, validateBody } from "../../validation/schemas.js";
import QRCode from 'qrcode';
import { config } from "../../config/index.js";
import dayjs from 'dayjs';
import { emitToUnit } from "../../socket/index.js";

function generateTicketNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P-${date}-${random}`;
}

// ============================================
// Public Routes
// ============================================

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { moduleId } = req.query;

        let query = supabase
          .from('pool_sessions')
          .select('*')
          .eq('is_active', true);

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

        const { data: sessions, error } = await query;
        if (error) throw error;
        // Normalize price fields for frontend compatibility
        const sessionsWithPrices = (sessions || []).map((s: any) => ({
          ...s,
          adult_price: s.adult_price ?? s.price ?? 0,
          child_price: s.child_price ?? s.price ?? 0,
        }));
        res.json({ success: true, data: sessionsWithPrices });
  } catch (error) {
    next(error);
  }
}

export async function getSession(req: Request, res: Response, next: NextFunction) {
  try {
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
    } : null;
    res.json({ success: true, data: sessionWithPrices });
  } catch (error) {
    next(error);
  }
}

export async function getAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { date, sessionId, moduleId } = req.query;

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
      };
    });

    if (sessionId) {
      const filtered = availability.find(a => a.sessionId === sessionId);
      return res.json({ success: true, data: filtered });
    }

    res.json({ success: true, data: availability });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Customer Routes
// ============================================

export async function purchaseTicket(req: Request, res: Response, next: NextFunction) {
  try {
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

    // Calculate total using adult/child prices if provided
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
        console.warn('Failed to send ticket email:', err);
      });
    }

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
}

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
  } catch (error) {
    next(error);
  }
}

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

// ============================================
// Staff Routes
// ============================================

export async function validateTicket(req: Request, res: Response, next: NextFunction) {
  try {
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
        const { data: ticket, error } = await supabase
          .from('pool_tickets')
          .select('id')
          .eq('ticket_number', parsed.ticketNumber)
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
    if (['used', 'active'].includes(ticket.status)) {
      return res.status(400).json({
        success: false,
        error: ticket.status === 'active' ? 'Ticket already active (In Pool)' : 'Ticket already used',
        validatedAt: ticket.validated_at,
      });
    }

    if (ticket.status === 'expired' || ticket.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: `Ticket is ${ticket.status}`,
      });
    }

    // Check if ticket is for today
    const today = dayjs().startOf('day');
    const ticketDay = dayjs(ticket.ticket_date).startOf('day');
    if (!ticketDay.isSame(today)) {
      return res.status(400).json({
        success: false,
        error: 'Ticket is not valid for today',
        ticketDate: ticket.ticket_date,
      });
    }

    // Mark as active (Entered)
    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'active',
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
  } catch (error) {
    next(error);
  }
}

export async function recordEntry(req: Request, res: Response, next: NextFunction) {
  try {
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

    if (['used', 'active', 'cancelled'].includes(ticket.status)) {
      return res.status(400).json({ success: false, error: `Ticket status is ${ticket.status}` });
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'active',
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
  } catch (error) {
    next(error);
  }
}

export async function recordExit(req: Request, res: Response, next: NextFunction) {
  try {
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

    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'used',
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
  } catch (error) {
    next(error);
  }
}

export async function getCurrentCapacity(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getTodayTickets(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

// ============================================
// Admin Routes
// ============================================

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startTime, endTime, maxCapacity, moduleId, adult_price, child_price } = req.body as {
      name: string;
      startTime: string;
      endTime: string;
      maxCapacity: number;
      moduleId: string;
      adult_price: string | number;
      child_price: string | number;
    };

    // Validate required fields
    if (!name || !startTime || !endTime || maxCapacity === undefined || adult_price === undefined || child_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, startTime, endTime, maxCapacity, adult_price, child_price'
      });
    }

    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from('pool_sessions')
      .insert({
        name,
        module_id: moduleId,
        start_time: startTime,
        end_time: endTime,
        max_capacity: Number(maxCapacity),
        adult_price: String(adult_price),
        child_price: String(child_price),
      })
      .select()
      .single();

    if (error) {
      console.error('Pool session creation error:', error);
      throw error;
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

export async function updateSession(req: Request, res: Response, next: NextFunction) {
  try {
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

    const { data: session, error } = await supabase
      .from('pool_sessions')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

export async function deleteSession(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function getDailyReport(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

// ============================================
// Pool Settings
// ============================================

export async function getPoolSettings(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function updatePoolSettings(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

export async function resetOccupancy(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

// ============================================
// Maintenance Logs
// ============================================

export async function getMaintenanceLogs(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) { next(error); }
}

export async function createMaintenanceLog(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) { next(error); }
}
