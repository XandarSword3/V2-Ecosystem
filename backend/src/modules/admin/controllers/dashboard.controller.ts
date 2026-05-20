/**
 * Dashboard Controller
 * 
 * Handles dashboard statistics, revenue stats, and overview reports.
 * Extracted from admin.controller.ts for better maintainability.
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { logger } from '../../../utils/logger.js';
import dayjs from 'dayjs';
import { 
  DashboardStats, 
  RecentOrderSummary, 
  RestaurantOrderRow,
  sumAmounts, 
  calculateTrend 
} from '../types';

interface AmountRecord {
  total_amount?: string | null;
}

interface RecentOrderQuery {
  id: string;
  order_number?: string;
  customer_name?: string | null;
  status: string;
  total_amount: string;
  created_at: string;
  items?: Array<{ id: string }>;
  metadata?: any;
}

/**
 * GET /api/admin/dashboard
 * Get comprehensive dashboard statistics
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId && process.env.NODE_ENV !== 'test') {
        res.status(400).json({ success: false, error: 'Property ID context is required' });
        return;
    }

    const supabase = getSupabase();
    
    // Fetch active modules first to map slugs to IDs
    const { data: modulesList } = await supabase.from('modules').select('id, slug').eq('property_id', propertyId);
    const modulesMap = new Map((modulesList || []).map(m => [m.slug, m.id]));
    const restaurantModuleId = modulesMap.get('restaurant') || '00000000-0000-0000-0000-000000000000';
    const snackModuleId = modulesMap.get('snack-bar') || '00000000-0000-0000-0000-000000000000';

    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString();
    const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').toISOString();
    const lastWeekStart = dayjs().subtract(7, 'day').startOf('day').toISOString();
    const lastWeekEnd = dayjs().subtract(7, 'day').endOf('day').toISOString();

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
      yesterdayOrdersResult,
      yesterdayRevenueResult,
      lastWeekBookingsResult,
      yesterdayTicketsResult
    ] = await Promise.all([
      // Restaurant orders count
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('module_id', restaurantModuleId)
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Restaurant revenue
      supabase.from('transactions')
        .select('total_amount:amount')
        .eq('property_id', propertyId)
        .eq('module_id', restaurantModuleId)
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('status', 'completed'),
      // Snack orders count
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('module_id', snackModuleId)
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Snack revenue
      supabase.from('transactions')
        .select('total_amount:amount')
        .eq('property_id', propertyId)
        .eq('module_id', snackModuleId)
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('status', 'completed'),
      // Chalet bookings count
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Chalet revenue
      supabase.from('transactions')
        .select('total_amount:amount')
        .eq('property_id', propertyId)
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('status', 'completed'),
      // Pool tickets count
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      // Pool revenue
      supabase.from('transactions')
        .select('total_amount:amount')
        .eq('property_id', propertyId)
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('status', 'completed'),
      // Total users associated with this property
      supabase.from('user_property_access')
        .select('user_id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
      // Recent orders (from transactions)
      supabase.from('transactions')
        .select('id, status, total_amount:amount, created_at, metadata')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(5),
      // Yesterday orders
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('module_id', restaurantModuleId)
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday),
      // Yesterday revenue
      supabase.from('transactions')
        .select('total_amount:amount')
        .eq('property_id', propertyId)
        .eq('module_id', restaurantModuleId)
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .eq('status', 'completed'),
      // Last week bookings
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', lastWeekStart)
        .lte('created_at', lastWeekEnd),
      // Yesterday tickets
      supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
    ]);

    // Calculate totals using type-safe function
    const restaurantRevenue = sumAmounts((restaurantRevenueResult.data || []) as AmountRecord[]);
    const snackRevenue = sumAmounts((snackRevenueResult.data || []) as AmountRecord[]);
    const chaletRevenue = sumAmounts((chaletRevenueResult.data || []) as AmountRecord[]);
    const poolRevenue = sumAmounts((poolRevenueResult.data || []) as AmountRecord[]);

    const totalOrders = (restaurantOrdersResult.count || 0) + (snackOrdersResult.count || 0);
    const totalRevenue = restaurantRevenue + snackRevenue + chaletRevenue + poolRevenue;

    // Yesterday's calculations
    const yesterdayOrders = yesterdayOrdersResult.count || 0;
    const yesterdayRevenue = sumAmounts((yesterdayRevenueResult.data || []) as AmountRecord[]);
    const lastWeekBookings = lastWeekBookingsResult.count || 0;
    const yesterdayTickets = yesterdayTicketsResult.count || 0;

    // Calculate trends
    const ordersTrend = calculateTrend(totalOrders, yesterdayOrders);
    const revenueTrend = calculateTrend(totalRevenue, yesterdayRevenue);
    const bookingsTrend = calculateTrend(chaletBookingsResult.count || 0, lastWeekBookings);
    const ticketsTrend = calculateTrend(poolTicketsResult.count || 0, yesterdayTickets);

    // Transform recent orders to camelCase
    const recentOrders: RecentOrderSummary[] = ((recentOrdersResult.data || []) as RecentOrderQuery[]).map((order) => {
      const meta = order.metadata as any;
      const orderNumber = meta?.order_number || meta?.booking_number || meta?.ticket_number || '';
      return {
        id: order.id,
        orderNumber: orderNumber,
        customerName: order.customer_name || 'Guest',
        status: order.status,
        totalAmount: order.total_amount,
        itemCount: meta?.items?.length || 0,
        createdAt: order.created_at,
      };
    });

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
});

/**
 * GET /api/admin/revenue-stats
 * Get revenue statistics for a date range
 */
export const getRevenueStats = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId && process.env.NODE_ENV !== 'test') {
        res.status(400).json({ success: false, error: 'Property ID context is required' });
        return;
    }

    const supabase = getSupabase();
    const { startDate, endDate } = req.query;

    // Fetch active modules first to map slugs to IDs
    let modulesQuery = supabase.from('modules').select('id, slug');
    if (propertyId) {
        modulesQuery = modulesQuery.eq('property_id', propertyId);
    }
    const { data: modulesList } = await modulesQuery;
    const modulesMap = new Map((modulesList || []).map(m => [m.slug, m.id]));
    const restaurantModuleId = modulesMap.get('restaurant') || '00000000-0000-0000-0000-000000000000';
    const snackModuleId = modulesMap.get('snack-bar') || '00000000-0000-0000-0000-000000000000';
    
    const start = startDate ? dayjs(startDate as string).toISOString() : dayjs().subtract(30, 'day').toISOString();
    const end = endDate ? dayjs(endDate as string).toISOString() : dayjs().toISOString();

    const buildTransactionQuery = (moduleIdOrEngineType: { module_id?: string; engine_type?: string }) => {
      let q = supabase.from('transactions')
        .select('total_amount:amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('status', 'completed');
      
      if (propertyId) {
        q = q.eq('property_id', propertyId);
      }
      
      if (moduleIdOrEngineType.module_id) {
        q = q.eq('module_id', moduleIdOrEngineType.module_id);
      } else if (moduleIdOrEngineType.engine_type) {
        q = q.eq('engine_type', moduleIdOrEngineType.engine_type);
      }
      
      return q;
    };

    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult
    ] = await Promise.all([
      buildTransactionQuery({ module_id: restaurantModuleId }),
      buildTransactionQuery({ module_id: snackModuleId }),
      buildTransactionQuery({ engine_type: 'time_exclusive_reservation' }),
      buildTransactionQuery({ engine_type: 'shared_capacity_access' })
    ]);

    // Group by day
    interface DailyRevenue {
      restaurant: number;
      snack: number;
      chalets: number;
      pool: number;
      total: number;
    }
    
    const dailyRevenue: Record<string, DailyRevenue> = {};

    const addToDaily = (records: AmountRecord[] | null, key: keyof Omit<DailyRevenue, 'total'>, dateField: string) => {
      (records || []).forEach((r: AmountRecord & { created_at?: string }) => {
        const date = dayjs(r.created_at).format('YYYY-MM-DD');
        if (!dailyRevenue[date]) {
          dailyRevenue[date] = { restaurant: 0, snack: 0, chalets: 0, pool: 0, total: 0 };
        }
        const amount = parseFloat(r.total_amount || '0');
        dailyRevenue[date][key] += amount;
        dailyRevenue[date].total += amount;
      });
    };

    addToDaily(restaurantResult.data as (AmountRecord & { created_at?: string })[], 'restaurant', 'created_at');
    addToDaily(snackResult.data as (AmountRecord & { created_at?: string })[], 'snack', 'created_at');
    addToDaily(chaletResult.data as (AmountRecord & { created_at?: string })[], 'chalets', 'created_at');
    addToDaily(poolResult.data as (AmountRecord & { created_at?: string })[], 'pool', 'created_at');

    // Convert to array and sort by date
    const chartData = Object.entries(dailyRevenue)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = {
      restaurant: sumAmounts((restaurantResult.data || []) as AmountRecord[]),
      snack: sumAmounts((snackResult.data || []) as AmountRecord[]),
      chalets: sumAmounts((chaletResult.data || []) as AmountRecord[]),
      pool: sumAmounts((poolResult.data || []) as AmountRecord[]),
    };

    res.json({
      success: true,
      data: {
        chartData,
        totals,
        grandTotal: totals.restaurant + totals.snack + totals.chalets + totals.pool,
        dateRange: { start, end }
      }
    });
});
