/**
 * Audit Controller
 * Handles audit log retrieval and management
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection';

interface ActivityLogRow {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  old_value?: string | Record<string, unknown>;
  new_value?: string | Record<string, unknown>;
  created_at: string;
  users?: { full_name: string; email: string };
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users:user_id (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    // Map to frontend expected format
    const mappedLogs = (logs || []).map((log: ActivityLogRow) => ({
      ...log,
      entity_type: log.resource,
      entity_id: log.resource_id,
      old_values: log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : null,
      new_values: log.new_value ? (typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value) : null,
    }));

    res.json({ success: true, data: mappedLogs });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogsByResource(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { resource, resourceId } = req.params;
    const { limit = 20 } = req.query;

    const query = supabase
      .from('activity_logs')
      .select(`
        *,
        users:user_id (
          full_name,
          email
        )
      `)
      .eq('resource', resource)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (resourceId) {
      query.eq('resource_id', resourceId);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    res.json({ success: true, data: logs || [] });
  } catch (error) {
    next(error);
  }
}
