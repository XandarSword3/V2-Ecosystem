/**
 * Admin Reports Controller
 * Provides simplified report endpoints for the admin dashboard
 */
import { Request, Response } from 'express';
import { getPool, getSupabase } from '../../../database/connection.js';
import { asyncHandler } from '../../../middleware/async-handler.js';
import dayjs from 'dayjs';

type PeriodAggregateRow = {
  count: string | number;
  revenue: string | number;
};

function toNumber(value: string | number | null | undefined): number {
  return Number(value || 0);
}

function getDateRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'month':
    default:
      start.setMonth(end.getMonth() - 1);
      break;
  }
  return { start, end };
}

function getPreviousDateRange(range: string): { start: Date; end: Date } {
  const current = getDateRange(range);
  const duration = current.end.getTime() - current.start.getTime();
  return {
    start: new Date(current.start.getTime() - duration),
    end: new Date(current.start.getTime())
  };
}

export const getOverviewReport = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const { start, end } = getDateRange(range);
  const prev = getPreviousDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const prevStartISO = prev.start.toISOString();
  const prevEndISO = prev.end.toISOString();

  try {
    const pool = getPool();

    const [currentRestaurant, currentChalets, currentPool, currentSnack, previousRestaurant, previousChalets, previousPool, previousSnack, monthlyRevenueRows, topItemsResult, usersResult] = await Promise.all([
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE reference_table = \'restaurant_orders\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE engine_type = \'time_exclusive_reservation\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE engine_type = \'shared_capacity_access\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE reference_table = \'snack_orders\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE reference_table = \'restaurant_orders\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE engine_type = \'time_exclusive_reservation\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE engine_type = \'shared_capacity_access\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE reference_table = \'snack_orders\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO]
      ),
      pool.query<{ month_key: string; revenue: string }>(`
        WITH all_items AS (
          SELECT date_trunc('month', created_at) AS month_start, amount
          FROM transactions
          WHERE created_at BETWEEN $1 AND $2
        )
        SELECT to_char(month_start, 'YYYY-MM') AS month_key, COALESCE(SUM(amount), 0) AS revenue
        FROM all_items
        GROUP BY month_start
        ORDER BY month_start
      `, [dayjs().subtract(5, 'month').startOf('month').toISOString(), endISO]),
      pool.query<{
        id: string;
        menu_item_id: string;
        quantity: number;
        unit_price: string;
        name: string | null;
      }>(`
        SELECT
          item->>'id' as id,
          item->>'menu_item_id' as menu_item_id,
          (item->>'quantity')::int as quantity,
          item->>'unit_price' as unit_price,
          item->>'name' as name
        FROM transactions,
        jsonb_array_elements(metadata->'items') as item
        WHERE engine_type = 'instant_transaction'
        ORDER BY (item->>'quantity')::int DESC
        LIMIT 5
      `),
      pool.query<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM users'),
    ]);

    const revenueByMonthMap = new Map(
      (monthlyRevenueRows.rows || []).map((row) => [row.month_key, toNumber(row.revenue)])
    );

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const month = dayjs().subtract(5 - index, 'month').startOf('month');
      const key = month.format('YYYY-MM');
      return {
        month: month.toDate().toLocaleDateString('en', { month: 'short', year: 'numeric' }),
        revenue: revenueByMonthMap.get(key) || 0,
      };
    });

    const restaurantRevenue = toNumber(currentRestaurant.rows[0]?.revenue);
    const chaletRevenue = toNumber(currentChalets.rows[0]?.revenue);
    const poolRevenue = toNumber(currentPool.rows[0]?.revenue);
    const snackRevenue = toNumber(currentSnack.rows[0]?.revenue);
    const totalRevenue = restaurantRevenue + chaletRevenue + poolRevenue + snackRevenue;
    const totalOrders = toNumber(currentRestaurant.rows[0]?.count) + toNumber(currentSnack.rows[0]?.count);
    const totalBookings = toNumber(currentChalets.rows[0]?.count) + toNumber(currentPool.rows[0]?.count);

    const prevRevenue = toNumber(previousRestaurant.rows[0]?.revenue) + toNumber(previousChalets.rows[0]?.revenue) + toNumber(previousPool.rows[0]?.revenue) + toNumber(previousSnack.rows[0]?.revenue);
    const prevOrders = toNumber(previousRestaurant.rows[0]?.count) + toNumber(previousSnack.rows[0]?.count);

    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

    const topItems = (topItemsResult.rows || []).map((item) => ({
      name: item.name || 'Unknown',
      quantity: item.quantity,
      revenue: toNumber(item.quantity) * toNumber(item.unit_price),
    }));

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalOrders,
          totalBookings,
          totalUsers: toNumber(usersResult.rows[0]?.count),
          revenueChange: Math.round(revenueChange * 10) / 10,
          ordersChange: Math.round(ordersChange * 10) / 10,
        },
        revenueByService: {
          restaurant: restaurantRevenue,
          snackBar: snackRevenue,
          chalets: chaletRevenue,
          pool: poolRevenue,
        },
        revenueByMonth,
        topItems,
      },
    });
    return;
  } catch {
    // Fall back to the existing Supabase client path when a direct pool is unavailable.
  }

  // Current period queries
  const [ordersRes, chaletBookingsRes, poolTicketsRes, snackOrdersRes, usersRes] = await Promise.all([
    supabase.from('transactions').select('id, amount, created_at').eq('reference_table', 'restaurant_orders').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('engine_type', 'shared_capacity_access').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('reference_table', 'snack_orders').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('users').select('id', { count: 'exact' }),
  ]);

  // Previous period for change calculation
  const [prevOrdersRes, prevChaletRes, prevPoolRes, prevSnackRes] = await Promise.all([
    supabase.from('transactions').select('id, amount').eq('reference_table', 'restaurant_orders').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('engine_type', 'time_exclusive_reservation').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('engine_type', 'shared_capacity_access').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('reference_table', 'snack_orders').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
  ]);

  const orders = ordersRes.data || [];
  const chaletBookings = chaletBookingsRes.data || [];
  const poolTickets = poolTicketsRes.data || [];
  const snackOrders = snackOrdersRes.data || [];

  const restaurantRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);
  const chaletRevenue = chaletBookings.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
  const poolRevenue = poolTickets.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const snackRevenue = snackOrders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);
  const totalRevenue = restaurantRevenue + chaletRevenue + poolRevenue + snackRevenue;
  const totalOrders = orders.length + snackOrders.length;
  const totalBookings = chaletBookings.length + poolTickets.length;

  // Previous period revenue
  const prevRevenue = [
    ...(prevOrdersRes.data || []),
    ...(prevChaletRes.data || []),
    ...(prevPoolRes.data || []),
    ...(prevSnackRes.data || []),
  ].reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  const prevOrders = (prevOrdersRes.data || []).length + (prevSnackRes.data || []).length;

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

  // Revenue by month (last 6 months)
  const revenueByMonth: Array<{ month: string; revenue: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthLabel = monthStart.toLocaleDateString('en', { month: 'short', year: 'numeric' });

    const allItems = [
      ...orders.filter((o: any) => new Date(o.created_at) >= monthStart && new Date(o.created_at) <= monthEnd),
      ...chaletBookings.filter((b: any) => new Date(b.created_at) >= monthStart && new Date(b.created_at) <= monthEnd),
      ...poolTickets.filter((t: any) => new Date(t.created_at) >= monthStart && new Date(t.created_at) <= monthEnd),
      ...snackOrders.filter((o: any) => new Date(o.created_at) >= monthStart && new Date(o.created_at) <= monthEnd),
    ];
    const monthRevenue = allItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    revenueByMonth.push({ month: monthLabel, revenue: monthRevenue });
  }

  // Top items from transactions metadata
  const { data: topItemsData } = await supabase
    .rpc('get_top_menu_items', { limit_count: 5 });

  const topItems = (topItemsData || []).map((item: any) => ({
    name: item.menu_items?.name || 'Unknown',
    quantity: item.quantity,
    revenue: (item.quantity || 0) * (Number(item.unit_price) || 0),
  }));

  res.json({
    success: true,
    data: {
      overview: {
        totalRevenue,
        totalOrders,
        totalBookings,
        totalUsers: usersRes.count || 0,
        revenueChange: Math.round(revenueChange * 10) / 10,
        ordersChange: Math.round(ordersChange * 10) / 10,
      },
      revenueByService: {
        restaurant: restaurantRevenue,
        snackBar: snackRevenue,
        chalets: chaletRevenue,
        pool: poolRevenue,
      },
      revenueByMonth,
      topItems,
    },
  });
});

export const getOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Chalets occupancy
  const [chaletsRes, chaletBookingsRes] = await Promise.all([
    supabase.from('accommodation_units').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('transactions').select('id, metadata').eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO),
  ]);
  const activeChalets = chaletsRes.count || 0;
  const chaletBookings = chaletBookingsRes.data || [];
  const totalNights = chaletBookings.reduce((sum: number, b: any) => {
    const checkIn = new Date(b.metadata?.check_in_date);
    const checkOut = new Date(b.metadata?.check_out_date);
    return sum + Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  }, 0);
  const daysInRange = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const chaletCapacity = activeChalets * daysInRange;
  const chaletOccupancy = chaletCapacity > 0 ? (totalNights / chaletCapacity) * 100 : 0;

  // Pool occupancy
  const { data: poolSettings } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'pool')
    .single();
  const dailyPoolCapacity = poolSettings?.value?.maxCapacity || poolSettings?.value?.max_capacity || 100;
  const { data: poolTickets } = await supabase
    .from('transactions')
    .select('id, metadata')
    .eq('engine_type', 'shared_capacity_access')
    .gte('created_at', startISO)
    .lte('created_at', endISO);
  const totalTickets = (poolTickets || []).reduce((sum: number, t: any) => sum + (Number(t.metadata?.number_of_guests) || 0), 0);
  const totalPoolCapacity = dailyPoolCapacity * daysInRange;
  const poolOccupancy = totalPoolCapacity > 0 ? (totalTickets / totalPoolCapacity) * 100 : 0;

  res.json({
    success: true,
    data: {
      chalets: {
        occupancyRate: Math.round(chaletOccupancy * 10) / 10,
        bookedNights: totalNights,
        totalCapacity: chaletCapacity,
        activeUnits: activeChalets,
      },
      pool: {
        occupancyRate: Math.round(poolOccupancy * 10) / 10,
        ticketsSold: totalTickets,
        totalCapacity: totalPoolCapacity,
        dailyCapacity: dailyPoolCapacity,
      },
    },
  });
});

export const getCustomersReport = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Get orders with user info to find top customers
  const { data: orderData } = await supabase
    .from('transactions')
    .select('customer_id, metadata, amount')
    .eq('engine_type', 'instant_transaction')
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  // Aggregate by customer
  const customerMap = new Map<string, { name: string; revenue: number; count: number }>();
  (orderData || []).forEach((order: any) => {
    const customerName = order.metadata?.customer_name || 'Guest';
    const customerKey = order.customer_id || `guest:${customerName}`;
    const existing = customerMap.get(customerKey) || { name: customerName, revenue: 0, count: 0 };
    existing.revenue += Number(order.amount) || 0;
    existing.count += 1;
    customerMap.set(customerKey, existing);
  });

  const topCustomers = Array.from(customerMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Customer retention (new vs returning)
  const { data: prevUsers } = await supabase
    .from('transactions')
    .select('customer_id')
    .lt('created_at', startISO)
    .not('customer_id', 'is', null);

  const previousUserIds = new Set((prevUsers || []).map((o: any) => o.customer_id).filter(Boolean));
  const currentUserIds = new Set((orderData || []).map((o: any) => o.customer_id).filter(Boolean));
  const returningCount = Array.from(currentUserIds).filter(id => previousUserIds.has(id)).length;
  const newCount = currentUserIds.size - returningCount;

  res.json({
    success: true,
    data: {
      topCustomers,
      customerRetention: {
        new: newCount,
        returning: returningCount,
        total: currentUserIds.size,
        newRatio: currentUserIds.size > 0 ? Math.round((newCount / currentUserIds.size) * 100) : 0,
      },
    },
  });
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const type = (req.query.type as string) || 'restaurant';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  let csvData = '';
  const filename = `${type}-report.csv`;

  switch (type) {
    case 'restaurant': {
      const { data } = await supabase.from('transactions').select('id, order_number, amount, status, created_at').eq('reference_table', 'restaurant_orders').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Order Number,Total,Status,Date\n' + (data || []).map((o: any) => `${o.id},${o.order_number || ''},${o.amount},${o.status},${o.created_at}`).join('\n');
      break;
    }
    case 'chalets': {
      const { data } = await supabase.from('transactions').select('id, metadata, amount, status, created_at').eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Chalet,Total,Status,Check In,Check Out,Created\n' + (data || []).map((b: any) => `${b.id},${b.metadata?.chalet_id || ''},${b.amount},${b.status},${b.metadata?.check_in_date || ''},${b.metadata?.check_out_date || ''},${b.created_at}`).join('\n');
      break;
    }
    case 'pool': {
      const { data } = await supabase.from('transactions').select('id, ticket_number, amount, status, metadata, created_at').eq('engine_type', 'shared_capacity_access').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Ticket,Total,Status,Guests,Date\n' + (data || []).map((t: any) => `${t.id},${t.ticket_number || ''},${t.amount},${t.status},${t.metadata?.number_of_guests || 0},${t.created_at}`).join('\n');
      break;
    }
    case 'snack': {
      const { data } = await supabase.from('transactions').select('id, order_number, amount, status, created_at').eq('reference_table', 'snack_orders').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Order Number,Total,Status,Date\n' + (data || []).map((o: any) => `${o.id},${o.order_number || ''},${o.amount},${o.status},${o.created_at}`).join('\n');
      break;
    }
    case 'users': {
      const { data } = await supabase.from('users').select('id, full_name, email, role, created_at').order('created_at', { ascending: false });
      csvData = 'ID,Name,Email,Role,Joined\n' + (data || []).map((u: any) => `${u.id},${u.full_name || ''},${u.email},${u.role},${u.created_at}`).join('\n');
      break;
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvData);
});
