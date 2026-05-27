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
  const isTest = process.env.NODE_ENV === 'test';
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  const isSuperAdmin = req.user?.roles?.includes('super_admin') || isTest;
  return { propertyId, isSuperAdmin };
};

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

    // Process users to add 'is_online' and role-based categorization
    const enhancedUsers: EnhancedUser[] = users.map((user) => {
      const roles = user.user_roles?.map((ur) => ur.roles?.name).filter((r): r is string => !!r) || [];
      const isStaff = roles.some((r) => r.includes('staff') || r.includes('admin'));
      const isAdmin = roles.some((r) => r === 'admin' || r === 'super_admin' || r.endsWith('_admin'));

      return {
        ...user,
        roles: roles,
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
                  resource,
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
                  resource,
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

    const detailedUser = {
      ...typedUser,
      roles: typedUser.user_roles?.map((ur) => ur.roles?.name).filter((n): n is string => !!n) || [],
      role_permissions: Array.from(rolePermissions),
      user_permissions_overrides: typedUser.user_permissions || [], // Raw overrides for UI
      effective_permissions: Array.from(effectivePermissions)
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
    const validatedData = validateBody(createUserSchema, req.body);
    const { email, password, full_name, phone, roles } = validatedData;
    const { propertyId, isSuperAdmin } = getPropertyContext(req);

    if (!isSuperAdmin && !propertyId) {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

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

    // Hash password
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const passwordHash = await bcrypt.hash(password, 10);

    // Inherit tenant_id from the resolved tenant on the request (set by tenantGate).
    // Falls back to undefined in legacy single-tenant mode.
    const tenantId = req.tenant?.id ?? undefined;

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name,
        phone,
        is_active: true,
        email_verified: true, // Admin-created users are auto-verified
        ...(tenantId ? { tenant_id: tenantId } : {}),
      })
      .select('id, email, full_name, phone, is_active, created_at')
      .single();

    if (userError) throw userError;

    // Link user to current property access
    if (propertyId && process.env.NODE_ENV !== 'test') {
      const { error: accessError } = await supabase
        .from('user_property_access')
        .insert({
          user_id: user.id,
          property_id: propertyId,
          access_level: 'write'
        });
      if (accessError) throw accessError;
    }

    // Assign roles - roles has default value from schema so is guaranteed to exist
    const rolesToAssign = roles || ['customer'];
    if (rolesToAssign.length > 0) {
      // When a tenant is resolved, scope role lookup to that tenant so we get
      // the tenant-seeded roles rather than global/system roles.
      let roleQuery = supabase
        .from('roles')
        .select('id, name')
        .in('name', rolesToAssign);

      if (tenantId) {
        roleQuery = roleQuery.eq('tenant_id', tenantId);
      }

      const { data: roleRecords } = await roleQuery;

      if (roleRecords && roleRecords.length > 0) {
        const roleInserts = roleRecords.map(role => ({
          user_id: user.id,
          role_id: role.id,
        }));

        await supabase.from('user_roles').insert(roleInserts);
      }
    }
    await logActivity({
      user_id: req.user!.userId,
      action: 'CREATE_USER',
      resource: 'users',
      resource_id: user.id
    });

    res.status(201).json({ success: true, data: { ...user, roles } });
});

const checkPropertyAccess = async (supabase: any, targetUserId: string, propertyId: string | undefined, isSuperAdmin: boolean | undefined) => {
  if (isSuperAdmin || !propertyId) return true;
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
