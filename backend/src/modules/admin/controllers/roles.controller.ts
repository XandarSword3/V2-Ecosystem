/**
 * Roles Controller
 * Handles role management operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logActivity } from '../../../utils/activityLogger';
import { requireTenantScope } from '../../../security/tenant-scope.js';
import { getScopedClient, tenantContextFor } from '../../../security/scoped-client.js';

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    // `roles` is registered in TENANT_SCOPED_TABLES (scoped-client.ts) — the
    // select below is auto-scoped to the caller's tenant, or passes through
    // unscoped (logged) for a genuinely unscoped super_admin. Previously this
    // selected '*' with no filter at all — any tenant_owner could read every
    // tenant's custom role definitions. See CONTEXT.md cross-tenant sweep.
    const scoped = getScopedClient(tenantContextFor(req));
    const { data: rolesList, error } = await scoped.from('roles').select('*');

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

    // user_roles / role_permissions aren't tenant-scoped tables themselves —
    // they're joined here strictly by role_id, and roleIds is already
    // narrowed to this tenant's own roles by the scoped select above, so
    // there's no cross-tenant exposure from querying them with the raw
    // client.
    const supabase = getSupabase();

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
    // Insert must always be stamped with a concrete tenant_id (NOT NULL
    // column) — requireTenantScope throws 403 rather than silently inserting
    // under the wrong tenant (or failing the DB constraint) if the caller has
    // no concrete tenant context. Building the TenantContext explicitly here
    // (rather than tenantContextFor, which allows null) guarantees the
    // scoped client's insert always stamps a real tenant_id.
    const tenantId = requireTenantScope(req);
    const scoped = getScopedClient({ tenantId, actorId: req.user?.userId });
    const { data: role, error } = await scoped.from('roles')
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
    // scoped.update() auto-chains .eq('tenant_id', ...) before the caller's
    // own .eq('id', ...) is added below, so the WHERE clause is effectively
    // "id = X AND tenant_id = caller's tenant" in one query — a role
    // belonging to another tenant simply won't match, no separate
    // ownership-check query needed. If it doesn't match, .single() errors,
    // which the outer 404 branch below reports as "not found" (not 403), so
    // we don't reveal whether the id exists under a different tenant.
    const scoped = getScopedClient(tenantContextFor(req));

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.displayName !== undefined) updateData.display_name = req.body.displayName;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.businessUnit !== undefined) updateData.business_unit = req.body.businessUnit;

    const { data: role, error } = await scoped.from('roles')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

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
    const ctx = tenantContextFor(req);
    const scoped = getScopedClient(ctx);

    // Auto-scoped by tenant_id — a role belonging to another tenant simply
    // won't be found, same 404-not-403 behavior as updateRole.
    const { data: roleData } = await scoped.from('roles').select('id, name').eq('id', id).maybeSingle();

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
      // app_role_permissions is NOT registered in TENANT_SCOPED_TABLES (its
      // NOT NULL property_id column makes it a bad fit for this tool as-is —
      // see permissions.controller.ts's note on that). Scoping this cleanup
      // manually by tenant_id, same as before, limits the blast radius to
      // this tenant rather than deleting every tenant's same-named role's
      // permission rows.
      let cleanupQuery = supabase.from('app_role_permissions').delete().eq('role_name', roleData.name);
      if (ctx.tenantId) cleanupQuery = cleanupQuery.eq('tenant_id', ctx.tenantId);
      await cleanupQuery;
    }

    // Delete role permissions first
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id);

    // Delete the role — auto-scoped by tenant_id via the scoped client, same
    // defense-in-depth as updateRole (ownership was already confirmed above,
    // but this means the delete itself can't affect another tenant's row
    // even if that check were ever bypassed).
    const { error } = await scoped.from('roles')
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
