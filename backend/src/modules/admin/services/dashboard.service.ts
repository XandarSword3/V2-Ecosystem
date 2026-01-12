import { getSupabase } from '../../../database/connection.js';
import dayjs from 'dayjs';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalBookings: number;
  totalGuests: number;
  ordersChange: number;
  revenueChange: number;
  bookingsChange: number;
  guestsChange: number;
  restaurantRevenue: number;
  snackRevenue: number;
  chaletRevenue: number;
  poolRevenue: number;
  todayStats: {
    restaurantOrders: number;
    snackOrders: number;
    chaletBookings: number;
    poolTickets: number;
    restaurantRevenue: number;
    snackRevenue: number;
    chaletRevenue: number;
    poolRevenue: number;
  };
}

interface RevenueDataPoint {
  date: string;
  restaurant: number;
  snack: number;
  chalet: number;
  pool: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  itemCount: number;
}

export class DashboardService {
  private supabase = getSupabase();

  async getDashboardStats(): Promise<DashboardStats> {
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString();
    const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').toISOString();
    const lastWeekStart = dayjs().subtract(7, 'day').startOf('day').toISOString();
    const lastWeekEnd = dayjs().subtract(7, 'day').endOf('day').toISOString();

    const [
      restaurantOrdersResult,
      restaurantRevenueResult,
      snackOrdersResult,
      snackRevenueResult,
      chaletBookingsResult,
      chaletRevenueResult,
      poolTicketsResult,
      poolRevenueResult,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _usersResult,
      yesterdayOrdersResult,
      yesterdayRevenueResult,
      lastWeekBookingsResult,
      yesterdayTicketsResult
    ] = await Promise.all([
      this.supabase.from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      this.supabase.from('restaurant_orders')
        .select('total_amount')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      this.supabase.from('snack_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
        .lte('created_at', endOfDay),
      this.supabase.from('snack_orders')
        .select('total_amount')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .eq('payment_status', 'paid'),
      this.supabase.from('chalet_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('check_in_date', today)
        .lte('check_in_date', endOfDay),
      this.supabase.from('chalet_bookings')
        .select('total_amount')
        .gte('check_in_date', today)
        .lte('check_in_date', endOfDay)
        .eq('payment_status', 'paid'),
      this.supabase.from('pool_tickets')
        .select('id', { count: 'exact', head: true })
        .gte('ticket_date', today)
        .lte('ticket_date', endOfDay),
      this.supabase.from('pool_tickets')
        .select('total_amount')
        .gte('ticket_date', today)
        .lte('ticket_date', endOfDay)
        .eq('payment_status', 'paid'),
      this.supabase.from('users')
        .select('id', { count: 'exact', head: true }),
      this.supabase.from('restaurant_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday),
      this.supabase.from('restaurant_orders')
        .select('total_amount')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .eq('payment_status', 'paid'),
      this.supabase.from('chalet_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('check_in_date', lastWeekStart)
        .lte('check_in_date', lastWeekEnd),
      this.supabase.from('pool_tickets')
        .select('id', { count: 'exact', head: true })
        .gte('ticket_date', yesterday)
        .lte('ticket_date', endOfYesterday)
    ]);

    interface AmountRow { total_amount: number | null }
    const restaurantRevenue = (restaurantRevenueResult.data as AmountRow[] || [])
      .reduce((sum: number, o) => sum + (Number(o.total_amount) || 0), 0);
    const snackRevenue = (snackRevenueResult.data as AmountRow[] || [])
      .reduce((sum: number, o) => sum + (Number(o.total_amount) || 0), 0);
    const chaletRevenue = (chaletRevenueResult.data as AmountRow[] || [])
      .reduce((sum: number, b) => sum + (Number(b.total_amount) || 0), 0);
    const poolRevenue = (poolRevenueResult.data as AmountRow[] || [])
      .reduce((sum: number, t) => sum + (Number(t.total_amount) || 0), 0);

    const todayOrders = (restaurantOrdersResult.count || 0) + (snackOrdersResult.count || 0);
    const todayRevenue = restaurantRevenue + snackRevenue + chaletRevenue + poolRevenue;

    const yesterdayOrders = yesterdayOrdersResult.count || 0;
    const yesterdayRevenue = (yesterdayRevenueResult.data as AmountRow[] || [])
      .reduce((sum: number, o) => sum + (Number(o.total_amount) || 0), 0);
    const lastWeekBookings = lastWeekBookingsResult.count || 0;
    const yesterdayTickets = yesterdayTicketsResult.count || 0;

    const ordersChange = yesterdayOrders > 0 
      ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100) 
      : 0;
    const revenueChange = yesterdayRevenue > 0 
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) 
      : 0;
    const bookingsChange = lastWeekBookings > 0 
      ? Math.round((((chaletBookingsResult.count || 0) - lastWeekBookings) / lastWeekBookings) * 100) 
      : 0;
    const guestsChange = yesterdayTickets > 0 
      ? Math.round((((poolTicketsResult.count || 0) - yesterdayTickets) / yesterdayTickets) * 100) 
      : 0;

    return {
      totalOrders: todayOrders,
      totalRevenue: todayRevenue,
      totalBookings: chaletBookingsResult.count || 0,
      totalGuests: poolTicketsResult.count || 0,
      ordersChange,
      revenueChange,
      bookingsChange,
      guestsChange,
      restaurantRevenue,
      snackRevenue,
      chaletRevenue,
      poolRevenue,
      todayStats: {
        restaurantOrders: restaurantOrdersResult.count || 0,
        snackOrders: snackOrdersResult.count || 0,
        chaletBookings: chaletBookingsResult.count || 0,
        poolTickets: poolTicketsResult.count || 0,
        restaurantRevenue,
        snackRevenue,
        chaletRevenue,
        poolRevenue
      }
    };
  }

  async getRecentOrders(limit = 10): Promise<RecentOrder[]> {
    const { data } = await this.supabase
      .from('restaurant_orders')
      .select('id, order_number, customer_name, status, total_amount, created_at, items:restaurant_order_items(id)')
      .order('created_at', { ascending: false })
      .limit(limit);

    interface OrderWithItems {
      id: string;
      order_number: string;
      customer_name: string;
      status: string;
      total_amount: number;
      created_at: string;
      items?: Array<{ id: string }>;
    }

    return ((data || []) as OrderWithItems[]).map(order => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      itemCount: order.items?.length || 0
    }));
  }

  async getRevenueByPeriod(startDate: string, endDate: string, granularity: 'day' | 'week' | 'month' = 'day'): Promise<RevenueDataPoint[]> {
    const [restaurantData, snackData, chaletData, poolData] = await Promise.all([
      this.supabase.from('restaurant_orders')
        .select('created_at, total_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('payment_status', 'paid'),
      this.supabase.from('snack_orders')
        .select('created_at, total_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('payment_status', 'paid'),
      this.supabase.from('chalet_bookings')
        .select('check_in_date, total_amount')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)
        .eq('payment_status', 'paid'),
      this.supabase.from('pool_tickets')
        .select('ticket_date, total_amount')
        .gte('ticket_date', startDate)
        .lte('ticket_date', endDate)
        .eq('payment_status', 'paid')
    ]);

    // Group by date
    const revenueMap = new Map<string, RevenueDataPoint>();
    
    interface DateAmount { created_at?: string; check_in_date?: string; ticket_date?: string; total_amount: number }
    
    const getDateKey = (date: string): string => {
      const d = dayjs(date);
      switch (granularity) {
        case 'week': return d.startOf('week').format('YYYY-MM-DD');
        case 'month': return d.startOf('month').format('YYYY-MM');
        default: return d.format('YYYY-MM-DD');
      }
    };

    ((restaurantData.data || []) as DateAmount[]).forEach(item => {
      const key = getDateKey(item.created_at || '');
      const existing = revenueMap.get(key) || { date: key, restaurant: 0, snack: 0, chalet: 0, pool: 0 };
      existing.restaurant += Number(item.total_amount) || 0;
      revenueMap.set(key, existing);
    });

    ((snackData.data || []) as DateAmount[]).forEach(item => {
      const key = getDateKey(item.created_at || '');
      const existing = revenueMap.get(key) || { date: key, restaurant: 0, snack: 0, chalet: 0, pool: 0 };
      existing.snack += Number(item.total_amount) || 0;
      revenueMap.set(key, existing);
    });

    ((chaletData.data || []) as DateAmount[]).forEach(item => {
      const key = getDateKey(item.check_in_date || '');
      const existing = revenueMap.get(key) || { date: key, restaurant: 0, snack: 0, chalet: 0, pool: 0 };
      existing.chalet += Number(item.total_amount) || 0;
      revenueMap.set(key, existing);
    });

    ((poolData.data || []) as DateAmount[]).forEach(item => {
      const key = getDateKey(item.ticket_date || '');
      const existing = revenueMap.get(key) || { date: key, restaurant: 0, snack: 0, chalet: 0, pool: 0 };
      existing.pool += Number(item.total_amount) || 0;
      revenueMap.set(key, existing);
    });

    return Array.from(revenueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const dashboardService = new DashboardService();
