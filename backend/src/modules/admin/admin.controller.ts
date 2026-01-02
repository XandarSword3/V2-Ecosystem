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
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString();
    const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').toISOString();
    const lastWeekStart = dayjs().subtract(7, 'day').startOf('day').toISOString();
    const lastWeekEnd = dayjs().subtract(7, 'day').endOf('day').toISOString();

    console.log('[ADMIN] Loading dashboard data...');

    // Today's stats - run queries in parallel
    const [
      restaurantOrdersResult,
      restaurantRevenueResult,
      snackOrdersResult,
      snackRevenueResult,
      chaletBookingsResult,
      chaletRevenueResult,
      poolTicketsResult,
      poolRevenueResult,
      usersResult,
      recentOrdersResult,
      // Yesterday's stats for comparison
      yesterdayOrdersResult,
      yesterdayRevenueResult,
      lastWeekBookingsResult,
      yesterdayTicketsResult
    ] = await Promise.all([
      // Restaurant orders count
      supabase.from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Restaurant revenue
      supabase.from('restaurant_orders')
        .select('total_amount')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      // Snack orders count
      supabase.from('snack_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Snack revenue
      supabase.from('snack_orders')
        .select('total_amount')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      // Chalet bookings count
      supabase.from('chalet_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('check_in_date', today)
        .lte('check_in_date', endOfDay),
      // Chalet revenue
      supabase.from('chalet_bookings')
        .select('total_amount')
        .gte('check_in_date', today)
        .lte('check_in_date', endOfDay)
        .eq('payment_status', 'paid'),
      // Pool tickets count
      supabase.from('pool_tickets')
        .select('id', { count: 'exact', head: true })
        .gte('ticket_date', today)
        .lte('ticket_date', endOfDay),
      // Pool revenue
      supabase.from('pool_tickets')
        .select('total_amount')
        .gte('ticket_date', today)
        .lte('ticket_date', endOfDay)
        .eq('payment_status', 'paid'),
      // Total users
      supabase.from('users')
        .select('id', { count: 'exact', head: true }),
      // Recent orders
      supabase.from('restaurant_orders')
        .select('id, order_number, customer_name, status, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      // Yesterday orders (restaurant + snack)
      supabase.from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday),
      // Yesterday revenue
      supabase.from('restaurant_orders')
        .select('total_amount')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .eq('payment_status', 'paid'),
      // Last week bookings
      supabase.from('chalet_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('check_in_date', lastWeekStart)
        .lte('check_in_date', lastWeekEnd),
      // Yesterday tickets
      supabase.from('pool_tickets')
        .select('id', { count: 'exact', head: true })
        .gte('ticket_date', yesterday)
        .lte('ticket_date', endOfYesterday)
    ]);

    // Calculate totals
    const restaurantRevenue = (restaurantRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0), 0
    );
    const snackRevenue = (snackRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0), 0
    );
    const chaletRevenue = (chaletRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0), 0
    );
    const poolRevenue = (poolRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0), 0
    );

    const totalOrders = (restaurantOrdersResult.count || 0) + (snackOrdersResult.count || 0);
    const totalRevenue = restaurantRevenue + snackRevenue + chaletRevenue + poolRevenue;
    
    // Yesterday's calculations
    const yesterdayOrders = yesterdayOrdersResult.count || 0;
    const yesterdayRevenue = (yesterdayRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0), 0
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

    console.log('[ADMIN] Dashboard loaded:', {
      todayOrders: totalOrders,
      todayRevenue: totalRevenue,
      todayBookings: chaletBookingsResult.count,
      todayTickets: poolTicketsResult.count,
      totalUsers: usersResult.count
    });

    res.json({
      success: true,
      data: {
        todayOrders: totalOrders,
        todayRevenue: totalRevenue,
        todayBookings: chaletBookingsResult.count || 0,
        todayTickets: poolTicketsResult.count || 0,
        totalUsers: usersResult.count || 0,
        recentOrders: recentOrdersResult.data || [],
        revenueByUnit: {
          restaurant: restaurantRevenue,
          snackBar: snackRevenue,
          chalets: chaletRevenue,
          pool: poolRevenue,
        },
        breakdown: {
          restaurantOrders: restaurantOrdersResult.count || 0,
          snackOrders: snackOrdersResult.count || 0,
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
  } catch (error) {
    console.error('[ADMIN] Dashboard error:', error);
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
    const usersWithRoles = await Promise.all(
      (usersList || []).map(async (user) => {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', user.id);
        
        return {
          ...user,
          roles: (userRoles || []).map((ur: any) => ur.roles?.name).filter(Boolean),
        };
      })
    );

    res.json({ success: true, data: usersWithRoles });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { email, password, full_name, phone, roles = ['customer'] } = req.body;
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, error: 'Email, password, and full name are required' });
    }
    
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
    const bcrypt = await import('bcryptjs');
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
    
    // Assign roles
    if (roles.length > 0) {
      const { data: roleRecords } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', roles);
      
      if (roleRecords && roleRecords.length > 0) {
        const roleInserts = roleRecords.map(role => ({
          user_id: user.id,
          role_id: role.id,
        }));
        
        await supabase.from('user_roles').insert(roleInserts);
      }
    }
    
    res.status(201).json({ success: true, data: { ...user, roles } });
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
    const supabase = getSupabase();
    
    // Get all settings from database
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('key, value');
    
    if (error) throw error;
    
    // Combine all settings into a flat object
    const combinedSettings: Record<string, any> = {};
    (settings || []).forEach(s => {
      if (typeof s.value === 'object') {
        Object.assign(combinedSettings, s.value);
      }
    });
    
    // If no settings in DB, return defaults
    if (Object.keys(combinedSettings).length === 0) {
      res.json({
        success: true,
        data: {
          resortName: 'V2 Resort',
          tagline: "Lebanon's Premier Resort Experience",
          description: 'Your premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.',
          phone: '+961 XX XXX XXX',
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
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const settings = req.body;
    const userId = req.user?.userId;
    
    // Group settings by category for database update
    const generalSettings = {
      resortName: settings.resortName,
      tagline: settings.tagline,
      description: settings.description,
    };
    
    const contactSettings = {
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
    };
    
    const hoursSettings = {
      poolHours: settings.poolHours,
      restaurantHours: settings.restaurantHours,
      receptionHours: settings.receptionHours,
    };
    
    const chaletSettings = {
      checkIn: settings.chaletCheckIn,
      checkOut: settings.chaletCheckOut,
      depositPercent: settings.chaletDeposit,
      cancellationPolicy: settings.cancellationPolicy,
    };
    
    const poolSettings = {
      adultPrice: settings.poolAdultPrice,
      childPrice: settings.poolChildPrice,
      infantPrice: settings.poolInfantPrice,
      capacity: settings.poolCapacity,
    };
    
    const legalSettings = {
      privacyPolicy: settings.privacyPolicy,
      termsOfService: settings.termsOfService,
      refundPolicy: settings.refundPolicy,
    };
    
    // Upsert each settings category
    const updates = [
      { key: 'general', value: generalSettings },
      { key: 'contact', value: contactSettings },
      { key: 'hours', value: hoursSettings },
      { key: 'chalets', value: chaletSettings },
      { key: 'pool', value: poolSettings },
      { key: 'legal', value: legalSettings },
    ];
    
    for (const update of updates) {
      await supabase
        .from('site_settings')
        .upsert({
          key: update.key,
          value: update.value,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }, { onConflict: 'key' });
    }
    
    res.json({ success: true, message: 'Settings saved successfully' });
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
    const { range = 'month' } = req.query;
    
    // Calculate date range based on range parameter
    let start: string;
    let end: string = dayjs().endOf('day').toISOString();
    
    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day').toISOString();
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day').toISOString();
    } else {
      start = dayjs().subtract(1, 'month').startOf('day').toISOString();
    }

    // Get all orders/bookings in period - run queries in parallel
    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult,
      usersResult
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
        .lte('created_at', end),
      supabase.from('users')
        .select('id', { count: 'exact', head: true })
    ]);

    const restaurantOrdersList = restaurantResult.data || [];
    const snackOrdersList = snackResult.data || [];
    const chaletBookingsList = chaletResult.data || [];
    const poolTicketsList = poolResult.data || [];
    const totalUsers = usersResult.count || 0;

    // Calculate revenues
    const restaurantRevenue = restaurantOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const snackRevenue = snackOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const chaletRevenue = chaletBookingsList
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
    const poolRevenue = poolTicketsList
      .filter(t => t.payment_status === 'paid')
      .reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0);

    const totalRevenue = restaurantRevenue + snackRevenue + chaletRevenue + poolRevenue;
    const totalOrders = restaurantOrdersList.length + snackOrdersList.length;
    const totalBookings = chaletBookingsList.length + poolTicketsList.length;

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalOrders,
          totalBookings,
          totalUsers,
          revenueChange: 0, // Would need previous period data
          ordersChange: 0,
        },
        revenueByService: {
          restaurant: restaurantRevenue,
          snackBar: snackRevenue,
          chalets: chaletRevenue,
          pool: poolRevenue,
        },
        revenueByMonth: [], // Would need to aggregate by month
        topItems: [], // Would need to join with order items
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

// ============================================
// Notifications
// ============================================

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const userId = req.user?.userId;
    
    // Get recent orders, bookings, and system events as notifications
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const notifications: Array<{id: string; title: string; message: string; time: string; read: boolean}> = [];
    
    // Get recent restaurant orders
    const { data: recentOrders } = await supabase
      .from('restaurant_orders')
      .select('id, order_number, status, created_at')
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
      .from('chalet_bookings')
      .select('id, chalet_id, check_in_date, status, created_at')
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
        message: `New booking for ${booking.check_in_date}`,
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
  } catch (error) {
    next(error);
  }
}
