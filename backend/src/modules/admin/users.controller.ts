import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { getOnlineUsers } from "../../socket";

// Get users with advanced filtering and online status
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { type, limit = 50, offset = 0, search } = req.query; // type: 'customer' | 'staff' | 'admin'

    let query = supabase
      .from('users')
      .select('*, user_roles!user_id(roles(name))')
      .order('created_at', { ascending: false });

    // Filter by search term
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    // Execute query with fallback in case embedding fails due to ambiguous relationships
    let users: any[] = [];
    let count: number | null | undefined = undefined;

    try {
      const result = await query;
      if (result.error) throw result.error;
      users = result.data || [];
      count = result.count;
    } catch (err: any) {
      // If Supabase returns an embedding error (multiple relationships), fall back to separate queries
      const msg = err?.message || err?.error || String(err);
      console.warn('Embedding failed for users query, falling back to safer fetch:', msg);

      // Fetch users without embedding
      const usersResult = await supabase
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      users = usersResult.data || [];
      count = usersResult.count;

      // Fetch roles for these users in a separate query and attach them
      const userIds = users.map(u => u.id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: urData } = await supabase
          .from('user_roles')
          .select('user_id, roles(name)')
          .in('user_id', userIds);

        const roleMap: Record<string, string[]> = {};
        (urData || []).forEach((ur: any) => {
          if (ur.user_id) {
            roleMap[ur.user_id] = roleMap[ur.user_id] || [];
            if (ur.roles?.name) roleMap[ur.user_id].push(ur.roles.name);
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
    const enhancedUsers = users.map((user: any) => {
      const roles = user.user_roles?.map((ur: any) => ur.roles?.name) || [];
      const isStaff = roles.some((r: string) => r.includes('staff') || r.includes('admin'));
      const isAdmin = roles.some((r: string) => r === 'admin' || r === 'super_admin' || r.endsWith('_admin'));
      const isCustomer = roles.length === 0; // Simple heuristic

      return {
        ...user,
        roles: roles,
        is_online: onlineUserIds.includes(user.id),
        user_type: isAdmin ? 'admin' : (isStaff ? 'staff' : 'customer')
      };
    });

    // In-memory filter for specific type request (if database filtering wasn't sufficient)
    let filteredResults = enhancedUsers;
    if (type === 'customer') filteredResults = enhancedUsers.filter((u: any) => u.user_type === 'customer');
    if (type === 'staff') filteredResults = enhancedUsers.filter((u: any) => u.user_type === 'staff');
    if (type === 'admin') filteredResults = enhancedUsers.filter((u: any) => u.user_type === 'admin');

    // Sort: Online first
    filteredResults.sort((a: any, b: any) => {
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

    // Fetch User + Roles + Permissions (Overrides)
    // Avoid requesting columns that might not exist (module_slug/slug in older schemas).
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        user_roles (
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
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Helper to derive a canonical slug from legacy fields
    function deriveSlugFromPerm(perm: any) {
      if (!perm) return null;
      if (perm.slug) return perm.slug;
      if (perm.name && typeof perm.name === 'string' && perm.name.includes('.')) return perm.name;
      if (perm.resource && perm.action) return `${perm.resource}.${perm.action}`;
      if (perm.name && typeof perm.name === 'string') return perm.name.toLowerCase().replace(/\s+/g, '.');
      return null;
    }

    // Flatten permissions structure
    const rolePermissions = new Set<string>();
    const effectivePermissions = new Set<string>();

    // 1. Add Role Permissions
    user.user_roles?.forEach((ur: any) => {
      ur.roles?.role_permissions?.forEach((rp: any) => {
        const p = rp.permissions;
        const pSlug = deriveSlugFromPerm(p);
        if (pSlug) {
          rolePermissions.add(pSlug);
          effectivePermissions.add(pSlug);
        }
      });
    });

    // 2. Apply User Overrides
    user.user_permissions?.forEach((up: any) => {
      const p = up.permissions;
      const pSlug = deriveSlugFromPerm(p);
      if (pSlug) {
        if (up.is_granted) {
          effectivePermissions.add(pSlug);
        } else {
          effectivePermissions.delete(pSlug); // Handle 'Deny' logic
        }
      }
    });

    const detailedUser = {
      ...user,
      roles: user.user_roles?.map((ur: any) => ur.roles.name) || [],
      role_permissions: Array.from(rolePermissions),
      user_permissions_overrides: user.user_permissions || [], // Raw overrides for UI
      effective_permissions: Array.from(effectivePermissions)
    };

    res.json({ success: true, data: detailedUser });
  } catch (error) {
    next(error);
  }
}
