import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection.js";
import { emitToAll } from "../../socket/index.js";
import { logActivity } from "../../utils/activityLogger.js";
import { logger } from "../../utils/logger.js";
import { 
  createUserSchema, 
  validateBody, 
  validatePagination,
  adminUpdateUserSchema,
  assignUserRolesSchema,
  createRoleSchema,
  updateRoleSchema,
  createPermissionSchema,
  assignRolePermissionsSchema
} from "../../validation/schemas.js";
import dayjs from 'dayjs';
import type {
  PermissionRow,
  UserRoleJoin,
  UserRoleWithPermissions,
  UserPermissionJoin,
  RolePermissionJoin,
  RestaurantOrderRow,
} from './types.js';

// Helper to derive canonical slug from permission object
function deriveSlugFromPerm(perm: PermissionRow | null | undefined): string | null {
  if (!perm) return null;
  if (perm.slug) return perm.slug;
  if (perm.name && typeof perm.name === 'string' && perm.name.includes('.')) return perm.name;
  if (perm.resource && perm.action) return `${perm.resource}.${perm.action}`;
  if (perm.name && typeof perm.name === 'string') return perm.name.toLowerCase().replace(/\s+/g, '.');
  return null;
}

// ============================================
// Dashboard
// ============================================

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString();
    const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').toISOString();
    const lastWeekStart = dayjs().subtract(7, 'day').startOf('day').toISOString();
    const lastWeekEnd = dayjs().subtract(7, 'day').endOf('day').toISOString();

    // Today's stats - run queries in parallel
    const [
      ordersResult,
      revenueResult,
      chaletBookingsResult,
      chaletRevenueResult,
      poolTicketsResult,
      poolRevenueResult,
      usersResult,
      recentOrdersResult,
      yesterdayOrdersResult,
      yesterdayRevenueResult,
      lastWeekBookingsResult,
      yesterdayTicketsResult
    ] = await Promise.all([
      // All orders today (restaurant + snack merged)
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // All order revenue today
      supabase.from('transactions')
        .select('amount')
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      // Accommodation bookings count (check-in today)
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'time_exclusive_reservation')
        .filter('metadata->>check_in_date', 'gte', today)
        .filter('metadata->>check_in_date', 'lte', endOfDay),
      // Accommodation revenue today
      supabase.from('transactions')
        .select('amount')
        .eq('engine_type', 'time_exclusive_reservation')
        .filter('metadata->>check_in_date', 'gte', today)
        .filter('metadata->>check_in_date', 'lte', endOfDay)
        .eq('payment_status', 'paid'),
      // Pool tickets count (today)
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Pool revenue today
      supabase.from('transactions')
        .select('amount')
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      // Total users
      supabase.from('users')
        .select('id', { count: 'exact', head: true }),
      // Recent orders (unified)
      supabase.from('transactions')
        .select('id, order_number, customer_name, status, amount, created_at, engine_type')
        .eq('engine_type', 'instant_transaction')
        .order('created_at', { ascending: false })
        .limit(5),
      // Yesterday orders count
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday),
      // Yesterday revenue
      supabase.from('transactions')
        .select('amount')
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .eq('payment_status', 'paid'),
      // Last week bookings
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'time_exclusive_reservation')
        .filter('metadata->>check_in_date', 'gte', lastWeekStart)
        .filter('metadata->>check_in_date', 'lte', lastWeekEnd),
      // Yesterday pool tickets
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
    ]);

    // Calculate totals
    const ordersRevenue = (revenueResult.data || []).reduce(
      (sum: number, o: any) => sum + parseFloat(o.amount || 0), 0
    );
    const chaletRevenue = (chaletRevenueResult.data || []).reduce(
      (sum: number, o: any) => sum + parseFloat(o.amount || 0), 0
    );
    const poolRevenue = (poolRevenueResult.data || []).reduce(
      (sum: number, o: any) => sum + parseFloat(o.amount || 0), 0
    );

    const totalOrders = ordersResult.count || 0;
    const totalRevenue = ordersRevenue + chaletRevenue + poolRevenue;

    // Yesterday's calculations
    const yesterdayOrders = yesterdayOrdersResult.count || 0;
    const yesterdayRevenue = (yesterdayRevenueResult.data || []).reduce(
      (sum: number, o: any) => sum + parseFloat(o.amount || 0), 0
    );
    const lastWeekBookings = lastWeekBookingsResult.count || 0;
    const yesterdayTickets = yesterdayTicketsResult.count || 0;

    // Calculate trends
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const ordersTrend = calcTrend(totalOrders, yesterdayOrders);
    const revenueTrend = calcTrend(totalRevenue, yesterdayRevenue);
    const bookingsTrend = calcTrend(chaletBookingsResult.count || 0, lastWeekBookings);
    const ticketsTrend = calcTrend(poolTicketsResult.count || 0, yesterdayTickets);

    interface RecentOrderResult {
      id: string;
      order_number: string;
      customer_name?: string | null;
      status: string;
      amount: string;
      created_at: string;
    }
    const recentOrders = ((recentOrdersResult.data || []) as RecentOrderResult[]).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      status: order.status,
      totalAmount: parseFloat(order.amount) || 0,
      itemCount: 0,
      createdAt: order.created_at,
    }));

    res.json({
      success: true,
      data: {
        todayOrders: totalOrders,
        todayRevenue: totalRevenue,
        todayBookings: chaletBookingsResult.count || 0,
        todayTickets: poolTicketsResult.count || 0,
        totalUsers: usersResult.count || 0,
        recentOrders: recentOrders,
        revenueByUnit: {
          orders: ordersRevenue,
          chalets: chaletRevenue,
          pool: poolRevenue,
        },
        breakdown: {
          totalOrders: ordersResult.count || 0,
          chaletBookings: chaletBookingsResult.count || 0,
          poolTickets: poolTicketsResult.count || 0,
        },
        trends: {
          orders: ordersTrend,
          revenue: revenueTrend,
          bookings: bookingsTrend,
          tickets: ticketsTrend,
        }
      },
    });
});

export const getRevenueStats = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { startDate, endDate } = req.query;

    const start = startDate ? dayjs(startDate as string).toISOString() : dayjs().startOf('month').toISOString();
    const end = endDate ? dayjs(endDate as string).toISOString() : dayjs().endOf('month').toISOString();

    const { data: paymentsList, error } = await supabase
      .from('payments')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)
      .eq('status', 'completed');

    if (error) throw error;

    const payments = paymentsList || [];
    const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const byType = payments.reduce((acc, p) => {
      acc[p.reference_type] = (acc[p.reference_type] || 0) + parseFloat(p.amount);
      return acc;
    }, {} as Record<string, number>);

    const byMethod = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + parseFloat(p.amount);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        period: { start, end },
        totalRevenue,
        byType,
        byMethod,
        transactionCount: payments.length,
      },
    });
});

// ============================================
// Users
// ============================================

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('users')
      .select('id, email, full_name, phone, is_active, email_verified, last_login_at, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (search && typeof search === 'string') {
      // Sanitize search input: escape special SQL characters
      const sanitizedSearch = search
        .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
        .replace(/['"]/g, '')       // Remove quotes
        .slice(0, 100);             // Limit length
      query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`);
    }

    const { data: usersList, error } = await query;

    if (error) throw error;

    // Fetch roles for all users
    interface SupabaseRoleJoin { roles?: { name?: string }[] | { name?: string } | null }
    const usersWithRoles = await Promise.all(
      (usersList || []).map(async (user) => {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', user.id);

        return {
          ...user,
          roles: ((userRoles || []) as SupabaseRoleJoin[]).map((ur) => {
            const roles = ur.roles;
            if (!roles) return undefined;
            if (Array.isArray(roles)) return roles[0]?.name;
            return (roles as { name?: string }).name;
          }).filter(Boolean),
        };
      })
    );

    res.json({ success: true, data: usersWithRoles });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
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
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    // First attempt: try embedded query (works when schema relationships are clean)
    try {
      const { data: user, error } = await supabase
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
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });

      const rolePermissions = new Set<string>();
      const effectivePermissions = new Set<string>();

      // Helper to extract slug from permission (handles Supabase array/object join)
      const getSlugFromPerm = (p: unknown): string | null => {
        if (!p) return null;
        const perm = Array.isArray(p) ? p[0] : p;
        const permObj = perm as { slug?: string; resource?: string; action?: string } | null;
        return permObj?.slug || (permObj?.resource && permObj?.action ? `${permObj.resource}.${permObj.action}` : null);
      };

      // Type for embedded query results
      interface EmbeddedUserRole {
        roles?: {
          role_permissions?: Array<{ permissions?: unknown }>;
          name?: string;
        } | Array<{ role_permissions?: Array<{ permissions?: unknown }>; name?: string }> | null;
      }
      interface EmbeddedUserPerm {
        is_granted?: boolean;
        permissions?: unknown;
      }

      const typedUser = user as typeof user & { user_roles?: EmbeddedUserRole[]; user_permissions?: EmbeddedUserPerm[] };

      typedUser.user_roles?.forEach((ur: EmbeddedUserRole) => {
        const rolesData = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
        rolesData?.role_permissions?.forEach((rp: { permissions?: unknown }) => {
          const pSlug = getSlugFromPerm(rp.permissions);
          if (pSlug) {
            rolePermissions.add(pSlug);
            effectivePermissions.add(pSlug);
          }
        });
      });

      typedUser.user_permissions?.forEach((up: EmbeddedUserPerm) => {
        const pSlug = getSlugFromPerm(up.permissions);
        if (pSlug) {
          if (up.is_granted) {
            effectivePermissions.add(pSlug);
          } else {
            effectivePermissions.delete(pSlug);
          }
        }
      });

      const { password_hash, ...safeUser } = user;

      const detailedUser = {
        ...safeUser,
        roles: typedUser.user_roles?.map((ur: EmbeddedUserRole) => {
          const rolesData = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
          return rolesData?.name;
        }).filter(Boolean) || [],
        role_permissions: Array.from(rolePermissions),
        user_permissions_overrides: typedUser.user_permissions || [],
        effective_permissions: Array.from(effectivePermissions)
      };

      return res.json({ success: true, data: detailedUser });
    } catch (embedError: unknown) {
      // If embedding failed (e.g., ambiguous relationships), fallback to safer series of queries
      const err = embedError as Error;
      const msg = err?.message || String(embedError);
      logger.warn('Embedded user fetch failed, falling back. Reason:', msg);

      // Basic user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') return res.status(404).json({ success: false, error: 'User not found' });
        throw userError;
      }

      // Roles assigned
      const { data: userRolesList, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id, roles(id,name)')
        .eq('user_id', id);

      if (rolesError) throw rolesError;

      // Type for Supabase join result (roles can be array or object)
      interface RoleJoinResult { role_id?: string; roles?: { id?: string; name?: string }[] | { id?: string; name?: string } | null }
      const roleIds = ((userRolesList || []) as RoleJoinResult[]).map((r) => r.role_id).filter(Boolean) as string[];

      // Role permissions
      interface PermJoinResult { role_id?: string; permission_id?: string; permissions?: { id?: string; slug?: string; name?: string; resource?: string; action?: string }[] | { id?: string; slug?: string; name?: string; resource?: string; action?: string } | null }
      let rolePermRows: PermJoinResult[] = [];
      if (roleIds.length > 0) {
        const { data: rpData, error: rpErr } = await supabase
          .from('role_permissions')
          .select('role_id, permission_id, permissions(id,slug,name,resource,action)')
          .in('role_id', roleIds);
        if (rpErr) throw rpErr;
        rolePermRows = (rpData || []) as PermJoinResult[];
      }

      // User permission overrides
      interface UserPermJoinResult { is_granted?: boolean; permission_id?: string; permissions?: { id?: string; slug?: string; name?: string; resource?: string; action?: string }[] | { id?: string; slug?: string; name?: string; resource?: string; action?: string } | null }
      const { data: userPerms, error: userPermErr } = await supabase
        .from('user_permissions')
        .select('is_granted,permission_id,permissions(id,slug,name,resource,action)')
        .eq('user_id', id);
      if (userPermErr) throw userPermErr;

      const rolePermissions = new Set<string>();
      const effectivePermissions = new Set<string>();

      const getPermSlug = (p: PermJoinResult['permissions']): string | null => {
        if (!p) return null;
        const perm = Array.isArray(p) ? p[0] : p;
        return perm?.slug || (perm?.resource && perm?.action ? `${perm.resource}.${perm.action}` : null);
      };

      rolePermRows.forEach((rp) => {
        const slug = getPermSlug(rp.permissions);
        if (slug) {
          rolePermissions.add(slug);
          effectivePermissions.add(slug);
        }
      });

      ((userPerms || []) as UserPermJoinResult[]).forEach((up) => {
        const slug = getPermSlug(up.permissions);
        if (slug) {
          if (up.is_granted) effectivePermissions.add(slug);
          else effectivePermissions.delete(slug);
        }
      });

      const detailedUser = {
        ...user,
        roles: ((userRolesList || []) as RoleJoinResult[]).map((r) => {
          const roles = r.roles;
          if (!roles) return undefined;
          if (Array.isArray(roles)) return roles[0]?.name;
          return (roles as { name?: string }).name;
        }).filter(Boolean),
        role_permissions: Array.from(rolePermissions),
        user_permissions_overrides: userPerms || [],
        effective_permissions: Array.from(effectivePermissions)
      };

      return res.json({ success: true, data: detailedUser });
    }
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
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
});

export const updateUserRoles = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validateBody(assignUserRolesSchema, req.body);
    const supabase = getSupabase();
    const { roleIds } = validatedData;
    const userId = req.params.id;

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
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
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
});

// ============================================
// Roles
// ============================================

export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: rolesList, error } = await supabase
      .from('roles')
      .select('*');

    if (error) throw error;

    const roles = rolesList || [];

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
    const validatedData = validateBody(createRoleSchema, req.body);
    const supabase = getSupabase();
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: validatedData.name,
        display_name: validatedData.displayName,
        description: validatedData.description,
        business_unit: validatedData.businessUnit,
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'CREATE_ROLE',
      resource: 'roles',
      resource_id: role.id,
      new_value: validatedData
    });

    res.status(201).json({ success: true, data: role });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validateBody(updateRoleSchema, req.body);
    const supabase = getSupabase();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.displayName !== undefined) updateData.display_name = validatedData.displayName;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;

    const { data: role, error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_ROLE',
      resource: 'roles',
      resource_id: role.id,
      new_value: validatedData
    });

    res.json({ success: true, data: role });
});

// ============================================
// Settings & Audit
// ============================================

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    // Get all settings from database (existing schema uses 'key' and 'value' columns)
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error) throw error;

    // Combine all settings into a flat object
    const combinedSettings: Record<string, unknown> = {};
    (settings || []).forEach((s: { key: string; value: unknown }) => {
      // Store keyed setting
      combinedSettings[s.key] = s.value;
    });

    // Flatten nested settings keys into root to match default response structure
    // This supports frontend expecting flat properties (e.g. resortName at root)
    const nestedKeys = ['appearance', 'general', 'contact', 'hours', 'chalets', 'pool', 'legal'];
    nestedKeys.forEach(key => {
      if (combinedSettings[key] && typeof combinedSettings[key] === 'object') {
        Object.assign(combinedSettings, combinedSettings[key]);
      }
    });

    // Map mismatched keys to preserve default schema (DB uses shorter names in some groups)
    const chalets = combinedSettings.chalets as Record<string, unknown> | undefined;
    if (chalets) {
      combinedSettings.chaletCheckIn = combinedSettings.checkIn || chalets.checkIn;
      combinedSettings.chaletCheckOut = combinedSettings.checkOut || chalets.checkOut;
      combinedSettings.chaletDeposit = combinedSettings.depositPercent || chalets.depositPercent;
    }
    const pool = combinedSettings.pool as Record<string, unknown> | undefined;
    if (pool) {
      combinedSettings.poolAdultPrice = combinedSettings.adultPrice || pool.adultPrice;
      combinedSettings.poolChildPrice = combinedSettings.childPrice || pool.childPrice;
      combinedSettings.poolInfantPrice = combinedSettings.infantPrice || pool.infantPrice;
      combinedSettings.poolCapacity = combinedSettings.capacity || pool.capacity;
    }

    // If no settings in DB, return defaults
    if (Object.keys(combinedSettings).length === 0) {
      res.json({
        success: true,
        data: {
          resortName: 'V2 Resort',
          tagline: "Lebanon's Premier Resort Experience",
          description: 'Your premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.',
          phone: '',
          email: 'info@v2resort.com',
          address: 'V2 Resort, Lebanon',
          poolHours: '9:00 AM - 7:00 PM',
          restaurantHours: '8:00 AM - 11:00 PM',
          receptionHours: '24/7',
          chaletCheckIn: '3:00 PM',
          chaletCheckOut: '12:00 PM',
          chaletDeposit: 50,
          cancellationPolicy: 'Free cancellation up to 48 hours before check-in. 50% charge for late cancellations.',
          poolAdultPrice: 15,
          poolChildPrice: 10,
          poolInfantPrice: 0,
          poolCapacity: 100,
          privacyPolicy: '',
          termsOfService: '',
          refundPolicy: '',
        },
      });
      return;
    }

    res.json({ success: true, data: combinedSettings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const settings = req.body;
    const userId = req.user?.userId;

    // Helper to check if an object has any non-undefined values
    const hasValidData = (obj: Record<string, unknown>) => 
      Object.values(obj).some(v => v !== undefined);

    // Helper to filter out undefined values from an object
    const filterUndefined = (obj: Record<string, unknown>) => 
      Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

    const updates: { key: string; value: unknown }[] = [];

    // Appearance settings (theme, weather, animations)
    const appearanceData = {
      theme: settings.theme,
      themeColors: settings.themeColors,
      animationsEnabled: settings.animationsEnabled,
      reducedMotion: settings.reducedMotion,
      soundEnabled: settings.soundEnabled,
      showWeatherWidget: settings.showWeatherWidget,
      weatherLocation: settings.weatherLocation,
      weatherEffect: settings.weatherEffect,
    };
    if (hasValidData(appearanceData)) {
      // Merge with existing appearance settings to preserve unchanged values
      const { data: existingAppearance } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'appearance')
        .single();
      
      const mergedAppearance = {
        ...(existingAppearance?.value || {}),
        ...filterUndefined(appearanceData)
      };
      updates.push({ key: 'appearance', value: mergedAppearance });
    }

    // General settings
    const generalData = {
      resortName: settings.resortName,
      tagline: settings.tagline,
      description: settings.description,
    };
    if (hasValidData(generalData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'general').single();
      updates.push({ key: 'general', value: { ...(existing?.value || {}), ...filterUndefined(generalData) } });
    }

    // Contact settings
    const contactData = {
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
    };
    if (hasValidData(contactData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'contact').single();
      updates.push({ key: 'contact', value: { ...(existing?.value || {}), ...filterUndefined(contactData) } });
    }

    // Hours settings
    const hoursData = {
      poolHours: settings.poolHours,
      restaurantHours: settings.restaurantHours,
      receptionHours: settings.receptionHours,
    };
    if (hasValidData(hoursData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'hours').single();
      updates.push({ key: 'hours', value: { ...(existing?.value || {}), ...filterUndefined(hoursData) } });
    }

    // Chalet settings
    const chaletData = {
      checkIn: settings.chaletCheckIn,
      checkOut: settings.chaletCheckOut,
      depositPercent: settings.chaletDeposit,
      cancellationPolicy: settings.cancellationPolicy,
    };
    if (hasValidData(chaletData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'chalets').single();
      updates.push({ key: 'chalets', value: { ...(existing?.value || {}), ...filterUndefined(chaletData) } });
    }

    // Pool settings
    const poolData = {
      adultPrice: settings.poolAdultPrice,
      childPrice: settings.poolChildPrice,
      infantPrice: settings.poolInfantPrice,
      capacity: settings.poolCapacity,
    };
    if (hasValidData(poolData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'pool').single();
      updates.push({ key: 'pool', value: { ...(existing?.value || {}), ...filterUndefined(poolData) } });
    }

    // Legal settings
    const legalData = {
      privacyPolicy: settings.privacyPolicy,
      termsOfService: settings.termsOfService,
      refundPolicy: settings.refundPolicy,
    };
    if (hasValidData(legalData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'legal').single();
      updates.push({ key: 'legal', value: { ...(existing?.value || {}), ...filterUndefined(legalData) } });
    }

    // CMS settings - homepage, footer, navbar (these come as complete objects)
    if (settings.homepage) {
      updates.push({ key: 'homepage', value: settings.homepage });
    }
    if (settings.footer) {
      updates.push({ key: 'footer', value: settings.footer });
    }
    if (settings.navbar) {
      updates.push({ key: 'navbar', value: settings.navbar });
    }

    // Perform all updates
    for (const update of updates) {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          key: update.key,
          value: update.value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      
      if (error) {
        logger.error(`Failed to update ${update.key}:`, error);
        throw error;
      }
    }

    // Emit socket event for real-time updates
    const updatedCategories = updates.map(u => u.key);
    const flattenedSettings: Record<string, any> = {};
    for (const update of updates) {
      if (typeof update.value === 'object' && !Array.isArray(update.value)) {
        Object.assign(flattenedSettings, update.value);
      }
    }
    emitToAll('settings.updated', flattenedSettings);

    await logActivity({
      user_id: userId!,
      action: 'UPDATE_SETTINGS',
      resource: `settings:${updatedCategories.join(',')}`,
      new_value: settings
    });

    res.json({ success: true, message: 'Settings saved successfully' });
});

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        users:user_id (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    // Activity log row type
    interface ActivityLogRow {
      id: string;
      user_id: string;
      action: string;
      resource: string;
      resource_id?: string;
      old_value?: string | Record<string, unknown>;
      new_value?: string | Record<string, unknown>;
      created_at: string;
      users?: { full_name: string; email: string };
    }

    // Map to frontend expected format
    const mappedLogs = (logs || []).map((log: ActivityLogRow) => ({
      ...log,
      entity_type: log.resource,
      entity_id: log.resource_id,
      old_values: log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : null,
      new_values: log.new_value ? (typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value) : null,
    }));

    res.json({ success: true, data: mappedLogs });
});

// ============================================
// Reports
// ============================================

export const getOverviewReport = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    // Calculate date range based on range parameter
    let start: string;
    const end: string = dayjs().endOf('day').toISOString();

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day').toISOString();
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day').toISOString();
    } else {
      start = dayjs().subtract(1, 'month').startOf('day').toISOString();
    }

    // Query unified transactions table with correct PostgREST chaining
    const [
      instantResult,
      chaletResult,
      poolResult,
      usersResult,
      itemsResult
    ] = await Promise.all([
      supabase.from('transactions')
        .select('id, status, amount, created_at')
        .eq('engine_type', 'instant_transaction')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1000),
      supabase.from('transactions')
        .select('id, status, amount, created_at')
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1000),
      supabase.from('transactions')
        .select('id, status, amount, created_at')
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1000),
      supabase.from('users')
        .select('id', { count: 'exact', head: true }),
      // Fetch completed orders for top items (items stored in metadata.items)
      supabase.from('transactions')
        .select('metadata, amount, status')
        .eq('engine_type', 'instant_transaction')
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(500),
    ]);

    const instantList = instantResult.data || [];
    const chaletList = chaletResult.data || [];
    const poolList = poolResult.data || [];
    const totalUsers = usersResult.count || 0;

    if (
      instantList.length >= 1000 ||
      chaletList.length >= 1000 ||
      poolList.length >= 1000
    ) {
      logger.warn('Admin overview report hit 1000-row safety limit for one or more datasets', {
        instant: instantList.length,
        chalets: chaletList.length,
        pool: poolList.length,
        start,
        end,
      });
    }

    // Calculate revenues
    const COMPLETED = ['completed', 'paid'];
    const instantRevenue = instantList
      .filter(o => COMPLETED.includes(o.status))
      .reduce((sum, o) => sum + parseFloat(o.amount || '0'), 0);
    const chaletRevenue = chaletList
      .filter(b => COMPLETED.includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.amount || '0'), 0);
    const poolRevenue = poolList
      .filter(t => COMPLETED.includes(t.status))
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const totalRevenue = instantRevenue + chaletRevenue + poolRevenue;
    const totalOrders = instantList.length;
    const totalBookings = chaletList.length + poolList.length;

    // Process Top Items from metadata.items
    const topItemsMap = new Map<string, { name: string, quantity: number, revenue: number }>();

    for (const tx of (itemsResult.data || [])) {
      const items = (tx.metadata as any)?.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const name = item.name || item.menu_item_name || 'Unknown Item';
          const current = topItemsMap.get(name) || { name, quantity: 0, revenue: 0 };
          current.quantity += (item.quantity || 1);
          current.revenue += (item.quantity || 1) * (item.unit_price || item.price || 0);
          topItemsMap.set(name, current);
        }
      }
    }

    const topItems = Array.from(topItemsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Revenue By Month (or Period)
    const monthlyRevenueMap = new Map<string, number>();
    const addToMonth = (date: string, amount: number) => {
      const month = dayjs(date).format('MMM YYYY');
      monthlyRevenueMap.set(month, (monthlyRevenueMap.get(month) || 0) + parseFloat(String(amount)));
    };

    instantList.filter(o => COMPLETED.includes(o.status)).forEach(o => addToMonth(o.created_at, o.amount));
    chaletList.filter(b => COMPLETED.includes(b.status)).forEach(b => addToMonth(b.created_at, b.amount));
    poolList.filter(t => COMPLETED.includes(t.status)).forEach(t => addToMonth(t.created_at, t.amount));

    const revenueByMonth = Array.from(monthlyRevenueMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => dayjs(a.month, 'MMM YYYY').valueOf() - dayjs(b.month, 'MMM YYYY').valueOf());

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalOrders,
          totalBookings,
          totalUsers,
          revenueChange: 0,
          ordersChange: 0,
        },
        revenueByService: {
          instant: instantRevenue,
          chalets: chaletRevenue,
          pool: poolRevenue,
        },
        revenueByMonth,
        topItems,
      },
    });
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { type, format = 'csv', range = 'month' } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Report type is required' });
    }

    // Calculate date range
    let start: string;
    const end: string = dayjs().endOf('day').toISOString();

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day').toISOString();
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day').toISOString();
    } else {
      start = dayjs().subtract(1, 'month').startOf('day').toISOString();
    }

    let data: Record<string, unknown>[] = [];
    let filename = '';

    switch (type) {
      case 'restaurant': {
        const { data: orders, error } = await supabase
          .from('transactions')
          .select('order_number, status, amount, created_at, metadata')
          .eq('engine_type', 'instant_transaction')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (orders || []).map(o => ({
          'Order Number': o.order_number,
          'Status': o.status,
          'Total': o.amount,
          'Date': dayjs(o.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `restaurant-orders-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'chalets': {
        const { data: bookings, error } = await supabase
          .from('transactions')
          .select('booking_number, status, amount, created_at, metadata')
          .eq('engine_type', 'time_exclusive_reservation')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (bookings || []).map(b => ({
          'Booking Number': b.booking_number,
          'Status': b.status,
          'Total': b.amount,
          'Booked On': dayjs(b.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `chalet-bookings-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'pool': {
        const { data: tickets, error } = await supabase
          .from('transactions')
          .select('ticket_number, status, amount, created_at, metadata')
          .eq('engine_type', 'shared_capacity_access')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (tickets || []).map(t => ({
          'Ticket Number': t.ticket_number,
          'Status': t.status,
          'Total': t.amount,
          'Purchased': dayjs(t.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `pool-tickets-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'snack': {
        const { data: orders, error } = await supabase
          .from('transactions')
          .select('order_number, status, amount, created_at')
          .eq('engine_type', 'instant_transaction')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (orders || []).map(o => ({
          'Order Number': o.order_number,
          'Status': o.status,
          'Total': o.amount,
          'Date': dayjs(o.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `snack-orders-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'users': {
        const { data: users, error } = await supabase
          .from('users')
          .select('name, email, phone, created_at, last_login, is_active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (users || []).map(u => ({
          'Name': u.name,
          'Email': u.email,
          'Phone': u.phone || '',
          'Registered': dayjs(u.created_at).format('YYYY-MM-DD'),
          'Last Login': u.last_login ? dayjs(u.last_login).format('YYYY-MM-DD HH:mm') : 'Never',
          'Active': u.is_active ? 'Yes' : 'No',
        }));
        filename = `users-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(data);
    }

    // CSV format
    if (data.length === 0) {
      return res.status(200).json({ success: true, data: [], message: 'No data for the selected period' });
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')),
    ];
    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
});

// ============================================
// Notifications
// ============================================

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const userId = req.user?.userId;

    // Get recent orders, bookings, and system events as notifications
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const notifications: Array<{ id: string; title: string; message: string; time: string; read: boolean }> = [];

    // Get recent restaurant orders
    const { data: recentOrders } = await supabase
      .from('transactions')
      .select('id, order_number, status, created_at')
      .eq('engine_type', 'instant_transaction')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    (recentOrders || []).forEach(order => {
      const createdAt = new Date(order.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `order-${order.id}`,
        title: 'New Order',
        message: `Order #${order.order_number} - ${order.status}`,
        time: timeAgo,
        read: order.status !== 'pending',
      });
    });

    // Get recent chalet bookings
    const { data: recentBookings } = await supabase
      .from('transactions')
      .select('id, status, created_at, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    (recentBookings || []).forEach(booking => {
      const createdAt = new Date(booking.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `booking-${booking.id}`,
        title: 'Chalet Booking',
        message: `New booking — ${booking.status}`,
        time: timeAgo,
        read: booking.status !== 'pending',
      });
    });

    // Get pending reviews
    const { data: pendingReviews } = await supabase
      .from('reviews')
      .select('id, rating, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    (pendingReviews || []).forEach(review => {
      const createdAt = new Date(review.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `review-${review.id}`,
        title: 'Review Pending',
        message: `New ${review.rating}-star review awaiting approval`,
        time: timeAgo,
        read: false,
      });
    });

    // Sort by time (most recent first) and limit
    notifications.sort((a, b) => {
      const aTime = parseInt(a.time) || 0;
      const bTime = parseInt(b.time) || 0;
      return aTime - bTime;
    });

    res.json({ success: true, data: notifications.slice(0, 10) });
});

export const getOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    let start: dayjs.Dayjs;
    const end = dayjs().endOf('day');

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day');
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day');
    } else {
      start = dayjs().subtract(1, 'month').startOf('day');
    }

    const daysInRange = end.diff(start, 'day') + 1;

    // 1. Chalet Occupancy
    const [chaletsResult, bookingsResult] = await Promise.all([
      supabase.from('chalets').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
      supabase.from('transactions')
        .select('status, amount, metadata')
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
    ]);

    const totalChalets = chaletsResult.count || 0;
    const totalChaletCapacity = totalChalets * daysInRange;
    const activeBookings = (bookingsResult.data || []).filter(b => !['cancelled', 'no_show'].includes(b.status));
    const bookedNights = activeBookings.reduce((sum, b) => sum + ((b.metadata as any)?.number_of_nights || 1), 0);
    const chaletOccupancyRate = totalChaletCapacity > 0 ? (bookedNights / totalChaletCapacity) * 100 : 0;

    // 2. Pool Occupancy
    const [sessionsResult, ticketsResult] = await Promise.all([
      supabase.from('pool_sessions').select('max_capacity').eq('is_active', true),
      supabase.from('transactions')
        .select('status, amount, metadata')
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
    ]);

    const dailyPoolCapacity = (sessionsResult.data || []).reduce((sum, s) => sum + (s.max_capacity || 0), 0);
    const totalPoolCapacity = dailyPoolCapacity * daysInRange;
    const activeTickets = (ticketsResult.data || []).filter(t => !['cancelled', 'no_show'].includes(t.status));
    const ticketsSold = activeTickets.reduce((sum, t) => sum + ((t.metadata as any)?.number_of_guests || 1), 0);
    const poolOccupancyRate = totalPoolCapacity > 0 ? (ticketsSold / totalPoolCapacity) * 100 : 0;

    res.json({
      success: true,
      data: {
        chalets: {
          occupancyRate: Math.round(chaletOccupancyRate * 10) / 10,
          bookedNights,
          totalCapacity: totalChaletCapacity,
          activeUnits: totalChalets
        },
        pool: {
          occupancyRate: Math.round(poolOccupancyRate * 10) / 10,
          ticketsSold,
          totalCapacity: totalPoolCapacity,
          dailyCapacity: dailyPoolCapacity
        }
      }
    });
});

export const getCustomerAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    let start: dayjs.Dayjs;
    const end = dayjs().endOf('day');

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day');
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day');
    } else {
      start = dayjs().subtract(1, 'month').startOf('day');
    }

    // Fetch transactions — all are in the unified table now
    const [allTxResult] = await Promise.all([
      supabase.from('transactions')
        .select('customer_id, amount, status, created_at, customer_name')
        .not('customer_id', 'is', null)
        .not('status', 'in', '(cancelled,void)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .limit(2000)
    ]);

    const restOrders = { data: allTxResult.data || [] };
    const snackOrders = { data: [] as any[] };
    const chaletBookings = { data: [] as any[] };
    const poolTickets = { data: [] as any[] };

    const allTransactions = [
      ...(restOrders.data || []),
      ...(snackOrders.data || []),
      ...(chaletBookings.data || []),
      ...(poolTickets.data || [])
    ];

    // Group by customer
    const customerStats = new Map<string, { name: string, revenue: number, count: number, firstDate: string }>();

    allTransactions.forEach(t => {
      if (!t.customer_id) return;
      const stats = customerStats.get(t.customer_id) || { name: t.customer_name || 'Unknown', revenue: 0, count: 0, firstDate: t.created_at };
      const amount = parseFloat(t.amount || '0');
      stats.revenue += isNaN(amount) ? 0 : amount;
      stats.count += 1;
      if (t.created_at && (!stats.firstDate || dayjs(t.created_at).isBefore(dayjs(stats.firstDate)))) {
        stats.firstDate = t.created_at;
      }
      customerStats.set(t.customer_id, stats);
    });

    const customersInRange = Array.from(customerStats.entries()).map(([id, stats]) => ({ id, ...stats }));

    // Top Customers
    const topCustomers = [...customersInRange]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // New vs Returning logic for the selected range
    let newCustomers = 0;
    let returningCustomers = 0;

    customersInRange.forEach(c => {
      // Check if they had ANY transaction in the selected range
      const hasTransactionInRange = allTransactions.some(t => 
        t.customer_id === c.id && 
        t.created_at &&
        dayjs(t.created_at).isAfter(start) && 
        dayjs(t.created_at).isBefore(end)
      );

      if (hasTransactionInRange) {
        if (c.firstDate && dayjs(c.firstDate).isBefore(start)) {
          returningCustomers++;
        } else {
          newCustomers++;
        }
      }
    });

    res.json({
      success: true,
      data: {
        topCustomers,
        customerRetention: {
          new: newCustomers,
          returning: returningCustomers,
          total: newCustomers + returningCustomers,
          newRatio: returningCustomers + newCustomers > 0 ? Math.round((newCustomers / (newCustomers + returningCustomers)) * 100) : 0
        }
      }
    });
});
