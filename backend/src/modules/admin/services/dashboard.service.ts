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
  revenueByEngine: Record<string, number>;
  todayStats: {
    transactionCountByEngine: Record<string, number>;
    revenueByEngine: Record<string, number>;
  };
}

interface RevenueDataPoint {
  date: string;
  revenueByEngine: Record<string, number>;
  total: number;
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

  async getDashboardStats(propertyId?: string): Promise<DashboardStats> {
    const today = dayjs().startOf('day').toISOString();
    const endOfDay = dayjs().endOf('day').toISOString();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString();
    const endOfYesterday = dayjs().subtract(1, 'day').endOf('day').toISOString();
    const lastWeekStart = dayjs().subtract(7, 'day').startOf('day').toISOString();
    const lastWeekEnd = dayjs().subtract(7, 'day').endOf('day').toISOString();

    // Single queries against transactions table
    const pFilter = propertyId || '';
    const [todayTxRes, yesterdayTxRes, lastWeekBookingsRes, yesterdayGuestsRes] = await Promise.all([
      this.supabase.from('transactions')
        .select('engine_type, amount')
        .gte('created_at', today)
        .lte('created_at', endOfDay)
        .neq('status', 'cancelled')
        .eq('property_id', pFilter),
      this.supabase.from('transactions')
        .select('engine_type, amount')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .neq('status', 'cancelled')
        .eq('property_id', pFilter),
      this.supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'time_exclusive_reservation')
        .gte('created_at', lastWeekStart)
        .lte('created_at', lastWeekEnd)
        .neq('status', 'cancelled')
        .eq('property_id', pFilter),
      this.supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('engine_type', 'shared_capacity_access')
        .gte('created_at', yesterday)
        .lte('created_at', endOfYesterday)
        .neq('status', 'cancelled')
        .eq('property_id', pFilter)
    ]);

    const todayTx = todayTxRes.data || [];
    const yesterdayTx = yesterdayTxRes.data || [];

    // Aggregate by engine type
    const revenueByEngine: Record<string, number> = {};
    const txCountByEngine: Record<string, number> = {};
    for (const tx of todayTx) {
      const engine = tx.engine_type;
      revenueByEngine[engine] = (revenueByEngine[engine] || 0) + (Number(tx.amount) || 0);
      txCountByEngine[engine] = (txCountByEngine[engine] || 0) + 1;
    }

    const yesterdayRevenueByEngine: Record<string, number> = {};
    const yesterdayTxCountByEngine: Record<string, number> = {};
    for (const tx of yesterdayTx) {
      const engine = tx.engine_type;
      yesterdayRevenueByEngine[engine] = (yesterdayRevenueByEngine[engine] || 0) + (Number(tx.amount) || 0);
      yesterdayTxCountByEngine[engine] = (yesterdayTxCountByEngine[engine] || 0) + 1;
    }

    const todayOrders = Object.values(txCountByEngine).reduce((s, c) => s + c, 0);
    const todayRevenue = Object.values(revenueByEngine).reduce((s, r) => s + r, 0);
    const yesterdayOrders = Object.values(yesterdayTxCountByEngine).reduce((s, c) => s + c, 0);
    const yesterdayRevenue = Object.values(yesterdayRevenueByEngine).reduce((s, r) => s + r, 0);
    const lastWeekBookings = lastWeekBookingsRes.count || 0;
    const yesterdayGuests = yesterdayGuestsRes.count || 0;

    const ordersChange = yesterdayOrders > 0
      ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100)
      : 0;
    const revenueChange = yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : 0;
    const bookingsChange = lastWeekBookings > 0
      ? Math.round((((txCountByEngine['time_exclusive_reservation'] || 0) - lastWeekBookings) / lastWeekBookings) * 100)
      : 0;
    const guestsChange = yesterdayGuests > 0
      ? Math.round((((txCountByEngine['shared_capacity_access'] || 0) - yesterdayGuests) / yesterdayGuests) * 100)
      : 0;

    return {
      totalOrders: todayOrders,
      totalRevenue: todayRevenue,
      totalBookings: txCountByEngine['time_exclusive_reservation'] || 0,
      totalGuests: txCountByEngine['shared_capacity_access'] || 0,
      ordersChange,
      revenueChange,
      bookingsChange,
      guestsChange,
      revenueByEngine,
      todayStats: {
        transactionCountByEngine: txCountByEngine,
        revenueByEngine
      }
    };
  }

  async getRecentOrders(limit = 10): Promise<RecentOrder[]> {
    const { data } = await this.supabase
      .from('transactions')
      .select('id, reference_table, status, amount, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);

    return ((data || []) as Array<{ id: string; reference_table: string; status: string; amount: number; created_at: string; metadata: Record<string, any> }>).map(tx => ({
      id: tx.id,
      order_number: tx.metadata?.order_number || tx.metadata?.booking_number || tx.metadata?.ticket_number || tx.id.slice(0, 8),
      customer_name: tx.metadata?.customer_name || '',
      status: tx.status,
      total_amount: tx.amount,
      created_at: tx.created_at,
      itemCount: 0
    }));
  }

  async getRevenueByPeriod(startDate: string, endDate: string, granularity: 'day' | 'week' | 'month' = 'day', propertyId?: string): Promise<RevenueDataPoint[]> {
    let query = this.supabase.from('transactions')
      .select('engine_type, amount, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .neq('status', 'cancelled');
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data } = await query;

    const revenueMap = new Map<string, RevenueDataPoint>();

    const getDateKey = (date: string): string => {
      const d = dayjs(date);
      switch (granularity) {
        case 'week': return d.startOf('week').format('YYYY-MM-DD');
        case 'month': return d.startOf('month').format('YYYY-MM');
        default: return d.format('YYYY-MM-DD');
      }
    };

    for (const tx of (data || [])) {
      const key = getDateKey(tx.created_at);
      const existing = revenueMap.get(key) || { date: key, revenueByEngine: {}, total: 0 };
      existing.revenueByEngine[tx.engine_type] = (existing.revenueByEngine[tx.engine_type] || 0) + (Number(tx.amount) || 0);
      existing.total += Number(tx.amount) || 0;
      revenueMap.set(key, existing);
    }

    return Array.from(revenueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const dashboardService = new DashboardService();
