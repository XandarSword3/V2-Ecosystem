import { getSupabase } from "../database/connection";
import { logger } from "./logger";

interface AuditLogEntry {
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  entity_id?: string; // Alias for resource_id
  entity_type?: string;
  details?: unknown;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string;
  user_agent?: string;
}

export async function logActivity(entry: AuditLogEntry) {
  try {
    const supabase = getSupabase();
    
    // Convert objects to strings if needed
    const safePayload = {
      ...entry,
      old_value: entry.old_value ? (typeof entry.old_value === 'string' ? entry.old_value : JSON.stringify(entry.old_value)) : null,
      new_value: entry.new_value ? (typeof entry.new_value === 'string' ? entry.new_value : JSON.stringify(entry.new_value)) : null,
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(safePayload);

    if (error) {
      logger.error('Failed to write audit log:', error);
    }
  } catch (err) {
    logger.error('Error logging activity:', err);
  }
}

export const activityLogger = {
  log: async (arg1: string | Partial<AuditLogEntry>, arg2?: any) => {
    let entry: AuditLogEntry;
    
    if (typeof arg1 === 'string') {
      entry = {
        action: arg1,
        user_id: arg2?.userId || arg2?.user_id || 'system',
        resource: arg2?.resource || 'system',
        details: arg2,
        ...arg2
      } as AuditLogEntry;
    } else {
      entry = {
         user_id: 'system',
         action: 'unknown',
         resource: 'system',
         ...arg1
      } as AuditLogEntry;
    }
    
    return logActivity(entry);
  }
};

