import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { logActivity } from "../../utils/activityLogger";
// import type { PermissionRow } from './types.js'; // Deprecated

// -- Permissions --

export async function getAllPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    // Fetch from new app_permissions table
    const { data, error } = await supabase
      .from('app_permissions')
      .select('slug, description, module_slug, created_at')
      .order('module_slug', { ascending: true })
      .order('slug', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// -- Roles --

export async function getRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params; // role_id

    // 1. Resolve role name from ID
    const { data: roleData, error: roleError } = await supabase
       .from('roles')
       .select('name')
       .eq('id', id)
       .single();

    if (roleError || !roleData) {
        return res.status(404).json({ success: false, error: 'Role not found' });
    }

    const { data, error } = await supabase
      .from('app_role_permissions')
      .select('permission_slug')
      .eq('role_name', roleData.name);

    if (error) throw error;
    
    // Return array of permission slugs
    const permissionSlugs = data.map(d => d.permission_slug);
    res.json({ success: true, data: permissionSlugs });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params; // role_id
    const { permission_slugs } = req.body; // Array of strings (slugs)

    // 1. Resolve role name
    const { data: roleData, error: roleError } = await supabase
       .from('roles')
       .select('name')
       .eq('id', id)
       .single();

    if (roleError || !roleData) {
        return res.status(404).json({ success: false, error: 'Role not found' });
    }
    const roleName = roleData.name;

    // 2. Delete all existing for this role
    const { error: delError } = await supabase
      .from('app_role_permissions')
      .delete()
      .eq('role_name', roleName);
    
    if (delError) throw delError;

    // 3. Insert new
    if (permission_slugs && permission_slugs.length > 0) {
      const inserts = permission_slugs.map((slug: string) => ({
        role_name: roleName,
        permission_slug: slug
      }));
      
      const { error: insError } = await supabase
        .from('app_role_permissions')
        .insert(inserts);
      
      if (insError) throw insError;
    }
    // Log Activity
    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLE_PERMISSIONS',
      resource: 'roles',
      resource_id: id,
      new_value: { permission_slugs, role_name: roleName }
    });
    res.json({ success: true, message: 'Role permissions updated' });
  } catch (error) {
    next(error);
  }
}

// -- User Overrides --

// DEPRECATED/TODO: Update to use new app_* tables if user overrides are strict requirement
export async function updateUserPermissions(req: Request, res: Response, next: NextFunction) {
   return res.status(501).json({ success: false, error: 'User-specific permission overrides are temporarily disabled during migration to app_permissions.' });
}
