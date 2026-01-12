/**
 * Reports Controller
 * Handles report generation and export
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection';
import dayjs from 'dayjs';

interface OrderItemWithJoins {
  quantity?: number;
  unit_price?: number;
  menu_items?: { name: string } | null;
  snack_items?: { name: string } | null;
}

export async function getOverviewReport(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    // Calculate date range based on range parameter
    let start: string;
    const end: string = dayjs().endOf('day').toISOString();

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day').toISOString();
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day').toISOString();
    } else {
      start = dayjs().subtract(1, 'month').startOf('day').toISOString();
    }

    // Get all orders/bookings in period - run queries in parallel
    const [
      restaurantResult,
      snackResult,
      chaletResult,
      poolResult,
      usersResult,
      restItemsResult,
      snackItemsResult
    ] = await Promise.all([
      supabase.from('restaurant_orders')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('snack_orders')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('chalet_bookings')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('pool_tickets')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('users')
        .select('id', { count: 'exact', head: true }),
      supabase.from('restaurant_order_items')
        .select('quantity, unit_price, menu_items(name), restaurant_orders!inner(created_at, status)')
        .gte('restaurant_orders.created_at', start)
        .lte('restaurant_orders.created_at', end)
        .eq('restaurant_orders.status', 'completed'),
      supabase.from('snack_order_items')
        .select('quantity, unit_price, snack_items(name), snack_orders!inner(created_at, status)')
        .gte('snack_orders.created_at', start)
        .lte('snack_orders.created_at', end)
        .eq('snack_orders.status', 'completed')
    ]);

    const restaurantOrdersList = restaurantResult.data || [];
    const snackOrdersList = snackResult.data || [];
    const chaletBookingsList = chaletResult.data || [];
    const poolTicketsList = poolResult.data || [];
    const totalUsers = usersResult.count || 0;

    // Calculate revenues
    const restaurantRevenue = restaurantOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const snackRevenue = snackOrdersList
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const chaletRevenue = chaletBookingsList
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
    const poolRevenue = poolTicketsList
      .filter(t => t.payment_status === 'paid')
      .reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0);

    const totalRevenue = restaurantRevenue + snackRevenue + chaletRevenue + poolRevenue;
    const totalOrders = restaurantOrdersList.length + snackOrdersList.length;
    const totalBookings = chaletBookingsList.length + poolTicketsList.length;

    // Process Top Items
    const topItemsMap = new Map<string, { name: string, quantity: number, revenue: number }>();

    const processItems = (items: OrderItemWithJoins[]) => {
      items.forEach(item => {
        const name = item.menu_items?.name || item.snack_items?.name || 'Unknown Item';
        const current = topItemsMap.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += (item.quantity || 0);
        current.revenue += (item.quantity || 0) * (item.unit_price || 0);
        topItemsMap.set(name, current);
      });
    };

    processItems((restItemsResult.data || []) as unknown as OrderItemWithJoins[]);
    processItems((snackItemsResult.data || []) as unknown as OrderItemWithJoins[]);

    const topItems = Array.from(topItemsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Revenue By Month (or Period)
    const monthlyRevenueMap = new Map<string, number>();
    const addToMonth = (date: string, amount: number) => {
      const month = dayjs(date).format('MMM YYYY');
      monthlyRevenueMap.set(month, (monthlyRevenueMap.get(month) || 0) + parseFloat(String(amount)));
    };

    restaurantOrdersList.filter(o => o.status === 'completed').forEach(o => addToMonth(o.created_at, o.total_amount));
    snackOrdersList.filter(o => o.status === 'completed').forEach(o => addToMonth(o.created_at, o.total_amount));
    chaletBookingsList.filter(b => b.payment_status === 'paid').forEach(b => addToMonth(b.created_at, b.total_amount));
    poolTicketsList.filter(t => t.payment_status === 'paid').forEach(t => addToMonth(t.created_at, t.total_amount));

    const revenueByMonth = Array.from(monthlyRevenueMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => dayjs(a.month, 'MMM YYYY').valueOf() - dayjs(b.month, 'MMM YYYY').valueOf());

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalOrders,
          totalBookings,
          totalUsers,
          revenueChange: 0,
          ordersChange: 0,
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
  } catch (error) {
    next(error);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { type, format = 'csv', range = 'month' } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Report type is required' });
    }

    // Calculate date range
    let start: string;
    const end: string = dayjs().endOf('day').toISOString();

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day').toISOString();
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day').toISOString();
    } else {
      start = dayjs().subtract(1, 'month').startOf('day').toISOString();
    }

    let data: Record<string, unknown>[] = [];
    let filename = '';

    switch (type) {
      case 'restaurant': {
        const { data: orders, error } = await supabase
          .from('restaurant_orders')
          .select('order_number, customer_name, order_type, status, subtotal, tax_amount, total_amount, payment_status, payment_method, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (orders || []).map(o => ({
          'Order Number': o.order_number,
          'Customer': o.customer_name,
          'Type': o.order_type,
          'Status': o.status,
          'Subtotal': o.subtotal,
          'Tax': o.tax_amount,
          'Total': o.total_amount,
          'Payment Status': o.payment_status,
          'Payment Method': o.payment_method,
          'Date': dayjs(o.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `restaurant-orders-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'chalets': {
        const { data: bookings, error } = await supabase
          .from('chalet_bookings')
          .select('booking_number, customer_name, customer_email, check_in_date, check_out_date, number_of_guests, number_of_nights, base_amount, total_amount, status, payment_status, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (bookings || []).map(b => ({
          'Booking Number': b.booking_number,
          'Customer': b.customer_name,
          'Email': b.customer_email,
          'Check-in': dayjs(b.check_in_date).format('YYYY-MM-DD'),
          'Check-out': dayjs(b.check_out_date).format('YYYY-MM-DD'),
          'Guests': b.number_of_guests,
          'Nights': b.number_of_nights,
          'Base Amount': b.base_amount,
          'Total': b.total_amount,
          'Status': b.status,
          'Payment': b.payment_status,
          'Booked On': dayjs(b.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `chalet-bookings-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'pool': {
        const { data: tickets, error } = await supabase
          .from('pool_tickets')
          .select('ticket_number, customer_name, ticket_date, number_of_guests, total_amount, status, payment_status, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (tickets || []).map(t => ({
          'Ticket Number': t.ticket_number,
          'Customer': t.customer_name,
          'Date': dayjs(t.ticket_date).format('YYYY-MM-DD'),
          'Guests': t.number_of_guests,
          'Total': t.total_amount,
          'Status': t.status,
          'Payment': t.payment_status,
          'Purchased': dayjs(t.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `pool-tickets-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'snack': {
        const { data: orders, error } = await supabase
          .from('snack_orders')
          .select('order_number, customer_name, status, subtotal, total_amount, payment_status, created_at')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (orders || []).map(o => ({
          'Order Number': o.order_number,
          'Customer': o.customer_name,
          'Status': o.status,
          'Subtotal': o.subtotal,
          'Total': o.total_amount,
          'Payment': o.payment_status,
          'Date': dayjs(o.created_at).format('YYYY-MM-DD HH:mm'),
        }));
        filename = `snack-orders-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      case 'users': {
        const { data: users, error } = await supabase
          .from('users')
          .select('name, email, phone, created_at, last_login, is_active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (users || []).map(u => ({
          'Name': u.name,
          'Email': u.email,
          'Phone': u.phone || '',
          'Registered': dayjs(u.created_at).format('YYYY-MM-DD'),
          'Last Login': u.last_login ? dayjs(u.last_login).format('YYYY-MM-DD HH:mm') : 'Never',
          'Active': u.is_active ? 'Yes' : 'No',
        }));
        filename = `users-${dayjs().format('YYYY-MM-DD')}`;
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(data);
    }

    // CSV format
    if (data.length === 0) {
      return res.status(200).json({ success: true, data: [], message: 'No data for the selected period' });
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')),
    ];
    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function getOccupancyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    let start: dayjs.Dayjs;
    const end = dayjs().endOf('day');

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day');
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day');
    } else {
      start = dayjs().subtract(1, 'month').startOf('day');
    }

    const daysInRange = end.diff(start, 'day') + 1;

    // 1. Chalet Occupancy
    const [chaletsResult, bookingsResult] = await Promise.all([
      supabase.from('chalets').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
      supabase.from('chalet_bookings')
        .select('number_of_nights, check_in_date, status')
        .gte('check_in_date', start.toISOString())
        .lte('check_in_date', end.toISOString())
    ]);

    const totalChalets = chaletsResult.count || 0;
    const totalChaletCapacity = totalChalets * daysInRange;
    const activeBookings = (bookingsResult.data || []).filter(b => !['cancelled', 'no_show'].includes(b.status));
    const bookedNights = activeBookings.reduce((sum, b) => sum + (b.number_of_nights || 0), 0);
    const chaletOccupancyRate = totalChaletCapacity > 0 ? (bookedNights / totalChaletCapacity) * 100 : 0;

    // 2. Pool Occupancy
    const [sessionsResult, ticketsResult] = await Promise.all([
      supabase.from('pool_sessions').select('max_capacity').eq('is_active', true),
      supabase.from('pool_tickets')
        .select('number_of_guests, status')
        .gte('ticket_date', start.toISOString())
        .lte('ticket_date', end.toISOString())
    ]);

    const dailyPoolCapacity = (sessionsResult.data || []).reduce((sum, s) => sum + (s.max_capacity || 0), 0);
    const totalPoolCapacity = dailyPoolCapacity * daysInRange;
    const activeTickets = (ticketsResult.data || []).filter(t => !['cancelled', 'no_show'].includes(t.status));
    const ticketsSold = activeTickets.reduce((sum, t) => sum + (t.number_of_guests || 0), 0);
    const poolOccupancyRate = totalPoolCapacity > 0 ? (ticketsSold / totalPoolCapacity) * 100 : 0;

    res.json({
      success: true,
      data: {
        chalets: {
          occupancyRate: Math.round(chaletOccupancyRate * 10) / 10,
          bookedNights,
          totalCapacity: totalChaletCapacity,
          activeUnits: totalChalets
        },
        pool: {
          occupancyRate: Math.round(poolOccupancyRate * 10) / 10,
          ticketsSold,
          totalCapacity: totalPoolCapacity,
          dailyCapacity: dailyPoolCapacity
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { range = 'month' } = req.query;

    let start: dayjs.Dayjs;
    const end = dayjs().endOf('day');

    if (range === 'week') {
      start = dayjs().subtract(7, 'day').startOf('day');
    } else if (range === 'year') {
      start = dayjs().subtract(1, 'year').startOf('day');
    } else {
      start = dayjs().subtract(1, 'month').startOf('day');
    }

    // Fetch transactions from all units to identify top customers
    const [restOrders, snackOrders, chaletBookings, poolTickets] = await Promise.all([
      supabase.from('restaurant_orders').select('customer_id, customer_name, total_amount, created_at').not('customer_id', 'is', null).eq('status', 'completed'),
      supabase.from('snack_orders').select('customer_id, customer_name, total_amount, created_at').not('customer_id', 'is', null).eq('status', 'completed'),
      supabase.from('chalet_bookings').select('customer_id, customer_name, total_amount, created_at').not('customer_id', 'is', null).eq('payment_status', 'paid'),
      supabase.from('pool_tickets').select('customer_id, customer_name, total_amount, created_at').not('customer_id', 'is', null).eq('payment_status', 'paid')
    ]);

    const allTransactions = [
      ...(restOrders.data || []),
      ...(snackOrders.data || []),
      ...(chaletBookings.data || []),
      ...(poolTickets.data || [])
    ];

    // Group by customer
    const customerStats = new Map<string, { name: string, revenue: number, count: number, firstDate: string }>();

    allTransactions.forEach(t => {
      const stats = customerStats.get(t.customer_id) || { name: t.customer_name, revenue: 0, count: 0, firstDate: t.created_at };
      stats.revenue += parseFloat(t.total_amount);
      stats.count += 1;
      if (dayjs(t.created_at).isBefore(dayjs(stats.firstDate))) {
        stats.firstDate = t.created_at;
      }
      customerStats.set(t.customer_id, stats);
    });

    const customersInRange = Array.from(customerStats.entries()).map(([id, stats]) => ({ id, ...stats }));

    // Top Customers
    const topCustomers = [...customersInRange]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // New vs Returning logic for the selected range
    let newCustomers = 0;
    let returningCustomers = 0;

    customersInRange.forEach(c => {
      // Check if they had ANY transaction in the selected range
      const hasTransactionInRange = allTransactions.some(t => t.customer_id === c.id && dayjs(t.created_at).isAfter(start) && dayjs(t.created_at).isBefore(end));

      if (hasTransactionInRange) {
        if (dayjs(c.firstDate).isBefore(start)) {
          returningCustomers++;
        } else {
          newCustomers++;
        }
      }
    });

    res.json({
      success: true,
      data: {
        topCustomers,
        customerRetention: {
          new: newCustomers,
          returning: returningCustomers,
          total: newCustomers + returningCustomers,
          newRatio: returningCustomers + newCustomers > 0 ? Math.round((newCustomers / (newCustomers + returningCustomers)) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
