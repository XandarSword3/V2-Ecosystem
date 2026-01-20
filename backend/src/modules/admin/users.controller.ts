import { Request, Response, NextFunction } from 'express';
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

// Interface for user with roles from Supabase query
interface UserWithRolesQuery extends UserRow {
  user_roles?: Array<{ roles?: { name: string } | null }>;
}

// Interface for user role data from separate query (Supabase may return roles as array)
interface UserRoleData {
  user_id: string;
  roles?: { name: string }[] | { name: string } | null;
}

// Get users with advanced filtering and online status
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { type, limit = 50, offset = 0, search } = req.query; // type: 'customer' | 'staff' | 'admin'

    let query = supabase
      .from('users')
      .select('*, user_roles!user_id(roles(name))')
      .order('created_at', { ascending: false });

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
    } catch (err: unknown) {
      // If Supabase returns an embedding error (multiple relationships), fall back to separate queries
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Embedding failed for users query, falling back to safer fetch:', errorMessage);

      // Fetch users without embedding
      const usersResult = await supabase
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
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
  } catch (error) {
    next(error);
  }
}

export async function getUserDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

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
  } catch (error) {
    next(error);
  }
}

// ============================================
// User Management (Create, Update, Delete)
// ============================================

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate input with strong password requirements
    const validatedData = validateBody(createUserSchema, req.body);
    const { email, password, full_name, phone, roles } = validatedData;

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
      })
      .select('id, email, full_name, phone, is_active, created_at')
      .single();

    if (userError) throw userError;

    // Assign roles - roles has default value from schema so is guaranteed to exist
    const rolesToAssign = roles || ['customer'];
    if (rolesToAssign.length > 0) {
      const { data: roleRecords } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', rolesToAssign);

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
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = validateBody(adminUpdateUserSchema, req.body);
    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.fullName !== undefined) updateData.full_name = validatedData.fullName;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive;
    if (validatedData.preferredLanguage !== undefined) updateData.preferred_language = validatedData.preferredLanguage;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_USER',
      resource: 'users',
      resource_id: req.params.id,
      new_value: updateData
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = validateBody(assignUserRolesSchema, req.body);
    const supabase = getSupabase();
    let { roleIds, roles } = validatedData;
    const userId = req.params.id;

    // If roles (names) provided instead of roleIds, look them up
    if (!roleIds || roleIds.length === 0) {
      if (roles && roles.length > 0) {
        const { data: roleData, error: lookupError } = await supabase
          .from('roles')
          .select('id, name')
          .in('name', roles);
        
        if (lookupError) throw lookupError;
        roleIds = (roleData || []).map(r => r.id);
      }
    }

    // Remove existing roles
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Add new roles
    if (roleIds && roleIds.length > 0) {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert(
          roleIds.map((roleId: string) => ({
            user_id: userId,
            role_id: roleId,
            granted_by: req.user!.userId,
          }))
        );

      if (insertError) throw insertError;
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLES',
      resource: 'users',
      resource_id: userId,
      new_value: { roleIds }
    });

    res.json({ success: true, message: 'Roles updated' });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false
      })
      .eq('id', req.params.id);

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'DELETE_USER',
      resource: 'users',
      resource_id: req.params.id
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
}
