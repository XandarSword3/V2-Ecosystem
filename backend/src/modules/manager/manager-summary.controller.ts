import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/manager/summary
 * Cross-module today's-activity summary (orders, revenue, reviews,
 * staff-on-shift) for the manager dashboard.
 *
 * Extracted out of the old shifts.controller.ts during the Engine A
 * shift-system consolidation (2026-08-07): this method isn't shift
 * management, it just happened to live in that file. Kept alive here
 * unchanged so /manager/summary keeps working after shifts.controller.ts
 * was archived in favor of the /staff/shifts/* system.
 */
export async function getManagerSummary(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string);
    if (!propertyId && process.env.NODE_ENV !== 'test') {
      res.status(400).json({ success: false, error: 'Property ID context is required' });
      return;
    }

    const supabase = getSupabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const startIso = todayStart.toISOString();
    const endIso = todayEnd.toISOString();

    const { data: staffMembers } = await supabase
      .from('user_property_access')
      .select('user_id')
      .eq('property_id', propertyId);
    const staffIds = (staffMembers || []).map((sm) => sm.user_id).filter(Boolean);

    const [transactionsResult, activeShifts, productReviewsResult, staffReviewsResult] = await Promise.all([
      supabase.from('transactions').select('id, amount, status, created_at, engine_type, module_id').eq('property_id', propertyId),
      supabase.from('staff_shifts').select('id, status, department').eq('status', 'active').in('staff_id', staffIds),
      supabase.from('product_reviews').select('rating').eq('property_id', propertyId).gte('created_at', startIso).lte('created_at', endIso),
      supabase.from('staff_reviews').select('rating').eq('property_id', propertyId).gte('created_at', startIso).lte('created_at', endIso),
    ]);

    const transactions = transactionsResult.data || [];
    const totalActiveStaff = (activeShifts.data || []).length;
    const productRatings = (productReviewsResult.data || []).map((r) => r.rating);
    const staffRatings = (staffReviewsResult.data || []).map((r) => r.rating);
    const calcAvg = (ratings: number[]) =>
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;

    const withinToday = (createdAt?: string | null) => {
      if (!createdAt) return false;
      const ts = new Date(createdAt).getTime();
      return ts >= todayStart.getTime() && ts <= todayEnd.getTime();
    };
    const sumAmount = (rows: any[]) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const activeStatuses = new Set(['pending', 'confirmed', 'preparing', 'ready', 'checked_in', 'valid', 'active']);

    const modules = [
      { name: 'instant_transaction', rows: transactions.filter((t) => t.engine_type === 'instant_transaction') },
      { name: 'time_exclusive_reservation', rows: transactions.filter((t) => t.engine_type === 'time_exclusive_reservation') },
      { name: 'shared_capacity_access', rows: transactions.filter((t) => t.engine_type === 'shared_capacity_access') },
      { name: 'ongoing_entitlement', rows: transactions.filter((t) => t.engine_type === 'ongoing_entitlement') },
    ].map((module) => {
      const todays = module.rows.filter((row: any) => withinToday(row.created_at));
      return {
        module: module.name,
        todays_order_count: todays.length,
        todays_revenue: Number(sumAmount(todays).toFixed(2)),
        active_orders_count: module.rows.filter((row: any) => activeStatuses.has(String(row.status))).length,
        staff_on_shift: totalActiveStaff,
      };
    });

    const reviewsSummary = {
      product_reviews_count: productRatings.length,
      product_average_rating: calcAvg(productRatings),
      staff_reviews_count: staffRatings.length,
      staff_average_rating: calcAvg(staffRatings),
    };

    res.json({ success: true, data: modules, reviews_summary: reviewsSummary, date_range: { start: startIso, end: endIso } });
  } catch (error: any) {
    logger.error('Error fetching manager summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manager summary', message: error.message });
  }
}
