/**
 * Pool Bracelets Controller
 * Handles bracelet assignment and tracking
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../../database/connection.js";
import { logger } from "../../../utils/logger.js";
import { logActivity } from "../../../utils/activityLogger.js";
import dayjs from 'dayjs';

/**
 * Assign a bracelet to a ticket
 */
export async function assignBracelet(req: Request, res: Response, next: NextFunction) {
  try {
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

    await logActivity({
      user_id: req.user!.userId,
      action: 'bracelet_assigned',
      resource: 'pool_ticket',
      resource_id: id,
    });

    logger.info(`Bracelet ${braceletNumber} assigned to ticket ${ticket.ticket_number}`);
    res.json({ success: true, data: updatedTicket });
  } catch (error) {
    next(error);
  }
}

/**
 * Return a bracelet
 */
export async function returnBracelet(req: Request, res: Response, next: NextFunction) {
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

    if (!ticket.bracelet_number) {
      return res.status(400).json({ success: false, error: 'No bracelet assigned to this ticket' });
    }

    if (ticket.bracelet_returned_at) {
      return res.status(400).json({ success: false, error: 'Bracelet has already been returned' });
    }

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

    await logActivity({
      user_id: req.user!.userId,
      action: 'bracelet_returned',
      resource: 'pool_ticket',
      resource_id: id,
    });

    logger.info(`Bracelet ${ticket.bracelet_number} returned for ticket ${ticket.ticket_number}`);
    res.json({ success: true, data: updatedTicket });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all active bracelets (assigned but not returned) for today
 */
export async function getActiveBracelets(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

/**
 * Search for a ticket by bracelet number
 */
export async function searchByBracelet(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}
