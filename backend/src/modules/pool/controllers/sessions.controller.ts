/**
 * Pool Sessions Controller
 * Handles session CRUD and availability operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from "../../../database/connection.js";
import { logger } from "../../../utils/logger.js";
import { logActivity } from "../../../utils/activityLogger.js";
import dayjs from 'dayjs';
import { PoolSessionRow } from "../../../types/index.js";
import { emitToUnit } from "../../../socket/index.js";

// Extended session type with optional price fields
interface PoolSessionWithPrices extends PoolSessionRow {
  adult_price?: string | number | null;
  child_price?: string | number | null;
}

// Normalize session data for frontend compatibility
function normalizeSession(session: PoolSessionWithPrices) {
  return {
    ...session,
    adult_price: session.adult_price ?? session.price ?? 0,
    child_price: session.child_price ?? session.price ?? 0,
    genderRestriction: (session as unknown as Record<string, unknown>).gender_restriction || 'mixed',
  };
}

/**
 * Get all active pool sessions
 */
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

    let { data: sessions, error } = await query;

    // Compatibility fallback for schemas without module_id support.
    if (error && moduleId && /module_id|schema cache|column/i.test(String(error.message || error.details || ''))) {
      let fallbackQuery = supabase
        .from('pool_sessions')
        .select('*')
        .eq('is_active', true);

      if (gender && ['male', 'female'].includes(gender as string)) {
        fallbackQuery = fallbackQuery.or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`);
      }

      const fallback = await fallbackQuery;
      sessions = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const sessionsWithPrices = (sessions || []).map(normalizeSession);
    res.json({ success: true, data: sessionsWithPrices });
});

/**
 * Get a single session by ID
 */
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

    res.json({ success: true, data: session ? normalizeSession(session) : null });
});

/**
 * Get session availability for a specific date
 */
export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { date, sessionId, moduleId, gender } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, error: 'date required' });
    }

    const targetDate = dayjs(date as string).startOf('day').toISOString();
    const endDate = dayjs(date as string).endOf('day').toISOString();

    // Build sessions query
    let sessionsQuery = supabase
      .from('pool_sessions')
      .select('*')
      .eq('is_active', true);

    if (sessionId) {
      sessionsQuery = sessionsQuery.eq('id', sessionId);
    }
    if (moduleId) {
      sessionsQuery = sessionsQuery.eq('module_id', moduleId);
    }
    if (gender && ['male', 'female'].includes(gender as string)) {
      sessionsQuery = sessionsQuery.or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`);
    }

    let { data: sessions, error: sessErr } = await sessionsQuery;

    // Compatibility fallback for schemas without module_id support.
    if (sessErr && moduleId && /module_id|schema cache|column/i.test(String(sessErr.message || sessErr.details || ''))) {
      let fallbackQuery = supabase
        .from('pool_sessions')
        .select('*')
        .eq('is_active', true);

      if (sessionId) {
        fallbackQuery = fallbackQuery.eq('id', sessionId);
      }
      if (gender && ['male', 'female'].includes(gender as string)) {
        fallbackQuery = fallbackQuery.or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`);
      }

      const fallback = await fallbackQuery;
      sessions = fallback.data;
      sessErr = fallback.error;
    }

    if (sessErr) throw sessErr;

    // Get tickets for the date
    const sessionIds = sessions?.map((s) => s.id) || [];
    if (sessionIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // FIX: Iteration 2 - Use correct column names: ticket_date (not visit_date), number_of_guests (not adult_count/child_count)
    const { data: tickets, error: tickErr } = await supabase
      .from('pool_tickets')
      .select('session_id, number_of_guests')
      .in('session_id', sessionIds)
      .gte('ticket_date', targetDate)
      .lt('ticket_date', endDate)
      .neq('status', 'cancelled');

    if (tickErr) throw tickErr;

    // Calculate availability
    const availability = (sessions || []).map((session: PoolSessionWithPrices) => {
      const sessionTickets = (tickets || []).filter((t) => t.session_id === session.id);
      // FIX: Iteration 2 - Sum number_of_guests (matches actual pool_tickets schema)
      const soldTotal = sessionTickets.reduce(
        (sum, t) => sum + (t.number_of_guests || 0),
        0
      );
      const capacity = session.max_capacity ?? 100;

      return {
        ...normalizeSession(session),
        date: date as string,
        sold: soldTotal,
        capacity,
        available: Math.max(0, capacity - soldTotal),
        isSoldOut: soldTotal >= capacity,
      };
    });

    res.json({ success: true, data: availability });
});

/**
 * Create a new pool session (admin)
 */
export const createSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const userId = (req.user as any)?.userId;
    const { 
      name, 
      start_time, 
      end_time, 
      capacity, 
      price, 
      adult_price, 
      child_price, 
      module_id,
      gender_restriction = 'mixed' 
    } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'name, start_time, and end_time are required',
      });
    }

    // Prefer RPC function, with compatibility fallbacks for legacy schemas.
    let { data: session, error } = await supabase.rpc('insert_pool_session', {
      p_name: name,
      p_start_time: start_time,
      p_end_time: end_time,
      p_max_capacity: Number(capacity ?? 100),
      p_adult_price: Number(adult_price ?? price ?? 0),
      p_child_price: Number(child_price ?? price ?? 0),
      p_gender_restriction: gender_restriction || 'mixed',
      p_module_id: module_id || null,
    });

    if (error) {
      const baseInsert: Record<string, unknown> = {
        name,
        start_time,
        end_time,
        max_capacity: Number(capacity ?? 100),
        adult_price: Number(adult_price ?? price ?? 0),
        child_price: Number(child_price ?? price ?? 0),
        gender_restriction: gender_restriction || 'mixed',
        module_id: module_id || null,
      };

      let insertResult = await supabase
        .from('pool_sessions')
        .insert(baseInsert)
        .select()
        .single();

      if (insertResult.error && /module_id|schema cache|column/i.test(String(insertResult.error.message || insertResult.error.details || ''))) {
        const { module_id: _ignored, ...withoutModule } = baseInsert;
        insertResult = await supabase
          .from('pool_sessions')
          .insert(withoutModule)
          .select()
          .single();
      }

      if (insertResult.error && insertResult.error.code === '23505') {
        insertResult = await supabase
          .from('pool_sessions')
          .select('*')
          .eq('name', name)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
      }

      session = insertResult.data;
      error = insertResult.error;
    }

    if (error) throw error;

    await logActivity({
      user_id: userId || 'system',
      action: 'CREATE',
      resource: 'pool_session',
      resource_id: session.id,
    });

    emitToUnit('pool', 'pool.sessions.created', session);

    res.status(201).json({ success: true, data: normalizeSession(session) });
});

/**
 * Update a pool session (admin)
 */
export const updateSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const userId = (req.user as any)?.userId;
    const { id } = req.params;
    const updates = req.body;

    // Map genderRestriction to gender_restriction if present
    if (updates.genderRestriction !== undefined) {
      updates.gender_restriction = updates.genderRestriction;
      delete updates.genderRestriction;
    }

    // Strip read-only and non-updatable fields
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;
    delete updates.genderRestriction;

    // Keep price in sync with adult_price
    if (updates.adult_price !== undefined) {
      updates.price = updates.adult_price;
    }

    // Use RPC function to bypass PostgREST schema cache issues (PGRST204)
    const { data: session, error } = await supabase.rpc('update_pool_session', {
      p_id: id,
      p_data: updates,
    });

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      throw error;
    }

    await logActivity({
      user_id: userId || 'system',
      action: 'UPDATE',
      resource: 'pool_session',
      resource_id: id,
    });

    emitToUnit('pool', 'pool.sessions.updated', session);

    res.json({ success: true, data: normalizeSession(session) });
});

/**
 * Delete a pool session (admin)
 */
export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const userId = (req.user as any)?.userId;
    const { id } = req.params;

    const { error } = await supabase
      .from('pool_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logActivity({
      user_id: userId || 'system',
      action: 'DELETE',
      resource: 'pool_session',
      resource_id: id,
    });

    emitToUnit('pool', 'pool.sessions.deleted', { id });

    res.json({ success: true, message: 'Session deleted' });
});
