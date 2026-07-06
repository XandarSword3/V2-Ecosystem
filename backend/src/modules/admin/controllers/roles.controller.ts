/**
 * Roles Controller
 * Handles role management operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logActivity } from '../../../utils/activityLogger';

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: rolesList, error } = await supabase
      .from('roles')
      .select('*');

    if (error) throw error;

    // Never expose platform-level role rows (or their UUIDs) to a caller who isn't
    // already super_admin — otherwise a tenant_owner can read the super_admin role's
    // id and submit it straight to assignUserRoles().
    const isSuperAdmin = req.user?.scope === 'super_admin';
    const roles = (rolesList || []).filter((r: { name?: string }) =>
      isSuperAdmin || !['super_admin', 'platform_admin'].includes(r.name || '')
    );

    if (roles.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const roleIds = roles.map((r: { id: string }) => r.id).filter(Boolean);

    // Fetch user_roles for counts
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('role_id')
      .in('role_id', roleIds);

    const userCountMap: Record<string, number> = {};
    (userRolesData || []).forEach((ur: { role_id?: string }) => {
      if (!ur.role_id) return;
      userCountMap[ur.role_id] = (userCountMap[ur.role_id] || 0) + 1;
    });

    // Fetch role_permissions for permission counts
    const { data: rolePermsData } = await supabase
      .from('role_permissions')
      .select('role_id,permission_id')
      .in('role_id', roleIds);

    const permCountMap: Record<string, number> = {};
    (rolePermsData || []).forEach((rp: { role_id?: string; permission_id?: string }) => {
      if (!rp.role_id) return;
      permCountMap[rp.role_id] = (permCountMap[rp.role_id] || 0) + 1;
    });

    const enriched = roles.map((r: { id: string }) => ({
      ...r,
      users_count: userCountMap[r.id] || 0,
      permissions_count: permCountMap[r.id] || 0,
    }));

    res.json({ success: true, data: enriched });
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: req.body.name,
        display_name: req.body.displayName,
        description: req.body.description,
        business_unit: req.body.businessUnit,
      })
      .select()
      .single();

    if (error) throw error;

    try {
      const { permissionCache } = await import('../../../security/permission-cache.service.js');
      await permissionCache.refreshCache();
    } catch (cacheError) {
      console.warn('Failed to refresh permission cache:', cacheError);
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'CREATE_ROLE',
      resource: 'roles',
      resource_id: role.id,
      new_value: req.body
    });

    res.status(201).json({ success: true, data: role });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.displayName !== undefined) updateData.display_name = req.body.displayName;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.businessUnit !== undefined) updateData.business_unit = req.body.businessUnit;

    const { data: role, error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    try {
      const { permissionCache } = await import('../../../security/permission-cache.service.js');
      await permissionCache.refreshCache();
    } catch (cacheError) {
      console.warn('Failed to refresh permission cache:', cacheError);
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLE',
      resource: 'roles',
      resource_id: role.id,
      new_value: updateData
    });

    res.json({ success: true, data: role });
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    // Check if role has assigned users
    const { count } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', id);

    if (count && count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete role with assigned users'
      });
    }

    // Get role name to clean up app_role_permissions
    const { data: roleData } = await supabase
      .from('roles')
      .select('name')
      .eq('id', id)
      .single();

    if (roleData?.name) {
      await supabase
        .from('app_role_permissions')
        .delete()
        .eq('role_name', roleData.name);
    }

    // Delete role permissions first
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id);

    // Delete the role
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    try {
      const { permissionCache } = await import('../../../security/permission-cache.service.js');
      await permissionCache.refreshCache();
    } catch (cacheError) {
      console.warn('Failed to refresh permission cache:', cacheError);
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'DELETE_ROLE',
      resource: 'roles',
      resource_id: id
    });

    res.json({ success: true, message: 'Role deleted successfully' });
});
