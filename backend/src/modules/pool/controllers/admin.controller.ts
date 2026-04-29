/**
 * Pool Admin Controller
 * Handles capacity, reports, settings, and maintenance
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from "../../../database/connection.js";
import { logger } from "../../../utils/logger.js";
import dayjs from 'dayjs';
import { emitToUnit } from "../../../socket/index.js";

/**
 * Get current pool capacity
 */
export const getCurrentCapacity = asyncHandler(async (req: Request, res: Response) => {
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

    // Get max capacity from site settings.
    // Canonical schema: site_settings(key TEXT, value JSONB).
    // Pool settings are stored under key='pool' (JSON object).
    const { data: poolSettings } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pool')
      .maybeSingle();

    const maxCapacityRaw =
      (poolSettings?.value && typeof poolSettings.value === 'object'
        ? (poolSettings.value as any).maxCapacity
        : undefined) ?? '100';
    const maxCapacity = parseInt(String(maxCapacityRaw), 10);

    res.json({
      success: true,
      data: {
        currentOccupancy,
        maxCapacity,
        available: Math.max(0, maxCapacity - currentOccupancy),
        percentFull: Math.round((currentOccupancy / maxCapacity) * 100),
      },
    });
});

/**
 * Get daily report
 */
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

/**
 * Get pool settings
 */
export const getPoolSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    const { data: row, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pool')
      .maybeSingle();

    if (error) throw error;

    const defaultSettings = {
      maxCapacity: '100',
      ticketPrice: '15.00',
      childPrice: '10.00',
      operatingHours: 'Open 8:00 AM - 8:00 PM',
      isOpen: 'true',
      ...(row?.value && typeof row.value === 'object' ? (row.value as Record<string, unknown>) : {}),
    };

    res.json({ success: true, data: defaultSettings });
});

/**
 * Update pool settings
 */
export const updatePoolSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const settingsPatch = req.body || {};

    const { data: existing, error: existingError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pool')
      .maybeSingle();
    if (existingError) throw existingError;

    const prev = existing?.value && typeof existing.value === 'object' ? (existing.value as Record<string, unknown>) : {};
    const next = { ...prev, ...settingsPatch };

    const { error } = await supabase.from('site_settings').upsert(
      {
        key: 'pool',
        value: next,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'key' }
    );
    if (error) throw error;

    res.json({ success: true, message: 'Pool settings updated' });
});

/**
 * Reset occupancy counter
 */
export const resetOccupancy = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    const { data: existing, error: existingError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pool')
      .maybeSingle();
    if (existingError) throw existingError;

    const prev = existing?.value && typeof existing.value === 'object' ? (existing.value as Record<string, unknown>) : {};
    const next = { ...prev, currentOccupancy: 0 };

    const { error } = await supabase.from('site_settings').upsert(
      {
        key: 'pool',
        value: next,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'key' }
    );
    if (error) throw error;

    emitToUnit('pool', 'pool:occupancy:reset', { currentOccupancy: 0 });

    res.json({ success: true, message: 'Occupancy reset to 0' });
});

/**
 * Get maintenance logs
 */
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

/**
 * Create maintenance log
 */
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

/**
 * Override session capacity (manager/admin only)
 */
export const overrideSessionCapacity = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { additional, reason, approved_by } = req.body as { additional: number; reason: string; approved_by: string };

    if (!additional || additional <= 0 || !reason || !approved_by) {
      return res.status(400).json({ success: false, error: 'additional, reason, and approved_by are required' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('pool_sessions')
      .select('id, max_capacity')
      .eq('id', id)
      .single();
    if (sessionError || !session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const nextCapacity = Number(session.max_capacity || 0) + Number(additional);
    const { data: updated, error: updateError } = await supabase
      .from('pool_sessions')
      .update({ max_capacity: nextCapacity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    await supabase.from('audit_logs').insert({
      user_id: req.user?.userId || 'system',
      action: 'pool_capacity_override',
      resource: 'pool_session',
      resource_id: id,
      new_value: { previous: session.max_capacity, additional, next: nextCapacity, reason, approved_by },
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, data: updated });
});
