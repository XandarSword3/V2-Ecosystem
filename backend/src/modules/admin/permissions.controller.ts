import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { logActivity } from "../../utils/activityLogger";
import type { PermissionRow } from './types.js';

// -- Permissions --

interface NormalizedPermission extends Omit<PermissionRow, 'slug' | 'module_slug'> {
  slug: string | null;
  module_slug: string | null;
}

export async function getAllPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    // Do not rely on DB-side ordering or nullable columns; fetch raw rows and normalize in code
    const { data, error } = await supabase
      .from('permissions')
      .select('*');

    if (error) throw error;

    const normalized = (data || []).map((p: PermissionRow): NormalizedPermission => {
      const slug = p.slug ?? p.name ?? (p.resource && p.action ? `${p.resource}.${p.action}` : null);
      const module_slug = p.module_slug ?? p.resource ?? (slug ? String(slug).split('.')[0] : null);
      return { ...p, slug, module_slug };
    }).sort((a: NormalizedPermission, b: NormalizedPermission) => {
      const ma = a.module_slug || '';
      const mb = b.module_slug || '';
      if (ma === mb) return String(a.slug || '').localeCompare(String(b.slug || ''));
      return ma.localeCompare(mb);
    });

    res.json({ success: true, data: normalized });
  } catch (error) {
    next(error);
  }
}

// -- Roles --

export async function getRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params; // role_id

    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', id);

    if (error) throw error;
    
    // Return array of permission IDs
    const permissionIds = data.map(d => d.permission_id);
    res.json({ success: true, data: permissionIds });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params; // role_id
    const { permission_ids } = req.body; // Array of UUIDs

    // 1. Delete all existing for this role
    const { error: delError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id);
    
    if (delError) throw delError;

    // 2. Insert new
    if (permission_ids && permission_ids.length > 0) {
      const inserts = permission_ids.map((pid: string) => ({
        role_id: id,
        permission_id: pid
      }));
      
      const { error: insError } = await supabase
        .from('role_permissions')
        .insert(inserts);
      
      if (insError) throw insError;
    }
    // Log Activity
    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLE_PERMISSIONS',
      resource: 'roles',
      resource_id: id,
      new_value: { permission_ids }
    });
    res.json({ success: true, message: 'Role permissions updated' });
  } catch (error) {
    next(error);
  }
}

// -- User Overrides --

export async function updateUserPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params; // user_id
    const { permissions } = req.body; 
    // Expect body: { permissions: [{ permission_id: '...', is_granted: true }] }

    // 1. Delete all existing overrides
    const { error: delError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', id);

    if (delError) throw delError;

    // 2. Insert new
    if (permissions && permissions.length > 0) {
        interface PermissionOverride {
          permission_id: string;
          is_granted: boolean;
        }
        const inserts = permissions.map((p: PermissionOverride) => ({
            user_id: id,
            permission_id: p.permission_id,
            is_granted: p.is_granted
        }));
        
        const { error: insError } = await supabase
            .from('user_permissions')
            .insert(inserts);
        
        if (insError) throw insError;
    }

    res.json({ success: true, message: 'User permission overrides updated' });
  } catch (error) {
    next(error);
  }
}
