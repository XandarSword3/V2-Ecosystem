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

type ModuleAggregateRow = {
  module_id: string | null;
  name: string;
  slug: string;
  engine_type: string;
  count: number;
  revenue: string;
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

    // Dynamic aggregation — groups ALL transactions by module (via LEFT JOIN) +
    // engine_type. No hardcoded slugs. Works for any module configuration.
    const DYNAMIC_AGG_SQL = `
      SELECT
        m.id        AS module_id,
        COALESCE(m.name, t.engine_type) AS name,
        COALESCE(m.slug, t.engine_type) AS slug,
        t.engine_type,
        COUNT(*)::int                    AS count,
        COALESCE(SUM(t.amount), 0)       AS revenue
      FROM transactions t
      LEFT JOIN modules m ON t.module_id = m.id
      WHERE t.property_id = $3 AND t.created_at BETWEEN $1 AND $2
      GROUP BY m.id,
               COALESCE(m.name, t.engine_type),
               COALESCE(m.slug, t.engine_type),
               t.engine_type
      ORDER BY revenue DESC
    `;

    const [
      currentAgg,
      previousAgg,
      monthlyRevenueRows,
      topItemsResult,
      usersResult
    ] = await Promise.all([
      pool.query<ModuleAggregateRow>(DYNAMIC_AGG_SQL, [startISO, endISO, propertyId]),
      pool.query<ModuleAggregateRow>(DYNAMIC_AGG_SQL, [prevStartISO, prevEndISO, propertyId]),
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
        catalog_item_id: string;
        quantity: number;
        unit_price: string;
        name: string | null;
      }>(`
        SELECT
          item->>'id' as id,
          COALESCE(item->>'catalog_item_id', item->>'catalog_item_id') as catalog_item_id,
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

    // Engine types that count as "bookings" vs "orders"
    const BOOKING_ENGINES = new Set(['time_exclusive_reservation', 'shared_capacity_access', 'time_slot_booking']);
    const ORDER_ENGINES = new Set(['instant_transaction']);

    // Fold per-(module, engine_type) rows into per-module entries
    const moduleMap = new Map<string, { slug: string; name: string; revenue: number; count: number }>();
    let totalOrders = 0;
    let totalBookings = 0;
    for (const row of currentAgg.rows) {
      const key = row.module_id ?? row.engine_type;
      const existing = moduleMap.get(key) ?? { slug: row.slug, name: row.name, revenue: 0, count: 0 };
      existing.revenue += toNumber(row.revenue);
      existing.count += toNumber(row.count);
      moduleMap.set(key, existing);
      if (ORDER_ENGINES.has(row.engine_type)) totalOrders += toNumber(row.count);
      if (BOOKING_ENGINES.has(row.engine_type)) totalBookings += toNumber(row.count);
    }
    const revenueByModule = Array.from(moduleMap.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = revenueByModule.reduce((sum, m) => sum + m.revenue, 0);

    // Previous-period totals for change calculations
    const prevRevenue = (previousAgg.rows || []).reduce((sum, row) => sum + toNumber(row.revenue), 0);
    const prevOrders = (previousAgg.rows || []).filter(r => ORDER_ENGINES.has(r.engine_type)).reduce((sum, row) => sum + toNumber(row.count), 0);

    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

    // Legacy revenueByService shape — built dynamically from aggregation rows.
    // Keeps backward-compat for any consumer that still uses the old keyed shape.
    const legacyService: Record<string, number> = {};
    for (const row of currentAgg.rows) {
      if (row.engine_type === 'time_exclusive_reservation') {
        legacyService.reservation_units = (legacyService.reservation_units ?? 0) + toNumber(row.revenue);
      } else if (row.engine_type === 'shared_capacity_access') {
        legacyService.capacity_access = (legacyService.capacity_access ?? 0) + toNumber(row.revenue);
      } else {
        // Fold all other engine types (instant_transaction etc.) by module slug
        const svcKey = row.slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // e.g. my-module -> myModule
        legacyService[svcKey] = (legacyService[svcKey] ?? 0) + toNumber(row.revenue);
      }
    }

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
        revenueByModule,       // canonical: dynamic array of { slug, name, revenue, count }
        revenueByService: legacyService, // legacy compat — derived from aggregation, not hardcoded
        revenueByMonth,
        topItems,
      },
    });
    return;
  } catch (err) {
    // Fall back to the existing Supabase client path when a direct pool is unavailable.
  }

  // Supabase fallback — dynamic aggregation, no hardcoded slugs.
  // Fetch all transactions + join modules for name/slug in JS.
  const [allCurrentRes, allPreviousRes, usersRes, txsForTop] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, created_at, engine_type, module_id')
      .eq('property_id', propertyId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
    supabase
      .from('transactions')
      .select('id, amount, engine_type, module_id')
      .eq('property_id', propertyId)
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO),
    supabase.from('user_property_access').select('user_id', { count: 'exact', head: true }).eq('property_id', propertyId),
    supabase
      .from('transactions')
      .select('metadata')
      .eq('property_id', propertyId)
      .eq('engine_type', 'instant_transaction')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // Fetch modules for name resolution
  const { data: modulesList } = await supabase.from('modules').select('id, slug, name').eq('property_id', propertyId);
  const modulesById = new Map((modulesList || []).map(m => [m.id, m]));

  const BOOKING_ENGINES = new Set(['time_exclusive_reservation', 'shared_capacity_access', 'time_slot_booking']);
  const ORDER_ENGINES = new Set(['instant_transaction']);

  // Aggregate current period dynamically
  const moduleMap = new Map<string, { slug: string; name: string; revenue: number; count: number }>();
  let totalOrders = 0;
  let totalBookings = 0;
  (allCurrentRes.data || []).forEach((tx: any) => {
    const mod = tx.module_id ? modulesById.get(tx.module_id) : null;
    const slug = mod?.slug ?? tx.engine_type;
    const name = mod?.name ?? tx.engine_type;
    const key = tx.module_id ?? tx.engine_type;
    const existing = moduleMap.get(key) ?? { slug, name, revenue: 0, count: 0 };
    existing.revenue += Number(tx.amount) || 0;
    existing.count += 1;
    moduleMap.set(key, existing);
    if (ORDER_ENGINES.has(tx.engine_type)) totalOrders++;
    if (BOOKING_ENGINES.has(tx.engine_type)) totalBookings++;
  });
  const revenueByModule = Array.from(moduleMap.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = revenueByModule.reduce((sum, m) => sum + m.revenue, 0);

  // Previous period
  const prevRevenue = (allPreviousRes.data || []).reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
  const prevOrders = (allPreviousRes.data || []).filter((tx: any) => ORDER_ENGINES.has(tx.engine_type)).length;

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

  // Revenue by month (last 6 months) — computed from already-fetched current transactions
  const allCurrentTxs = allCurrentRes.data || [];
  const revenueByMonth: Array<{ month: string; revenue: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthRevenue = allCurrentTxs
      .filter((tx: any) => new Date(tx.created_at) >= monthStart && new Date(tx.created_at) <= monthEnd)
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
    revenueByMonth.push({ month: monthStart.toLocaleDateString('en', { month: 'short', year: 'numeric' }), revenue: monthRevenue });
  }

  // Top items
  const itemCounts = new Map<string, { name: string; quantity: number; unit_price: number }>();
  (txsForTop.data || []).forEach(tx => {
    const items = (tx as any).metadata?.items || [];
    items.forEach((item: any) => {
      // Q65 — prefer catalog_item_id; fall back to catalog_item_id (legacy) then item.id
      const id = item.catalog_item_id || item.catalog_item_id || item.id;
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
    .map(item => ({ name: item.name, quantity: item.quantity, revenue: item.quantity * item.unit_price }));

  // Legacy revenueByService shape — derived from aggregation rows, not hardcoded
  const legacyService: Record<string, number> = {};
  (allCurrentRes.data || []).forEach((tx: any) => {
    const mod = tx.module_id ? modulesById.get(tx.module_id) : null;
    const amount = Number(tx.amount) || 0;
    if (tx.engine_type === 'time_exclusive_reservation') {
      legacyService.reservation_units = (legacyService.reservation_units ?? 0) + amount;
    } else if (tx.engine_type === 'shared_capacity_access') {
      legacyService.capacity_access = (legacyService.capacity_access ?? 0) + amount;
    } else {
      const slug = mod?.slug ?? tx.engine_type;
      const svcKey = slug.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
      legacyService[svcKey] = (legacyService[svcKey] ?? 0) + amount;
    }
  });

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
      revenueByModule,         // canonical: dynamic array of { slug, name, revenue, count }
      revenueByService: legacyService, // legacy compat — derived from aggregation
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

  // Reservation unit occupancy (engine B — time_exclusive_reservation)
  const [unitsRes, unitBookingsRes] = await Promise.all([
    supabase.from('accommodation_units').select('id', { count: 'exact' }).eq('property_id', propertyId).eq('is_active', true),
    supabase.from('transactions').select('id, metadata').eq('property_id', propertyId).eq('engine_type', 'time_exclusive_reservation').gte('created_at', startISO).lte('created_at', endISO),
  ]);
  const activeUnits = unitsRes.count || 0;
  const unitBookings = unitBookingsRes.data || [];
  const totalNights = unitBookings.reduce((sum: number, b: any) => {
    const checkIn = new Date(b.metadata?.check_in_date);
    const checkOut = new Date(b.metadata?.check_out_date);
    return sum + Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  }, 0);
  const daysInRange = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const unitCapacity = activeUnits * daysInRange;
  const unitOccupancy = unitCapacity > 0 ? (totalNights / unitCapacity) * 100 : 0;

  // Shared capacity access occupancy (engine C — shared_capacity_access)
  let dailyCapacityLimit = 100;
  try {
    const { resolveSetting } = await import('../../multi-property/settings-resolution.service.js');
    const capacitySetting = await resolveSetting(propertyId, 'shared_capacity_access');
    const capacityVal = capacitySetting?.value;
    dailyCapacityLimit = capacityVal?.maxCapacity || capacityVal?.max_capacity || 100;
  } catch {
    // fallback
  }

  const { data: capacityTickets } = await supabase
    .from('transactions')
    .select('id, metadata')
    .eq('property_id', propertyId)
    .eq('engine_type', 'shared_capacity_access')
    .gte('created_at', startISO)
    .lte('created_at', endISO);
  const totalTickets = (capacityTickets || []).reduce((sum: number, t: any) => sum + (Number(t.metadata?.number_of_guests) || 0), 0);
  const totalCapacitySlots = dailyCapacityLimit * daysInRange;
  const capacityOccupancy = totalCapacitySlots > 0 ? (totalTickets / totalCapacitySlots) * 100 : 0;

  res.json({
    success: true,
    data: {
      units: {
        occupancyRate: Math.round(unitOccupancy * 10) / 10,
        bookedNights: totalNights,
        totalCapacity: unitCapacity,
        activeUnits,
      },
      capacity_access: {
        occupancyRate: Math.round(capacityOccupancy * 10) / 10,
        ticketsSold: totalTickets,
        totalCapacity: totalCapacitySlots,
        dailyCapacity: dailyCapacityLimit,
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
  const { start, end } = getDateRange(range);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Q53 — Generic export: accepts moduleSlug, moduleId, or engineType directly.
  // The `type` query param is retained only for the 'users' export; all other exports use moduleSlug, moduleId, or engineType.
  const legacyType = (req.query.type as string) || '';
  const moduleSlug = (req.query.moduleSlug as string) || '';
  const moduleId = (req.query.moduleId as string) || '';
  const engineTypeParam = (req.query.engineType as string) || '';

  // Handle users export separately — not a transaction-based export
  if (legacyType === 'users') {
    const { data: userAccessList } = await supabase.from('user_property_access').select('user_id').eq('property_id', propertyId);
    const userIds = (userAccessList || []).map(u => u.user_id);
    const { data } = await supabase.from('users').select('id, full_name, email, role, created_at').in('id', userIds).order('created_at', { ascending: false });
    const csvData = 'ID,Name,Email,Role,Joined\n' + (data || []).map((u: any) => `${u.id},${u.full_name || ''},${u.email},${u.role},${u.created_at}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users-report.csv"');
    res.send(csvData);
    return;
  }

  // Resolve query strategy from most-specific to least-specific:
  // 1. Direct moduleId param
  // 2. moduleSlug param — look up from modules table
  // 3. engineType param — filter by engine_type column
  // 4. Legacy `type` param — map to engine_type or slug
  let queryFilter: { by: 'module_id' | 'engine_type'; value: string } | null = null;

  if (moduleId) {
    queryFilter = { by: 'module_id', value: moduleId };
  } else if (moduleSlug || legacyType) {
    const targetSlug = moduleSlug || legacyType;
    const { data: modulesList } = await supabase.from('modules').select('id, slug').eq('property_id', propertyId);
    const modulesMap = new Map((modulesList || []).map((m: any) => [m.slug, m.id]));
    const resolvedId = modulesMap.get(targetSlug);
    if (resolvedId) {
      queryFilter = { by: 'module_id', value: resolvedId };
    }
    // If slug doesn't match any active module, queryFilter stays null → 400 below.
  } else if (engineTypeParam) {
    queryFilter = { by: 'engine_type', value: engineTypeParam };
  }

  if (!queryFilter) {
    res.status(400).json({ success: false, error: 'Provide moduleSlug, moduleId, or engineType query parameter.' });
    return;
  }

  // Generic transaction fetch — no hardcoded column references
  let txQuery = supabase
    .from('transactions')
    .select('id, metadata, amount, status, created_at, engine_type')
    .eq('property_id', propertyId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false });

  if (queryFilter.by === 'module_id') {
    txQuery = txQuery.eq('module_id', queryFilter.value);
  } else {
    txQuery = txQuery.eq('engine_type', queryFilter.value);
  }

  const { data } = await txQuery;

  // Build CSV with generic columns — engine_type drives which metadata fields to surface
  const filename = `${moduleSlug || legacyType || engineTypeParam}-report.csv`;
  const csvData = 'ID,Amount,Status,Engine Type,Created\n' +
    (data || []).map((tx: any) =>
      `${tx.id},${tx.amount},${tx.status},${tx.engine_type},${tx.created_at}`
    ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvData);
});
