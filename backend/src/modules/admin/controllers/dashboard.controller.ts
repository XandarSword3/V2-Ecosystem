/**
 * Dashboard Controller
 * 
 * Handles dashboard statistics, revenue stats, and overview reports.
 * Extracted from admin.controller.ts for better maintainability.
 */

import { Request, Response, NextFunction } from 'express';
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
  order_number: string;
  customer_name?: string | null;
  status: string;
  total_amount: string;
  created_at: string;
  items?: Array<{ id: string }>;
}

/**
 * GET /api/admin/dashboard
 * Get comprehensive dashboard statistics
 */
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
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
      // Recent orders (with item count)
      supabase.from('restaurant_orders')
        .select('id, order_number, customer_name, status, total_amount, created_at, items:restaurant_order_items(id)')
        .order('created_at', { ascending: false })
        .limit(5),
      // Yesterday orders
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
    const recentOrders: RecentOrderSummary[] = ((recentOrdersResult.data || []) as RecentOrderQuery[]).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name || 'Guest',
      status: order.status,
      totalAmount: order.total_amount,
      itemCount: order.items?.length || 0,
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
    logger.error('[ADMIN] Dashboard error:', error);
    next(error);
  }
}

/**
 * GET /api/admin/revenue-stats
 * Get revenue statistics for a date range
 */
export async function getRevenueStats(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { startDate, endDate } = req.query;
    
    const start = startDate ? dayjs(startDate as string).toISOString() : dayjs().subtract(30, 'day').toISOString();
    const end = endDate ? dayjs(endDate as string).toISOString() : dayjs().toISOString();

    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult
    ] = await Promise.all([
      supabase.from('restaurant_orders')
        .select('total_amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('payment_status', 'paid'),
      supabase.from('snack_orders')
        .select('total_amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('payment_status', 'paid'),
      supabase.from('chalet_bookings')
        .select('total_amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('payment_status', 'paid'),
      supabase.from('pool_tickets')
        .select('total_amount, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('payment_status', 'paid')
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
  } catch (error) {
    next(error);
  }
}
