/**
 * Roles Controller
 * Handles role management operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logActivity } from '../../../utils/activityLogger';
import { getCallerTenantId, requireTenantScope } from '../../../security/tenant-scope.js';

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    // Cross-tenant IDOR fix: `roles` is a tenant-scoped table (tenant_id
    // NOT NULL). This previously selected '*' with no tenant filter at all —
    // any tenant_owner could read every tenant's custom role definitions.
    // getCallerTenantId returns null only for a genuinely unscoped platform
    // admin, in which case the query intentionally spans every tenant, same
    // as validatePropertyAccess's super_admin bypass elsewhere. See
    // CONTEXT.md cross-tenant sweep.
    const tenantId = getCallerTenantId(req);
    let rolesQuery = supabase.from('roles').select('*');
    if (tenantId) rolesQuery = rolesQuery.eq('tenant_id', tenantId);
    const { data: rolesList, error } = await rolesQuery;

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
    // Insert must always be stamped with a concrete tenant_id (NOT NULL
    // column) — requireTenantScope throws 403 rather than silently inserting
    // under the wrong tenant if the caller has no concrete tenant context.
    const tenantId = requireTenantScope(req);
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: req.body.name,
        display_name: req.body.displayName,
        description: req.body.description,
        business_unit: req.body.businessUnit,
        tenant_id: tenantId,
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
    const tenantId = getCallerTenantId(req);

    // Confirm the target role belongs to the caller's tenant before touching
    // it. This is the actual fix for the cross-tenant IDOR: previously the
    // update below ran with only .eq('id', req.params.id) — any tenant_owner
    // could update any other tenant's role by UUID. 404 (not 403) so we don't
    // reveal whether the id exists under a different tenant.
    if (tenantId) {
      const { data: owned } = await supabase.from('roles').select('id').eq('id', req.params.id).eq('tenant_id', tenantId).maybeSingle();
      if (!owned) {
        return res.status(404).json({ success: false, error: 'Role not found' });
      }
    }

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
    const tenantId = getCallerTenantId(req);

    // Confirm the target role belongs to the caller's tenant before touching
    // it — same fix as updateRole. Also grab the name here (previously a
    // separate query below) since we need it for the app_role_permissions
    // cleanup either way.
    let roleQuery = supabase.from('roles').select('id, name').eq('id', id);
    if (tenantId) roleQuery = roleQuery.eq('tenant_id', tenantId);
    const { data: roleData } = await roleQuery.maybeSingle();

    if (!roleData) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

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

    if (roleData.name) {
      // Scoped by tenant_id as well as role_name: app_role_permissions has no
      // FK to a specific role, only (role_name, tenant_id, property_id), so
      // deleting by name alone would wipe permission rows for any other
      // tenant's role that happens to share this name. Scoping by tenant_id
      // limits the blast radius to this tenant. Note this table's underlying
      // caching layer (permission-cache.service.ts) still keys purely by
      // role_name in memory — that's a separate, deeper design question
      // flagged separately, not fixed by this change.
      let cleanupQuery = supabase.from('app_role_permissions').delete().eq('role_name', roleData.name);
      if (tenantId) cleanupQuery = cleanupQuery.eq('tenant_id', tenantId);
      await cleanupQuery;
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
