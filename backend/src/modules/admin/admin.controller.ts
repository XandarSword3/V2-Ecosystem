import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection.js";
import dayjs from 'dayjs';

// ============================================
// Dashboard
// ============================================

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();

    // Today's stats - run queries in parallel
    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult,
      usersResult
    ] = await Promise.all([
      supabase.from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      supabase.from('snack_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      supabase.from('chalet_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      supabase.from('pool_tickets')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      supabase.from('users')
        .select('id', { count: 'exact', head: true })
    ]);

    res.json({
      success: true,
      data: {
        today: {
          restaurantOrders: restaurantResult.count || 0,
          snackOrders: snackResult.count || 0,
          chaletBookings: chaletResult.count || 0,
          poolTickets: poolResult.count || 0,
        },
        totalUsers: usersResult.count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getRevenueStats(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (error) {
    next(error);
  }
}

// ============================================
// Users
// ============================================

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('users')
      .select('id, email, full_name, phone, is_active, email_verified, last_login_at, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data: usersList, error } = await query;

    if (error) throw error;

    res.json({ success: true, data: usersList || [] });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      throw userError;
    }

    // Get roles
    const { data: userRolesList, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        roles (*)
      `)
      .eq('user_id', user.id);

    if (rolesError) throw rolesError;

    const { password_hash, ...safeUser } = user;

    res.json({ 
      success: true, 
      data: { 
        ...safeUser, 
        roles: (userRolesList || []).map(r => r.roles),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const updateData: Record<string, unknown> = { 
      updated_at: new Date().toISOString() 
    };
    
    if (req.body.fullName !== undefined) updateData.full_name = req.body.fullName;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;
    if (req.body.preferredLanguage !== undefined) updateData.preferred_language = req.body.preferredLanguage;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { roleIds } = req.body;
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

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Roles
// ============================================

export async function getRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: rolesList, error } = await supabase
      .from('roles')
      .select('*');

    if (error) throw error;

    res.json({ success: true, data: rolesList || [] });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: req.body.name,
        display_name: req.body.displayName,
        description: req.body.description,
        business_unit: req.body.businessUnit,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
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

    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Settings & Audit
// ============================================

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: Implement settings table
    res.json({
      success: true,
      data: {
        businessName: 'V2 Resort',
        currency: 'USD',
        taxRate: 0.11,
        timezone: 'Asia/Beirut',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: Implement settings update
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { limit = 50, offset = 0 } = req.query;

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({ success: true, data: logs || [] });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Reports
// ============================================

export async function getOverviewReport(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { startDate, endDate } = req.query;
    
    const start = startDate ? dayjs(startDate as string).toISOString() : dayjs().startOf('month').toISOString();
    const end = endDate ? dayjs(endDate as string).toISOString() : dayjs().endOf('month').toISOString();

    // Get all orders/bookings in period - run queries in parallel
    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult
    ] = await Promise.all([
      supabase.from('restaurant_orders')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('snack_orders')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('chalet_bookings')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('pool_tickets')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
    ]);

    const restaurantOrdersList = restaurantResult.data || [];
    const snackOrdersList = snackResult.data || [];
    const chaletBookingsList = chaletResult.data || [];
    const poolTicketsList = poolResult.data || [];

    res.json({
      success: true,
      data: {
        period: { start, end },
        restaurant: {
          totalOrders: restaurantOrdersList.length,
          completedOrders: restaurantOrdersList.filter(o => o.status === 'completed').length,
          revenue: restaurantOrdersList
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + parseFloat(o.total_amount), 0),
        },
        snackBar: {
          totalOrders: snackOrdersList.length,
          completedOrders: snackOrdersList.filter(o => o.status === 'completed').length,
          revenue: snackOrdersList
            .filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + parseFloat(o.total_amount), 0),
        },
        chalets: {
          totalBookings: chaletBookingsList.length,
          confirmedBookings: chaletBookingsList.filter(b => !['cancelled', 'no_show'].includes(b.status)).length,
          revenue: chaletBookingsList
            .filter(b => b.payment_status === 'paid')
            .reduce((sum, b) => sum + parseFloat(b.total_amount), 0),
        },
        pool: {
          totalTickets: poolTicketsList.length,
          usedTickets: poolTicketsList.filter(t => t.status === 'used').length,
          revenue: poolTicketsList
            .filter(t => t.payment_status === 'paid')
            .reduce((sum, t) => sum + parseFloat(t.total_amount), 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: Implement CSV/Excel export
    res.json({ success: false, error: 'Export not implemented yet' });
  } catch (error) {
    next(error);
  }
}
