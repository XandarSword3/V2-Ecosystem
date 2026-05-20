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
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

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

    const [
      currentRestaurant,
      currentChalets,
      currentPool,
      currentSnack,
      previousRestaurant,
      previousChalets,
      previousPool,
      previousSnack,
      monthlyRevenueRows,
      topItemsResult,
      usersResult
    ] = await Promise.all([
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(t.amount), 0) AS revenue FROM transactions t JOIN modules m ON t.module_id = m.id WHERE t.property_id = $3 AND m.slug = \'restaurant\' AND t.created_at BETWEEN $1 AND $2',
        [startISO, endISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE property_id = $3 AND engine_type = \'time_exclusive_reservation\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE property_id = $3 AND engine_type = \'shared_capacity_access\' AND created_at BETWEEN $1 AND $2',
        [startISO, endISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(t.amount), 0) AS revenue FROM transactions t JOIN modules m ON t.module_id = m.id WHERE t.property_id = $3 AND m.slug = \'snack-bar\' AND t.created_at BETWEEN $1 AND $2',
        [startISO, endISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(t.amount), 0) AS revenue FROM transactions t JOIN modules m ON t.module_id = m.id WHERE t.property_id = $3 AND m.slug = \'restaurant\' AND t.created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE property_id = $3 AND engine_type = \'time_exclusive_reservation\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS revenue FROM transactions WHERE property_id = $3 AND engine_type = \'shared_capacity_access\' AND created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO, propertyId]
      ),
      pool.query<PeriodAggregateRow>(
        'SELECT COUNT(*)::int AS count, COALESCE(SUM(t.amount), 0) AS revenue FROM transactions t JOIN modules m ON t.module_id = m.id WHERE t.property_id = $3 AND m.slug = \'snack-bar\' AND t.created_at BETWEEN $1 AND $2',
        [prevStartISO, prevEndISO, propertyId]
      ),
      pool.query<{ month_key: string; revenue: string }>(`
        WITH all_items AS (
          SELECT date_trunc('month', created_at) AS month_start, amount
          FROM transactions
          WHERE property_id = $3 AND created_at BETWEEN $1 AND $2
        )
        SELECT to_char(month_start, 'YYYY-MM') AS month_key, COALESCE(SUM(amount), 0) AS revenue
        FROM all_items
        GROUP BY month_start
        ORDER BY month_start
      `, [dayjs().subtract(5, 'month').startOf('month').toISOString(), endISO, propertyId]),
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
        WHERE property_id = $1 AND engine_type = 'instant_transaction'
        ORDER BY (item->>'quantity')::int DESC
        LIMIT 5
      `, [propertyId]),
      pool.query<{ count: string | number }>('SELECT COUNT(DISTINCT user_id)::int AS count FROM user_property_access WHERE property_id = $1', [propertyId]),
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
  } catch (err) {
    // Fall back to the existing Supabase client path when a direct pool is unavailable.
  }

  // Fetch active modules first to map slugs to IDs
  const { data: modulesList } = await supabase.from('modules').select('id, slug').eq('property_id', propertyId);
  const modulesMap = new Map((modulesList || []).map(m => [m.slug, m.id]));
  const restaurantModuleId = modulesMap.get('restaurant') || '00000000-0000-0000-0000-000000000000';
  const snackModuleId = modulesMap.get('snack-bar') || '00000000-0000-0000-0000-000000000000';

  // Current period queries
  const [ordersRes, chaletBookingsRes, poolTicketsRes, snackOrdersRes, usersRes] = await Promise.all([
    supabase.from('transactions').select('id, amount, created_at').eq('property_id', propertyId).eq('module_id', restaurantModuleId).gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('property_id', propertyId).eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('property_id', propertyId).eq('engine_type', 'shared_capacity_access').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('transactions').select('id, amount, created_at').eq('property_id', propertyId).eq('module_id', snackModuleId).gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('user_property_access').select('user_id', { count: 'exact', head: true }).eq('property_id', propertyId),
  ]);

  // Previous period for change calculation
  const [prevOrdersRes, prevChaletRes, prevPoolRes, prevSnackRes] = await Promise.all([
    supabase.from('transactions').select('id, amount').eq('property_id', propertyId).eq('module_id', restaurantModuleId).gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('property_id', propertyId).eq('engine_type', 'time_exclusive_reservation').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('property_id', propertyId).eq('engine_type', 'shared_capacity_access').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('transactions').select('id, amount').eq('property_id', propertyId).eq('module_id', snackModuleId).gte('created_at', prevStartISO).lte('created_at', prevEndISO),
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

  // Top items from transactions metadata (Js mapping for property_id filtering capability)
  const { data: txsForTop } = await supabase
    .from('transactions')
    .select('metadata')
    .eq('property_id', propertyId)
    .eq('engine_type', 'instant_transaction')
    .order('created_at', { ascending: false })
    .limit(100);

  const itemCounts = new Map<string, { name: string; quantity: number; unit_price: number }>();
  (txsForTop || []).forEach(tx => {
    const items = tx.metadata?.items || [];
    items.forEach((item: any) => {
      const id = item.id || item.menu_item_id;
      if (!id) return;
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.unit_price) || 0;
      const name = item.name || 'Unknown';
      const existing = itemCounts.get(id) || { name, quantity: 0, unit_price: price };
      existing.quantity += quantity;
      itemCounts.set(id, existing);
    });
  });

  const topItems = Array.from(itemCounts.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(item => ({
      name: item.name,
      quantity: item.quantity,
      revenue: item.quantity * item.unit_price,
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
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Chalets occupancy
  const [chaletsRes, chaletBookingsRes] = await Promise.all([
    supabase.from('accommodation_units').select('id', { count: 'exact' }).eq('property_id', propertyId).eq('is_active', true),
    supabase.from('transactions').select('id, metadata').eq('property_id', propertyId).eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO),
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

  // Pool occupancy (via property settings inheritance)
  let dailyPoolCapacity = 100;
  try {
    const { resolveSetting } = await import('../../multi-property/settings-resolution.service.js');
    const poolSetting = await resolveSetting(propertyId, 'pool');
    const poolVal = poolSetting?.value;
    dailyPoolCapacity = poolVal?.maxCapacity || poolVal?.max_capacity || 100;
  } catch {
    // fallback
  }

  const { data: poolTickets } = await supabase
    .from('transactions')
    .select('id, metadata')
    .eq('property_id', propertyId)
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
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Get orders with user info to find top customers
  const { data: orderData } = await supabase
    .from('transactions')
    .select('customer_id, metadata, amount')
    .eq('property_id', propertyId)
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
    .eq('property_id', propertyId)
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
  const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
  if (!propertyId && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Property ID context is required' });
    return;
  }

  const supabase = getSupabase();
  const range = (req.query.range as string) || 'month';
  const type = (req.query.type as string) || 'restaurant';
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Fetch active modules first to map slugs to IDs
  const { data: modulesList } = await supabase.from('modules').select('id, slug').eq('property_id', propertyId);
  const modulesMap = new Map((modulesList || []).map(m => [m.slug, m.id]));
  const restaurantModuleId = modulesMap.get('restaurant') || '00000000-0000-0000-0000-000000000000';
  const snackModuleId = modulesMap.get('snack-bar') || '00000000-0000-0000-0000-000000000000';

  let csvData = '';
  const filename = `${type}-report.csv`;

  switch (type) {
    case 'restaurant': {
      const { data } = await supabase.from('transactions').select('id, metadata, amount, status, created_at').eq('property_id', propertyId).eq('module_id', restaurantModuleId).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Order Number,Total,Status,Date\n' + (data || []).map((o: any) => `${o.id},${o.metadata?.order_number || ''},${o.amount},${o.status},${o.created_at}`).join('\n');
      break;
    }
    case 'chalets': {
      const { data } = await supabase.from('transactions').select('id, metadata, amount, status, created_at').eq('property_id', propertyId).eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Chalet,Total,Status,Check In,Check Out,Created\n' + (data || []).map((b: any) => `${b.id},${b.metadata?.chalet_id || ''},${b.amount},${b.status},${b.metadata?.check_in_date || ''},${b.metadata?.check_out_date || ''},${b.created_at}`).join('\n');
      break;
    }
    case 'pool': {
      const { data } = await supabase.from('transactions').select('id, amount, status, metadata, created_at').eq('property_id', propertyId).eq('engine_type', 'shared_capacity_access').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Ticket,Total,Status,Guests,Date\n' + (data || []).map((t: any) => `${t.id},${t.metadata?.ticket_number || ''},${t.amount},${t.status},${t.metadata?.number_of_guests || 0},${t.created_at}`).join('\n');
      break;
    }
    case 'snack': {
      const { data } = await supabase.from('transactions').select('id, metadata, amount, status, created_at').eq('property_id', propertyId).eq('module_id', snackModuleId).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
      csvData = 'ID,Order Number,Total,Status,Date\n' + (data || []).map((o: any) => `${o.id},${o.metadata?.order_number || ''},${o.amount},${o.status},${o.created_at}`).join('\n');
      break;
    }
    case 'users': {
      const { data: userAccessList } = await supabase.from('user_property_access').select('user_id').eq('property_id', propertyId);
      const userIds = (userAccessList || []).map(u => u.user_id);
      const { data } = await supabase.from('users').select('id, full_name, email, role, created_at').in('id', userIds).order('created_at', { ascending: false });
      csvData = 'ID,Name,Email,Role,Joined\n' + (data || []).map((u: any) => `${u.id},${u.full_name || ''},${u.email},${u.role},${u.created_at}`).join('\n');
      break;
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvData);
});
