/**
 * Audit Controller
 * Handles audit log retrieval and management
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
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

function safeParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    const logRows = (logs || []) as ActivityLogRow[];
    const userIds = [...new Set(
      logRows
        .map((log) => log.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )];

    let usersById: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      usersById = Object.fromEntries(
        (users || []).map((user: any) => [
          user.id,
          {
            full_name: user.full_name,
            email: user.email,
          },
        ])
      );
    }

    // Map to frontend expected format
    const mappedLogs = logRows.map((log: ActivityLogRow) => ({
      ...log,
      users: log.user_id ? (usersById[log.user_id] || undefined) : undefined,
      entity_type: log.resource,
      entity_id: log.resource_id,
      old_values: safeParseJson(log.old_value),
      new_values: safeParseJson(log.new_value),
    }));

    res.json({ success: true, data: mappedLogs });
});

export const getAuditLogsByResource = asyncHandler(async (req: Request, res: Response) => {
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
});
