import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import QRCode from 'qrcode';
import { config } from "../../config/index.js";
import dayjs from 'dayjs';

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

    res.json({ success: true, data: sessions || [] });
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
    res.json({ success: true, data: session });
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
        price: session.price,
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
    const supabase = getSupabase();
    const {
      sessionId,
      ticketDate,
      customerName,
      customerPhone,
      numberOfGuests,
      paymentMethod,
    } = req.body;

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
      .select('*')
      .eq('session_id', sessionId)
      .gte('ticket_date', targetDate)
      .lte('ticket_date', endOfDay)
      .eq('status', 'valid');

    if (ticketsError) throw ticketsError;

    const soldGuests = (existingTickets || []).reduce((sum, t) => sum + t.number_of_guests, 0);
    if (soldGuests + numberOfGuests > session.max_capacity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Not enough capacity available',
        available: session.max_capacity - soldGuests,
      });
    }

    const totalAmount = parseFloat(session.price) * numberOfGuests;
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
        customer_id: req.user?.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        ticket_date: dayjs(ticketDate).startOf('day').toISOString(),
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
    if (ticket.status === 'used') {
      return res.status(400).json({ 
        success: false, 
        error: 'Ticket already used',
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

    // Mark as used
    const { data: updatedTicket, error: updateError } = await supabase
      .from('pool_tickets')
      .update({
        status: 'used',
        validated_at: new Date().toISOString(),
        validated_by: req.user!.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      data: updatedTicket,
      message: `Valid! ${ticket.number_of_guests} guest(s) admitted.`,
    });
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
      const usedTickets = sessionTickets.filter(t => t.status === 'used');

      const pendingGuests = validTickets.reduce((sum, t) => sum + t.number_of_guests, 0);
      const admittedGuests = usedTickets.reduce((sum, t) => sum + t.number_of_guests, 0);

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
      .select('*')
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
    const { name, startTime, endTime, maxCapacity, price } = req.body;
    
    // Validate required fields
    if (!name || !startTime || !endTime || maxCapacity === undefined || price === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: name, startTime, endTime, maxCapacity, price' 
      });
    }
    
    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from('pool_sessions')
      .insert({
        name,
        start_time: startTime,
        end_time: endTime,
        max_capacity: Number(maxCapacity),
        price: String(price),
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
    if (req.body.price !== undefined) updateData.price = req.body.price.toString();
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
