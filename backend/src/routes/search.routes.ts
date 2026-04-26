import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getSupabase } from '../database/connection.js';

const router = Router();

router.get('/orders', authenticate, authorize('staff', 'manager', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { customer_id, q, date_from, date_to, module, status } = req.query as Record<string, string | undefined>;
    type SearchFilterQuery<T> = {
      gte: (column: string, value: string) => T;
      lte: (column: string, value: string) => T;
      eq: (column: string, value: string) => T;
      ilike: (column: string, value: string) => T;
    };
    const applyFilters = <T extends SearchFilterQuery<T>>(query: T) => {
      let nextQuery = query;
      if (date_from) nextQuery = nextQuery.gte('created_at', date_from);
      if (date_to) nextQuery = nextQuery.lte('created_at', date_to);
      if (status) nextQuery = nextQuery.eq('status', status);
      return nextQuery;
    };

    let restaurantQ = applyFilters(supabase.from('restaurant_orders').select('id, customer_id, customer_name, total_amount, status, created_at, module_id, order_number'));
    let chaletQ = applyFilters(supabase.from('chalet_bookings').select('id, customer_id, customer_name, total_amount, status, created_at, chalet_id, booking_number'));
    let poolQ = applyFilters(supabase.from('pool_tickets').select('id, customer_id, customer_name, total_amount, status, created_at, session_id, ticket_number'));
    let snackQ = applyFilters(supabase.from('snack_orders').select('id, customer_id, customer_name, total_amount, status, created_at, order_number'));

    if (customer_id) {
      restaurantQ = restaurantQ.eq('customer_id', customer_id);
      chaletQ = chaletQ.eq('customer_id', customer_id);
      poolQ = poolQ.eq('customer_id', customer_id);
      snackQ = snackQ.eq('customer_id', customer_id);
    }
    if (q) {
      restaurantQ = restaurantQ.ilike('customer_name', `%${q}%`);
      chaletQ = chaletQ.ilike('customer_name', `%${q}%`);
      poolQ = poolQ.ilike('customer_name', `%${q}%`);
      snackQ = snackQ.ilike('customer_name', `%${q}%`);
    }
    if (module) {
      restaurantQ = restaurantQ.eq('module_id', module);
    }

    const [restaurantRes, chaletRes, poolRes, snackRes] = await Promise.all([restaurantQ, chaletQ, poolQ, snackQ]);

    const combined = [
      ...(restaurantRes.data || []).map((row: any) => ({ ...row, type: 'restaurant_order' })),
      ...(chaletRes.data || []).map((row: any) => ({ ...row, type: 'chalet_booking' })),
      ...(poolRes.data || []).map((row: any) => ({ ...row, type: 'pool_ticket' })),
      ...(snackRes.data || []).map((row: any) => ({ ...row, type: 'snack_order' })),
    ].sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

    res.json({ success: true, data: combined });
  } catch (error) {
    next(error);
  }
});

export default router;
