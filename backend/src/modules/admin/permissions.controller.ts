import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection";
import { logActivity } from "../../utils/activityLogger";
import { permissionCache } from "../../security/permission-cache.service.js";
import { getScopedClient, tenantContextFor } from '../../security/scoped-client.js';
// import type { PermissionRow } from './types.js'; // Deprecated

// -- Permissions --

export const getAllPermissions = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    // Fetch from new app_permissions table
    const { data, error } = await supabase
      .from('app_permissions')
      .select('slug, description, module_slug, created_at')
      .order('module_slug', { ascending: true })
      .order('slug', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
});

// -- Roles --

export const getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params; // role_id

    // `roles` is registered in TENANT_SCOPED_TABLES — auto-scoped to the
    // caller's tenant. Previously unscoped — any tenant_owner could pass
    // another tenant's role UUID and read that role's permission set.
    const scoped = getScopedClient(tenantContextFor(req));
    const { data: roleData, error: roleError } = await scoped.from('roles').select('name').eq('id', id).maybeSingle();

    if (roleError || !roleData) {
        return res.status(404).json({ success: false, error: 'Role not found' });
    }

    // NOTE: app_role_permissions is keyed by (role_name, tenant_id,
    // property_id) but this query still filters by role_name only. If two
    // tenants have a role with the same name, this can surface permission
    // rows that don't belong to the caller's tenant. app_role_permissions is
    // deliberately NOT registered in TENANT_SCOPED_TABLES — its NOT NULL
    // property_id column has no equivalent on `roles`, so getScopedClient
    // can't safely auto-stamp inserts for it. See the note on
    // updateRolePermissions below for why this needs a real design decision
    // rather than a guessed patch.
    const { data, error } = await supabase
      .from('app_role_permissions')
      .select('permission_slug')
      .eq('role_name', roleData.name);

    if (error) throw error;
    
    // Return array of permission slugs
    const permissionSlugs = data.map(d => d.permission_slug);
    res.json({ success: true, data: permissionSlugs });
});

export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params; // role_id
    const { permission_slugs } = req.body; // Array of strings (slugs)
    const ctx = tenantContextFor(req);
    const scoped = getScopedClient(ctx);

    // Resolve role name, auto-scoped to the caller's tenant via the scoped
    // client — same cross-tenant IDOR fix as getRolePermissions and
    // roles.controller.ts.
    const { data: roleData, error: roleError } = await scoped.from('roles').select('name').eq('id', id).maybeSingle();

    if (roleError || !roleData) {
        return res.status(404).json({ success: false, error: 'Role not found' });
    }
    const roleName = roleData.name;

    // 2. Delete all existing for this role.
    //
    // KNOWN UNRESOLVED ISSUE — not fixed in this pass, flagging explicitly:
    // app_role_permissions has NOT NULL tenant_id AND property_id columns,
    // but `roles` has no property_id concept at all, and the insert below
    // has never set either column. That means this insert is very likely
    // already failing against the DB's not-null constraint in production —
    // this delete would succeed (data loss) and the insert would then throw.
    // Scoping the delete by tenant_id below limits a *single* tenant's role
    // update to no longer wipe another tenant's same-named role's rows, but
    // it does not fix the insert, and does not fix permission-cache.service.ts,
    // which caches this table's rows keyed by role_name ALONE (no tenant_id),
    // so two tenants with same-named custom roles currently share one merged
    // permission set in memory regardless of what's fixed here. That's a
    // cache re-keying + schema design decision (role_id vs role_name, and
    // what property_id should mean for a tenant-wide role), not something to
    // guess at in a security patch. Needs your call before it's touched.
    let delQuery = supabase.from('app_role_permissions').delete().eq('role_name', roleName);
    if (ctx.tenantId) delQuery = delQuery.eq('tenant_id', ctx.tenantId);
    const { error: delError } = await delQuery;
    
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

    // Refresh permission cache so the changes take effect immediately in-memory
    await permissionCache.refreshCache();

    // Log Activity
    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLE_PERMISSIONS',
      resource: 'roles',
      resource_id: id,
      new_value: { permission_slugs, role_name: roleName }
    });
    res.json({ success: true, message: 'Role permissions updated' });
});

// -- User Overrides --

// DEPRECATED/TODO: Update to use new app_* tables if user overrides are strict requirement
export async function updateUserPermissions(req: Request, res: Response, next: NextFunction) {
   return res.status(501).json({ success: false, error: 'User-specific permission overrides are temporarily disabled during migration to app_permissions.' });
}
