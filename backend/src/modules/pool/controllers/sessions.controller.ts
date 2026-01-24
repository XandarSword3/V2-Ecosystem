/**
 * Pool Sessions Controller
 * Handles session CRUD and availability operations
 */

import { Request, Response, NextFunction } from 'express';
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
export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
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

    const sessionsWithPrices = (sessions || []).map(normalizeSession);
    res.json({ success: true, data: sessionsWithPrices });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single session by ID
 */
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

    res.json({ success: true, data: session ? normalizeSession(session) : null });
  } catch (error) {
    next(error);
  }
}

/**
 * Get session availability for a specific date
 */
export async function getAvailability(req: Request, res: Response, next: NextFunction) {
  try {
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

    const { data: sessions, error: sessErr } = await sessionsQuery;
    if (sessErr) throw sessErr;

    // Get tickets for the date
    const sessionIds = sessions?.map((s) => s.id) || [];
    if (sessionIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { data: tickets, error: tickErr } = await supabase
      .from('pool_tickets')
      .select('session_id, adult_count, child_count')
      .in('session_id', sessionIds)
      .gte('visit_date', targetDate)
      .lt('visit_date', endDate)
      .neq('status', 'cancelled');

    if (tickErr) throw tickErr;

    // Calculate availability
    const availability = (sessions || []).map((session: PoolSessionWithPrices) => {
      const sessionTickets = (tickets || []).filter((t) => t.session_id === session.id);
      const soldTotal = sessionTickets.reduce(
        (sum, t) => sum + (t.adult_count || 0) + (t.child_count || 0),
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
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new pool session (admin)
 */
export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
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

    const { data: session, error } = await supabase
      .from('pool_sessions')
      .insert({
        name,
        start_time,
        end_time,
        capacity: capacity ?? 100,
        price: price ?? adult_price ?? 0,
        adult_price: adult_price ?? price ?? 0,
        child_price: child_price ?? price ?? 0,
        module_id: module_id || null,
        gender_restriction,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: userId || 'system',
      action: 'CREATE',
      resource: 'pool_session',
      resource_id: session.id,
    });

    emitToUnit('pool', 'pool.sessions.created', session);

    res.status(201).json({ success: true, data: normalizeSession(session) });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a pool session (admin)
 */
export async function updateSession(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = (req.user as any)?.userId;
    const { id } = req.params;
    const updates = req.body;

    // Map genderRestriction to gender_restriction if present
    if (updates.genderRestriction !== undefined) {
      updates.gender_restriction = updates.genderRestriction;
      delete updates.genderRestriction;
    }

    const { data: session, error } = await supabase
      .from('pool_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

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
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a pool session (admin)
 */
export async function deleteSession(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}
