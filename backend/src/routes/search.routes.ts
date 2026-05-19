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

    // All transaction types unified in the transactions table per Architecture Law
    const ENGINE_TYPE_MAP: Record<string, string> = {
      order: 'instant_transaction',
      booking: 'time_exclusive_reservation',
      ticket: 'shared_capacity_access',
    };

    const buildQuery = (engineType: string) => {
      let q2 = applyFilters(
        supabase
          .from('transactions')
          .select('id, customer_id, status, amount, created_at, module_id, metadata, engine_type')
          .eq('engine_type', engineType)
      );
      if (customer_id) q2 = q2.eq('customer_id', customer_id);
      if (module) q2 = q2.eq('module_id', module);
      return q2;
    };

    const [ordersRes, bookingsRes, ticketsRes] = await Promise.all([
      buildQuery('instant_transaction'),
      buildQuery('time_exclusive_reservation'),
      buildQuery('shared_capacity_access'),
    ]);

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
