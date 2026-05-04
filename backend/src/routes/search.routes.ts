import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getSupabase } from '../database/connection.js';

const router = Router();

router.get('/orders', authenticate, authorize('staff', 'manager', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { customer_id, q, date_from, date_to, module, status } = req.query as Record<string, string | undefined>;
    const applyFilters = (query: any) => {
      let nextQuery = query;
      if (date_from) nextQuery = nextQuery.gte('created_at', date_from);
      if (date_to) nextQuery = nextQuery.lte('created_at', date_to);
      if (status) nextQuery = nextQuery.eq('status', status);
      return nextQuery;
    };

    let ordersQ = applyFilters(supabase.from('orders').select('id, customer_id, customer_name, total_amount, status, created_at, module_id, order_number'));
    let bookingsQ = applyFilters(supabase.from('bookings').select('id, customer_id, customer_name, total_amount, status, created_at, unit_id, booking_number'));
    let ticketsQ = applyFilters(supabase.from('tickets').select('id, customer_id, customer_name, total_amount, status, created_at, session_id, ticket_number'));

    if (customer_id) {
      ordersQ = ordersQ.eq('customer_id', customer_id);
      bookingsQ = bookingsQ.eq('customer_id', customer_id);
      ticketsQ = ticketsQ.eq('customer_id', customer_id);
    }
    if (q) {
      ordersQ = ordersQ.ilike('customer_name', `%${q}%`);
      bookingsQ = bookingsQ.ilike('customer_name', `%${q}%`);
      ticketsQ = ticketsQ.ilike('customer_name', `%${q}%`);
    }
    if (module) {
      ordersQ = ordersQ.eq('module_id', module);
    }

    const [ordersRes, bookingsRes, ticketsRes] = await Promise.all([ordersQ, bookingsQ, ticketsQ]);

    const combined = [
      ...(ordersRes.data || []).map((row: any) => ({ ...row, type: 'order' })),
      ...(bookingsRes.data || []).map((row: any) => ({ ...row, type: 'booking' })),
      ...(ticketsRes.data || []).map((row: any) => ({ ...row, type: 'ticket' })),
    ].sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

    res.json({ success: true, data: combined });
  } catch (error) {
    next(error);
  }
});

export default router;
