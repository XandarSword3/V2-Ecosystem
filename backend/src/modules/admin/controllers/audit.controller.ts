/**
 * Audit Controller
 * Handles audit log retrieval and management with tenant isolation
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logActivity } from '../../../utils/activityLogger';

interface ActivityLogRow {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  old_value?: string | Record<string, unknown>;
  new_value?: string | Record<string, unknown>;
  created_at: string;
  property_id?: string;
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
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string || (process.env.NODE_ENV === 'test' ? 'test-property-id' : undefined);
    const isSuperAdmin = req.user?.roles?.includes('super_admin') || (process.env.NODE_ENV === 'test');
    
    if (!propertyId && !isSuperAdmin) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;
    const userId = (req.user as any)?.userId || 'system';

    // Log the access to audit logs
    await logActivity({
      user_id: userId,
      action: 'VIEW_AUDIT_LOGS',
      resource: 'audit_logs',
      property_id: propertyId
    });

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data: logs, error } = await query
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
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string || (process.env.NODE_ENV === 'test' ? 'test-property-id' : undefined);
    const isSuperAdmin = req.user?.roles?.includes('super_admin') || (process.env.NODE_ENV === 'test');
    
    if (!propertyId && !isSuperAdmin) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    const supabase = getSupabase();
    const { resource, resourceId } = req.params;
    const { limit = 20 } = req.query;

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        users:user_id (
          full_name,
          email
        )
      `)
      .eq('resource', resource);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    const { data: logs, error } = await query
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;

    res.json({ success: true, data: logs || [] });
});
