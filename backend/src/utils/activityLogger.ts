import { getSupabase } from "../database/connection";

interface AuditLogEntry {
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
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
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}
