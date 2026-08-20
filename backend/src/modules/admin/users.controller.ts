import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection";
import { getOnlineUsers } from "../../socket";
import { logger } from "../../utils/logger.js";
import { logActivity } from "../../utils/activityLogger";
import { 
  createUserSchema, 
  validateBody, 
  adminUpdateUserSchema,
  assignUserRolesSchema,
  assignUserScopeSchema,
  createUserSchemaWithScope,
} from "../../validation/schemas.js";
import { 
  UserRow, 
  RoleRow, 
  PermissionRow, 
  UserRoleWithPermissions,
  UserPermissionJoin,
  EnhancedUser,
  deriveSlugFromPermission 
} from './types.js';
import { assertStaffUserLimit } from '../../services/feature-limits.service.js';
import { getCallerTenantId } from '../../security/tenant-scope.js';
import { validatePassword } from '../../services/password-policy.service.js';
import { scopeToRoles } from '../../security/permissions.js';

// Interface for user with roles from Supabase query
interface UserWithRolesQuery extends UserRow {
  user_roles?: Array<{ roles?: { name: string } | null }>;
}

// Interface for user role data from separate query (Supabase may return roles as array)
interface UserRoleData {
  user_id: string;
  roles?: { name: string }[] | { name: string } | null;
}

const getPropertyContext = (req: Request) => {
  // NODE_ENV must never influence production authorization. A staging leak or CI
  // misconfig that leaves NODE_ENV='test' would otherwise make every request
  // super-admin. Tests should inject req.user.roles = ['super_admin'] explicitly.
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  const isSuperAdmin = req.user?.roles?.includes('super_admin') ?? false;
  return { propertyId, isSuperAdmin };
};

// Scope hierarchy allow-list: which scopes a caller of a given scope may grant to someone else.
// Anything not listed here (property_staff, customer, or an unrecognized/missing scope) may grant nothing.
const GRANTABLE_SCOPES: Record<string, string[]> = {
  super_admin: ['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'property_manager', 'property_staff', 'customer'],
  tenant_owner: ['tenant_admin', 'property_manager', 'property_staff', 'customer'],
  tenant_admin: ['property_manager', 'property_staff', 'customer'],
  property_manager: ['property_staff', 'customer'],
};

function assertCanGrantScope(callerScope: string | undefined, targetScope: string) {
  const allowed = GRANTABLE_SCOPES[callerScope || ''] || [];
  if (!allowed.includes(targetScope)) {
    const error = new Error(`You do not have permission to create a user with scope '${targetScope}'`);
    (error as any).statusCode = 403;
    throw error;
  }
}

// Role names that map to a privilege tier and therefore must go through the same
// allow-list as scope grants — otherwise assignUserRoles() becomes a second,
// unguarded path to the same escalation createUser() now blocks.
const PRIVILEGED_ROLE_NAMES = ['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin', 'property_manager'];

async function assertCanGrantRoleIds(supabase: any, callerScope: string | undefined, roleIds: string[] | undefined) {
  if (!roleIds || roleIds.length === 0) return;
  const { data: roleRows, error } = await supabase.from('roles').select('id, name').in('id', roleIds);
  if (error) throw error;
  const allowed = GRANTABLE_SCOPES[callerScope || ''] || [];
  for (const role of roleRows || []) {
    if (PRIVILEGED_ROLE_NAMES.includes(role.name) && !allowed.includes(role.name)) {
      const error = new Error(`You do not have permission to grant the '${role.name}' role`);
      (error as any).statusCode = 403;
      throw error;
    }
  }
}

// Get users with advanced filtering and online status
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { type, limit = 50, offset = 0, search } = req.query; // type: 'customer' | 'staff' | 'admin'
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    if (!isSuperAdmin && !propertyId) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    let allowedUserIds: string[] | null = null;
    if (propertyId && !isSuperAdmin) {
      const { data: accessData } = await supabase
        .from('user_property_access')
        .select('user_id')
        .eq('property_id', propertyId);
      
      allowedUserIds = (accessData || []).map(row => row.user_id);
      if (allowedUserIds.length === 0) {
        res.json({ success: true, data: [], total: 0 });
        return;
      }
    }

    let query = supabase
      .from('users')
      .select('*, user_roles!user_id(roles(name))')
      .order('created_at', { ascending: false });

    if (allowedUserIds) {
      query = query.in('id', allowedUserIds);
    }

    // Filter by search term (sanitized to prevent SQL injection)
    if (search) {
      const sanitizedSearch = String(search)
        .replace(/[%_\\]/g, '\\$&')  // Escape SQL wildcards
        .replace(/['";]/g, '')           // Remove quotes and semicolons
        .slice(0, 100);                   // Limit length
      query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`);
    }

    // Pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    // Execute query with fallback in case embedding fails due to ambiguous relationships
    let users: UserWithRolesQuery[] = [];
    let count: number | null | undefined = undefined;

    try {
      const result = await query;
      if (result.error) throw result.error;
      users = (result.data || []) as UserWithRolesQuery[];
      count = result.count;

      const hasEmbeddedRoles = users.some(u => u.user_roles !== undefined);
      if (!hasEmbeddedRoles && users.length > 0) {
        const userIds = users.map(u => u.id).filter(Boolean);
        const { data: urData } = await supabase
          .from('user_roles')
          .select('user_id, roles(name)')
          .in('user_id', userIds);

        if (urData) {
          users.forEach(u => {
            const rolesForUser = urData.filter(r => r.user_id === u.id);
            u.user_roles = rolesForUser.map(r => ({ roles: r.roles as any }));
          });
        }
      }
    } catch (err: unknown) {
      // If Supabase returns an embedding error (multiple relationships), fall back to separate queries
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Embedding failed for users query, falling back to safer fetch:', errorMessage);

      // Fetch users without embedding
      let fallbackQuery = supabase
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (allowedUserIds) {
        fallbackQuery = fallbackQuery.in('id', allowedUserIds);
      }

      const usersResult = await fallbackQuery
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      users = (usersResult.data || []) as UserWithRolesQuery[];
      count = usersResult.count;

      // Fetch roles for these users in a separate query and attach them
      const userIds = users.map(u => u.id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: urData } = await supabase
          .from('user_roles')
          .select('user_id, roles(name)')
          .in('user_id', userIds);

        const roleMap: Record<string, string[]> = {};
        ((urData || []) as UserRoleData[]).forEach((ur) => {
          if (ur.user_id) {
            roleMap[ur.user_id] = roleMap[ur.user_id] || [];
            const roles = ur.roles;
            const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
            if (roleName) roleMap[ur.user_id].push(roleName);
          }
        });

        // Normalize to same shape as embedded response
        users = users.map(u => ({
          ...u,
          user_roles: (roleMap[u.id] || []).map(name => ({ roles: { name } }))
        }));
      }
    }

    const onlineUserIds = getOnlineUsers();

    // Process users to add 'is_online' and scope-based categorization.
    // users.scope is the authorization source of truth; roles[] is derived
    // from it (legacy user_roles is frozen/read-only for the Roles UI).
    const enhancedUsers: EnhancedUser[] = users.map((user) => {
      const scope = (user as any).scope || 'customer';
      const roles = scopeToRoles(scope as any);
      const isAdmin = ['super_admin', 'platform_admin', 'tenant_owner', 'tenant_admin'].includes(scope);
      const isStaff = ['property_manager', 'property_staff'].includes(scope);

      return {
        ...user,
        scope,
        roles,
        is_online: onlineUserIds.includes(user.id),
        user_type: isAdmin ? 'admin' : (isStaff ? 'staff' : 'customer')
      };
    });

    // In-memory filter for specific type request (if database filtering wasn't sufficient)
    let filteredResults = enhancedUsers;
    if (type === 'customer') filteredResults = enhancedUsers.filter((u) => u.user_type === 'customer');
    if (type === 'staff') filteredResults = enhancedUsers.filter((u) => u.user_type === 'staff');
    if (type === 'admin') filteredResults = enhancedUsers.filter((u) => u.user_type === 'admin');

    // Sort: Online first
    filteredResults.sort((a, b) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      return 0;
    });

    res.json({
      success: true,
      data: filteredResults,
      total: count // Note: count might be inaccurate due to in-memory filtering
    });
});

export const getUserDetails = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    if (!isSuperAdmin && !propertyId) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    if (propertyId && !isSuperAdmin) {
      const { data: hasAccess } = await supabase
        .from('user_property_access')
        .select('user_id')
        .eq('user_id', id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access denied: User does not belong to this property context' });
        return;
      }
    }

    // Interface for the complex nested query result
    interface RolePermissionNested {
      permissions?: PermissionRow | null;
    }
    
    interface UserRoleNested {
      roles?: (RoleRow & { role_permissions?: RolePermissionNested[] }) | null;
    }
    
    interface UserPermissionNested {
      is_granted: boolean;
      permission_id: string;
      permissions?: PermissionRow | null;
    }
    
    interface UserDetailsQuery extends UserRow {
      user_roles?: UserRoleNested[];
      user_permissions?: UserPermissionNested[];
    }

    // First try the full query with user_permissions
    let user: UserDetailsQuery | null = null;
    let typedUser: UserDetailsQuery;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey (
            roles (
              id,
              name,
              role_permissions (
                permissions (
                  id,
                  slug,
                  name,
                  description,
                  remetadata,
                  action
                )
              )
            )
          ),
          user_permissions (
            is_granted,
            permission_id,
            permissions (
              id,
              slug,
              name,
              description,
              resource,
              action
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      user = data;
    } catch (embedError) {
      // Fallback: query without user_permissions if the table/relationship doesn't exist
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey (
            roles (
              id,
              name,
              role_permissions (
                permissions (
                  id,
                  slug,
                  name,
                  description,
                  remetadata,
                  action
                )
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      user = data;
    }
    
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    typedUser = user as unknown as UserDetailsQuery;

    // Flatten permissions structure
    const rolePermissions = new Set<string>();
    const effectivePermissions = new Set<string>();

    // 1. Add Role Permissions
    typedUser.user_roles?.forEach((ur) => {
      ur.roles?.role_permissions?.forEach((rp) => {
        const pSlug = deriveSlugFromPermission(rp.permissions);
        if (pSlug) {
          rolePermissions.add(pSlug);
          effectivePermissions.add(pSlug);
        }
      });
    });

    // 2. Apply User Overrides (if user_permissions exists)
    typedUser.user_permissions?.forEach((up) => {
      const pSlug = deriveSlugFromPermission(up.permissions);
      if (pSlug) {
        if (up.is_granted) {
          effectivePermissions.add(pSlug);
        } else {
          effectivePermissions.delete(pSlug); // Handle 'Deny' logic
        }
      }
    });

    const userScope = (typedUser as any).scope || 'customer';

    // Staff record (staff_profiles) — 1:1 with users, tenant-scoped.
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();

    const detailedUser = {
      ...typedUser,
      scope: userScope,
      roles: scopeToRoles(userScope as any),
      // Legacy frozen surface for the Roles/permissions admin UI (read-only
      // compatibility — authorization no longer consults user_roles).
      legacy_roles: typedUser.user_roles?.map((ur) => ur.roles?.name).filter((n): n is string => !!n) || [],
      role_permissions: Array.from(rolePermissions),
      user_permissions_overrides: typedUser.user_permissions || [], // Raw overrides for UI
      effective_permissions: Array.from(effectivePermissions),
      staff_profile: staffProfile || null
    };

    res.json({ success: true, data: detailedUser });
});

// ============================================
// User Management (Create, Update, Delete)
// ============================================

export const createUser = asyncHandler(async (req: Request, res: Response) => {
    // Enforce tenant staff limit before any DB work
    await assertStaffUserLimit(req);

    // Validate input with strong password requirements
    const validatedData = validateBody(createUserSchemaWithScope, req.body);
    const { email, password, fullName, phone, scope } = validatedData;
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    if (!isSuperAdmin && !propertyId) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    // Hard-reject scope escalation: caller can only grant scopes at or below their own tier.
    assertCanGrantScope(req.user?.scope, scope || 'customer');

    const supabase = getSupabase();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    // Enforce password policy on admin-created user
    const policyResult = await validatePassword(password, {
      email,
      firstName: fullName,
    });
    if (!policyResult.valid) {
      return res.status(400).json({
        success: false,
        error: `Password does not meet policy: ${policyResult.errors.join(', ')}`,
      });
    }

    // Hash password with standard bcrypt cost 12
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const passwordHash = await bcrypt.hash(password, 12);

    // Inherit tenant_id from the resolved tenant on the request (set by tenantGate).
    // Falls back to undefined in legacy single-tenant mode.
    const tenantId = req.tenant?.id ?? undefined;

    // Create user with scope (defaults to 'customer' if not provided)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName,
        phone,
        is_active: true,
        email_verified: true, // Admin-created users are auto-verified
        scope: scope || 'customer',
        ...(tenantId ? { tenant_id: tenantId } : {}),
      })
      .select('id, email, full_name, phone, is_active, scope, created_at')
      .single();

    if (userError) throw userError;

    // Record initial password in password_history
    await supabase.from('password_history').insert({
      user_id: user.id,
      password_hash: passwordHash,
      tenant_id: tenantId ?? null,
    });

    // Link user to current property access
    if (propertyId && process.env.NODE_ENV !== 'test') {
      const { error: accessError } = await supabase
        .from('user_property_access')
        .insert({
          user_id: user.id,
          property_id: propertyId,
          tenant_id: tenantId ?? null,
          access_level: 'write'
        });
      if (accessError) throw accessError;
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'CREATE_USER',
      resource: 'users',
      resource_id: user.id
    });

    res.status(201).json({ success: true, data: user });
});

const checkPropertyAccess = async (supabase: any, targetUserId: string, propertyId: string | undefined, isSuperAdmin: boolean | undefined) => {
  if (isSuperAdmin) return true;
  // Deny by default: an absent/omitted X-Property-Id header must never be treated as
  // "check passed" — that was granting cross-tenant read/write on any user record.
  if (!propertyId) return false;
  const { data } = await supabase
    .from('user_property_access')
    .select('user_id')
    .eq('user_id', targetUserId)
    .eq('property_id', propertyId)
    .maybeSingle();
  return !!data;
};

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const validatedData = validateBody(adminUpdateUserSchema, req.body);
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    const hasAccess = await checkPropertyAccess(supabase, id, propertyId, isSuperAdmin);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this user' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_USER',
      resource: 'users',
      resource_id: id
    });

    res.json({ success: true, data });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    // Prevent self-deletion
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const hasAccess = await checkPropertyAccess(supabase, id, propertyId, isSuperAdmin);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this user' });
    }

    // Soft delete
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'DELETE_USER',
      resource: 'users',
      resource_id: id
    });

    res.json({ success: true, message: 'User deactivated' });
});

export const assignUserRoles = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { roleIds } = validateBody(assignUserRolesSchema, req.body);
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    const hasAccess = await checkPropertyAccess(supabase, id, propertyId, isSuperAdmin);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this user' });
    }

    // Block privilege escalation: reject any submitted roleId whose role name
    // sits above the caller's own tier (e.g. a tenant_owner granting themselves super_admin).
    await assertCanGrantRoleIds(supabase, req.user?.scope, roleIds);

    // Replace all roles
    await supabase.from('user_roles').delete().eq('user_id', id);

    if (roleIds && roleIds.length > 0) {
      const roleInserts = roleIds.map((roleId: string) => ({
        user_id: id,
        role_id: roleId,
      }));
      const { error } = await supabase.from('user_roles').insert(roleInserts);
      if (error) throw error;
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'ASSIGN_USER_ROLES',
      resource: 'users',
      resource_id: id,
      new_value: { roleIds }
    });

    res.json({ success: true, message: 'Roles updated' });
});

// New scope-based assignment endpoint (replaces role-based assignment)
// 0.7 re-verification: this function is not currently mounted to any route (confirmed via
// full-tree search), but it writes `scope` directly to the users table and was missing the
// same assertCanGrantScope() allow-list check that createUser()/assignUserRoles() now enforce.
// Left unguarded, wiring this up later (or an agent doing so without noticing) would silently
// reopen the exact privilege-escalation class 0.1/0.2 closed. Guarding it now, before it's ever routed.
export const assignUserScope = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { scope } = validateBody(assignUserScopeSchema, req.body);
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    const hasAccess = await checkPropertyAccess(supabase, id, propertyId, isSuperAdmin);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this user' });
    }

    // Hard-reject scope escalation: same allow-list used by createUser().
    assertCanGrantScope(req.user?.scope, scope);

    // Update user's scope directly
    const { error } = await supabase
      .from('users')
      .update({ scope })
      .eq('id', id);

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'ASSIGN_USER_SCOPE',
      resource: 'users',
      resource_id: id,
      new_value: { scope }
    });

    res.json({ success: true, message: 'Scope updated' });
});

export const revokeUserSessions = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    // Prevent self-revocation
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, error: 'Cannot revoke your own sessions' });
    }

    const isSuperAdmin = req.user?.roles?.includes('super_admin');

    // tenant_admin / tenant_owner can only revoke users within their own tenant
    if (!isSuperAdmin) {
      const { data: targetUser } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', id)
        .maybeSingle();

      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const requestingTenantId = getCallerTenantId(req);
      if (!requestingTenantId || targetUser.tenant_id !== requestingTenantId) {
        return res.status(403).json({ success: false, error: 'Access denied: User does not belong to your tenant' });
      }
    }

    // Deactivate all active sessions
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', id);

    if (sessionError) throw sessionError;

    // Increment token_version to immediately invalidate all existing JWTs
    try {
      await supabase.rpc('increment_token_version', { p_user_id: id });
    } catch {
      // Fallback: manual increment if RPC unavailable
      const { data: user } = await supabase
        .from('users')
        .select('token_version')
        .eq('id', id)
        .single();

      await supabase
        .from('users')
        .update({ token_version: (user?.token_version ?? 0) + 1 })
        .eq('id', id);
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'REVOKE_USER_SESSIONS',
      resource: 'users',
      resource_id: id,
    });

    res.json({ success: true, message: 'All sessions revoked. User will be logged out on next request.' });
});

export const toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, error: 'Cannot toggle your own account status' });
    }

    const hasAccess = await checkPropertyAccess(supabase, id, propertyId, isSuperAdmin);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this user' });
    }

    const { data: current } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', id)
      .single();

    if (!current) return res.status(404).json({ success: false, error: 'User not found' });

    const { data, error } = await supabase
      .from('users')
      .update({ is_active: !current.is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: data.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      resource: 'users',
      resource_id: id
    });

    res.json({ success: true, data });
});
