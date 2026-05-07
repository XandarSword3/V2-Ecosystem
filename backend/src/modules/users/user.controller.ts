/**
 * User Controller
 * 
 * Handles user profile management and admin user operations.
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';
import { logActivity } from '../../utils/activityLogger.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().regex(/^\+?[0-9\s\-()]{7,20}$/).nullable()
  ).optional(),
  preferred_language: z.enum(['en', 'ar', 'fr', 'de', 'it']).optional()
});

const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role is required')
});

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  profile_image_url: string | null;
  preferred_language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  roles: string[];
}

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const supabase = getSupabase();
    
    // Fetch user data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, phone, profile_image_url, preferred_language, 
        is_active, created_at, updated_at
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Fetch user roles separately
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', userId);

    // Extract role names
    interface RoleData { name: string }
    const roles = (userRoles || [])
      .map((ur: { role?: RoleData | RoleData[] | null }) => {
        const role = Array.isArray(ur.role) ? ur.role[0] : ur.role;
        return role?.name;
      })
      .filter((name: string | undefined): name is string => Boolean(name)) || [];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        profile_image_url: user.profile_image_url,
        preferred_language: user.preferred_language,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles
      }
    });
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.errors 
      });
      return;
    }

    const updateData = validation.data;
    
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    const supabase = getSupabase();
    
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, full_name, phone, profile_image_url, preferred_language')
      .single();

    if (error) {
      logger.error('Error updating profile:', error);
      res.status(500).json({ success: false, error: 'Failed to update profile' });
      return;
    }

    await logActivity({
      user_id: userId,
      action: 'UPDATE_PROFILE',
      resource: 'users',
      entity_id: userId,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      new_value: updateData
    });

    res.json({ success: true, data: updated, message: 'Profile updated successfully' });
});

/**
 * GET /api/users (Admin only)
 * List all users with pagination
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(`
        id, email, full_name, phone, profile_image_url, is_active, created_at, updated_at
      `, { count: 'exact' });

    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = String(search)
        .replace(/[%_\\]/g, '\\$&')  // Escape SQL wildcards
        .replace(/['";]/g, '')           // Remove quotes and semicolons
        .slice(0, 100);                   // Limit length
      query = query.or(`email.ilike.%${sanitizedSearch}%,full_name.ilike.%${sanitizedSearch}%`);
    }

    const { data: users, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error listing users:', error);
      res.status(500).json({ success: false, error: 'Failed to list users' });
      return;
    }

    // Return users without roles for list view (roles available in detail view)
    const processedUsers = (users || []).map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      profile_image_url: user.profile_image_url,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: [] as string[]
    }));

    res.json({
      success: true,
      data: processedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
});

/**
 * GET /api/users/:id (Admin only)
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, error: 'Invalid user ID format' });
      return;
    }

    const supabase = getSupabase();
    
    // Fetch user data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, phone, profile_image_url, preferred_language,
        is_active, created_at, updated_at, last_login_at
      `)
      .eq('id', id)
      .single();

    if (error || !user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Fetch user roles separately
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role:roles(id, name, display_name)')
      .eq('user_id', id);

    // Extract roles
    interface RoleData { id: string; name: string; display_name: string }
    const roles = (userRoles || [])
      .map((ur: { role?: RoleData | RoleData[] | null }) => {
        const role = Array.isArray(ur.role) ? ur.role[0] : ur.role;
        return role ? { id: role.id, name: role.name, displayName: role.display_name } : null;
      })
      .filter(Boolean) || [];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        profile_image_url: user.profile_image_url,
        preferred_language: user.preferred_language,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
        roles
      }
    });
});

/**
 * PUT /api/users/:id/roles (Super Admin only)
 * Update user roles
 */
export const updateUserRoles = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ success: false, error: 'Invalid user ID format' });
      return;
    }

    const validation = updateUserRolesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.errors 
      });
      return;
    }

    const { roleIds } = validation.data;
    const supabase = getSupabase();

    // Check user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (userError || !user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Verify all role IDs are valid
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);

    if (rolesError || !roles || roles.length !== roleIds.length) {
      res.status(400).json({ success: false, error: 'One or more invalid role IDs' });
      return;
    }

    // Get old roles for activity log
    const { data: oldRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', id);

    // Delete existing roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', id);

    // Insert new roles
    const roleAssignments = roleIds.map(roleId => ({
      user_id: id,
      role_id: roleId
    }));

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(roleAssignments);

    if (insertError) {
      logger.error('Error updating user roles:', insertError);
      res.status(500).json({ success: false, error: 'Failed to update roles' });
      return;
    }

    await logActivity({
      user_id: req.user!.userId,
      action: 'UPDATE_USER_ROLES',
      resource: 'users',
      entity_id: id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      old_value: { roles: oldRoles?.map(r => {
        const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
        return (role as { name?: string } | null)?.name;
      }) },
      new_value: { roles: roles.map(r => r.name) }
    });

    res.json({ 
      success: true, 
      message: 'Roles updated successfully',
      data: { roles: roles.map(r => r.name) }
    });
});

export const getMyStatement = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { from, to } = req.query as { from?: string; to?: string };
    const supabase = getSupabase();
    type DateFilterQuery<T> = {
      gte: (column: string, value: string) => T;
      lte: (column: string, value: string) => T;
    };
    const applyDateFilters = <T extends DateFilterQuery<T>>(query: T) => {
      let q = query;
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      return q;
    };

    const [transactions, loyalty, giftcards] = await Promise.all([
      applyDateFilters(supabase
        .from('transactions')
        .select('id,engine_type,amount,status,created_at,order_number,ticket_number,booking_number,reference_id,reference_table,customer_name,customer_phone,table_id,session_id,chalet_id,staff_id')
        .eq('customer_id', userId)
        .in('engine_type', ['instant_transaction', 'shared_capacity_access', 'time_exclusive_reservation'])),
      applyDateFilters(supabase.from('loyalty_transactions').select('id,points,type,created_at,reference_id,reference_type').eq('user_id', userId)),
      applyDateFilters(supabase.from('gift_card_transactions').select('id,amount,created_at').eq('user_id', userId)),
    ]);

    const rows = [
      ...(transactions.data || []).map((row: any) => ({ 
        type: row.engine_type === 'instant_transaction' ? 'restaurant_order' : 
              row.engine_type === 'shared_capacity_access' ? 'pool_ticket' : 
              row.engine_type === 'time_exclusive_reservation' ? 'chalet_booking' : 'transaction',
        ...row 
      })),
      ...(loyalty.data || []).map((row: any) => ({ type: 'loyalty_transaction', ...row })),
      ...(giftcards.data || []).map((row: any) => ({ type: 'gift_card_transaction', ...row })),
    ].sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

    res.json({ success: true, data: rows });
});
