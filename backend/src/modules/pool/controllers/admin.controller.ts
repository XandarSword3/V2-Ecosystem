/**
 * Pool Admin Controller
 * Handles capacity, reports, settings, and maintenance
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../../database/connection.js";
import { logger } from "../../../utils/logger.js";
import dayjs from 'dayjs';
import { emitToUnit } from "../../../socket/index.js";

/**
 * Get current pool capacity
 */
export async function getCurrentCapacity(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { sessionId, moduleId } = req.query;
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    // Build query for active tickets
    let query = supabase
      .from('pool_tickets')
      .select('number_of_guests, entry_time, exit_time, session_id')
      .eq('status', 'used')
      .gte('ticket_date', today)
      .lte('ticket_date', endOfDay)
      .not('entry_time', 'is', null)
      .is('exit_time', null);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: activeTickets, error } = await query;
    if (error) throw error;

    const currentOccupancy = (activeTickets || []).reduce(
      (sum, t) => sum + t.number_of_guests,
      0
    );

    // Get max capacity from settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'maxCapacity')
      .eq('category', 'pool')
      .single();

    const maxCapacity = parseInt(settings?.value || '100', 10);

    res.json({
      success: true,
      data: {
        currentOccupancy,
        maxCapacity,
        available: Math.max(0, maxCapacity - currentOccupancy),
        percentFull: Math.round((currentOccupancy / maxCapacity) * 100),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get daily report
 */
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

/**
 * Get pool settings
 */
export async function getPoolSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();

    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('category', 'pool');

    if (error) throw error;

    const settingsObj: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsObj[s.key] = s.value;
    });

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

/**
 * Update pool settings
 */
export async function updatePoolSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const settings = req.body;

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

/**
 * Reset occupancy counter
 */
export async function resetOccupancy(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();

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

    emitToUnit('pool', 'pool:occupancy:reset', { currentOccupancy: 0 });

    res.json({ success: true, message: 'Occupancy reset to 0' });
  } catch (error) {
    next(error);
  }
}

/**
 * Get maintenance logs
 */
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
  } catch (error) {
    next(error);
  }
}

/**
 * Create maintenance log
 */
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
  } catch (error) {
    next(error);
  }
}
