import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection";
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
    // DISABLED — temporarily neutralized (same as updateUserPermissions below).
    // The previous implementation deleted every app_role_permissions row for the
    // role and then re-inserted rows WITHOUT the NOT NULL tenant_id/property_id
    // columns, so the delete succeeded (data loss) and the insert then threw —
    // leaving the role with zero grants after a single "Save Permissions" click.
    // The real fix needs a design decision first: what tenant_id / property_id
    // should mean for a role-permission grant, and whether permission-cache.service.ts
    // should key by role_id instead of role_name (two tenants with same-named
    // roles currently share one merged in-memory permission set). Re-enable only
    // after that is settled and the schema/inserts are updated accordingly.
    return res.status(501).json({
        success: false,
        error: 'Role permission editing is temporarily disabled pending RBAC schema changes.',
        code: 'NOT_IMPLEMENTED',
    });
});

// -- User Overrides --

// DEPRECATED/TODO: Update to use new app_* tables if user overrides are strict requirement
export async function updateUserPermissions(req: Request, res: Response, next: NextFunction) {
   return res.status(501).json({ success: false, error: 'User-specific permission overrides are temporarily disabled during migration to app_permissions.' });
}
