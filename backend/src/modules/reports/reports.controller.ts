import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

// Helper to get date range
function getDateRange(startDate?: any, endDate?: any, defaultDays = 30) {
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate 
    ? new Date(startDate as string) 
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

export class ReportsController {
  /**
   * Daily sales aggregation
   */
  async getDailySalesReport(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const supabase = getSupabase();

      // Trigger aggregation for date range
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      const { data: dailyData, error } = await supabase
        .from('report_daily_sales')
        .select('*')
        .gte('report_date', start)
        .lte('report_date', end)
        .order('report_date', { ascending: false });

      if (error) throw error;

      // Summary calculations
      const summary = (dailyData || []).reduce(
        (acc, day) => {
          acc.totalRevenue += parseFloat(day.total_revenue) || 0;
          acc.totalOrders += day.order_count || 0;
          acc.totalBookings += day.booking_count || 0;
          acc.totalDiscounts += parseFloat(day.discount_total) || 0;
          acc.cashTotal += parseFloat(day.cash_revenue) || 0;
          acc.cardTotal += parseFloat(day.card_revenue) || 0;
          return acc;
        },
        { totalRevenue: 0, totalOrders: 0, totalBookings: 0, totalDiscounts: 0, cashTotal: 0, cardTotal: 0 }
      );

      res.json({
        success: true,
        data: {
          dailyData: dailyData || [],
          summary,
          dateRange: { start, end },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching daily sales report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  /**
   * Hourly performance metrics
   */
  async getHourlyMetrics(req: Request, res: Response) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];
      const supabase = getSupabase();

      const { data: hourlyData, error } = await supabase
        .from('report_hourly_metrics')
        .select('*')
        .eq('report_date', targetDate)
        .order('hour', { ascending: true });

      if (error) throw error;

      // Identify peak hours
      const peakHours = (hourlyData || [])
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 3)
        .map(h => ({ hour: h.hour, revenue: h.revenue, orders: h.order_count }));

      res.json({
        success: true,
        data: {
          hourlyData: hourlyData || [],
          peakHours,
          date: targetDate,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching hourly metrics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch metrics', message: error.message });
    }
  }

  /**
   * Product performance report
   */
  async getProductPerformance(req: Request, res: Response) {
    try {
      const { startDate, endDate, categoryId, limit = 50 } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('report_product_performance')
        .select('*')
        .order('total_revenue', { ascending: false })
        .limit(Number(limit));

      if (startDate) query = query.gte('report_date', startDate);
      if (endDate) query = query.lte('report_date', endDate);

      const { data: products, error } = await query;

      if (error) throw error;

      // Group by product
      const grouped: Record<string, any> = {};
      (products || []).forEach(p => {
        if (!grouped[p.product_id]) {
          grouped[p.product_id] = {
            productId: p.product_id,
            productName: p.product_name,
            category: p.category,
            totalQuantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
          };
        }
        grouped[p.product_id].totalQuantity += p.quantity_sold || 0;
        grouped[p.product_id].totalRevenue += parseFloat(p.total_revenue) || 0;
        grouped[p.product_id].totalCost += parseFloat(p.total_cost) || 0;
        grouped[p.product_id].totalProfit += parseFloat(p.profit) || 0;
      });

      const productList = Object.values(grouped)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate margins
      productList.forEach(p => {
        p.profitMargin = p.totalRevenue > 0 
          ? ((p.totalProfit / p.totalRevenue) * 100).toFixed(1)
          : 0;
      });

      res.json({
        success: true,
        data: {
          products: productList,
          topSellers: productList.slice(0, 10),
          lowestMargin: [...productList].sort((a, b) => parseFloat(a.profitMargin) - parseFloat(b.profitMargin)).slice(0, 10),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching product performance:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  /**
   * Cash vs Card variance report
   */
  async getCashCardVariance(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const supabase = getSupabase();

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      const { data: dailyData, error } = await supabase
        .from('report_daily_sales')
        .select('report_date, cash_revenue, card_revenue, total_revenue')
        .gte('report_date', start)
        .lte('report_date', end)
        .order('report_date');

      if (error) throw error;

      const totals = (dailyData || []).reduce(
        (acc, day) => {
          acc.cash += parseFloat(day.cash_revenue) || 0;
          acc.card += parseFloat(day.card_revenue) || 0;
          acc.total += parseFloat(day.total_revenue) || 0;
          return acc;
        },
        { cash: 0, card: 0, total: 0 }
      );

      const cashPercentage = totals.total > 0 ? ((totals.cash / totals.total) * 100).toFixed(1) : 0;
      const cardPercentage = totals.total > 0 ? ((totals.card / totals.total) * 100).toFixed(1) : 0;

      // Daily breakdown
      const dailyBreakdown = (dailyData || []).map(day => ({
        date: day.report_date,
        cash: parseFloat(day.cash_revenue) || 0,
        card: parseFloat(day.card_revenue) || 0,
        cashPercent: day.total_revenue > 0 
          ? ((parseFloat(day.cash_revenue) / parseFloat(day.total_revenue)) * 100).toFixed(1) 
          : 0,
      }));

      res.json({
        success: true,
        data: {
          summary: {
            totalCash: totals.cash,
            totalCard: totals.card,
            totalRevenue: totals.total,
            cashPercentage,
            cardPercentage,
          },
          dailyBreakdown,
          dateRange: { start, end },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching cash/card variance:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  /**
   * Stripe reconciliation report
   */
  async getStripeReconciliation(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const supabase = getSupabase();

      const start = new Date(startDate as string || Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date(endDate as string || Date.now());

      // Get our recorded payments
      const { data: ourPayments, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_method', 'card')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (paymentError) throw paymentError;

      // Get Stripe payouts (if API key is configured)
      let stripePayouts: any[] = [];
      let stripeCharges: any[] = [];
      
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const payouts = await stripe.payouts.list({
            created: {
              gte: Math.floor(start.getTime() / 1000),
              lte: Math.floor(end.getTime() / 1000),
            },
            limit: 100,
          });
          stripePayouts = payouts.data;

          const charges = await stripe.charges.list({
            created: {
              gte: Math.floor(start.getTime() / 1000),
              lte: Math.floor(end.getTime() / 1000),
            },
            limit: 100,
          });
          stripeCharges = charges.data;
        } catch (stripeError: any) {
          logger.warn('Could not fetch Stripe data:', stripeError.message);
        }
      }

      // Our totals
      const ourTotal = (ourPayments || [])
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      // Stripe totals
      const stripeTotal = stripeCharges
        .filter(c => c.status === 'succeeded')
        .reduce((sum, c) => sum + (c.amount / 100), 0);

      const stripeFees = stripeCharges
        .filter(c => c.status === 'succeeded')
        .reduce((sum, c) => sum + ((c.application_fee_amount || 0) / 100), 0);

      const variance = ourTotal - stripeTotal;

      // Find mismatches
      const mismatches: any[] = [];
      (ourPayments || []).forEach(payment => {
        if (payment.stripe_payment_id) {
          const stripeMatch = stripeCharges.find(c => c.id === payment.stripe_payment_id);
          if (!stripeMatch) {
            mismatches.push({
              type: 'missing_in_stripe',
              ourRecord: payment,
            });
          } else if (Math.abs((stripeMatch.amount / 100) - parseFloat(payment.amount)) > 0.01) {
            mismatches.push({
              type: 'amount_mismatch',
              ourRecord: payment,
              stripeRecord: stripeMatch,
            });
          }
        }
      });

      res.json({
        success: true,
        data: {
          ourTotal,
          stripeTotal,
          stripeFees,
          variance,
          variancePercent: ourTotal > 0 ? ((variance / ourTotal) * 100).toFixed(2) : 0,
          reconciled: Math.abs(variance) < 1,
          mismatches,
          payoutsSummary: stripePayouts.map(p => ({
            id: p.id,
            amount: p.amount / 100,
            status: p.status,
            arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
          })),
          dateRange: { start: start.toISOString(), end: end.toISOString() },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching Stripe reconciliation:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  /**
   * Customer cohort analysis
   */
  async getCohortAnalysis(req: Request, res: Response) {
    try {
      const { months = 6 } = req.query;
      const supabase = getSupabase();

      // Get user registration cohorts
      const cohortMonths = parseInt(months as string) || 6;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - cohortMonths);

      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, created_at')
        .gte('created_at', startDate.toISOString());

      if (userError) throw userError;

      // Group users by registration month
      const cohorts: Record<string, string[]> = {};
      (users || []).forEach(user => {
        const month = user.created_at.substring(0, 7);
        if (!cohorts[month]) cohorts[month] = [];
        cohorts[month].push(user.id);
      });

      // Get orders for these users
      const userIds = (users || []).map(u => u.id);
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('user_id, created_at, total_amount')
        .in('user_id', userIds)
        .gte('created_at', startDate.toISOString());

      if (orderError) throw orderError;

      // Calculate retention by cohort
      const cohortData = Object.entries(cohorts).map(([cohortMonth, userList]) => {
        const cohortOrders = (orders || []).filter(o => userList.includes(o.user_id));
        
        // Monthly retention
        const retention: Record<string, number> = {};
        const revenue: Record<string, number> = {};
        
        for (let i = 0; i < cohortMonths; i++) {
          const targetMonth = new Date(cohortMonth + '-01');
          targetMonth.setMonth(targetMonth.getMonth() + i);
          const monthKey = targetMonth.toISOString().substring(0, 7);
          
          const activeUsers = new Set(
            cohortOrders
              .filter(o => o.created_at.substring(0, 7) === monthKey)
              .map(o => o.user_id)
          );
          
          retention[`month_${i}`] = activeUsers.size;
          revenue[`month_${i}`] = cohortOrders
            .filter(o => o.created_at.substring(0, 7) === monthKey)
            .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        }

        return {
          cohort: cohortMonth,
          size: userList.length,
          retention,
          revenue,
          retentionRates: Object.fromEntries(
            Object.entries(retention).map(([k, v]) => [k, ((v / userList.length) * 100).toFixed(1)])
          ),
        };
      });

      res.json({
        success: true,
        data: {
          cohorts: cohortData.sort((a, b) => a.cohort.localeCompare(b.cohort)),
          totalUsers: (users || []).length,
          totalOrders: (orders || []).length,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching cohort analysis:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  /**
   * Time series analysis
   */
  async getTimeSeries(req: Request, res: Response) {
    try {
      const { metric, granularity = 'day', startDate, endDate } = req.query;
      const supabase = getSupabase();

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();

      let data: any[] = [];

      switch (metric) {
        case 'revenue':
          const { data: revenueData } = await supabase
            .from('report_daily_sales')
            .select('report_date, total_revenue')
            .gte('report_date', start)
            .lte('report_date', end)
            .order('report_date');
          data = (revenueData || []).map(d => ({ date: d.report_date, value: parseFloat(d.total_revenue) || 0 }));
          break;

        case 'orders':
          const { data: orderData } = await supabase
            .from('report_daily_sales')
            .select('report_date, order_count')
            .gte('report_date', start)
            .lte('report_date', end)
            .order('report_date');
          data = (orderData || []).map(d => ({ date: d.report_date, value: d.order_count || 0 }));
          break;

        case 'bookings':
          const { data: bookingData } = await supabase
            .from('report_daily_sales')
            .select('report_date, booking_count')
            .gte('report_date', start)
            .lte('report_date', end)
            .order('report_date');
          data = (bookingData || []).map(d => ({ date: d.report_date, value: d.booking_count || 0 }));
          break;

        case 'aov':
          const { data: aovData } = await supabase
            .from('report_daily_sales')
            .select('report_date, average_order_value')
            .gte('report_date', start)
            .lte('report_date', end)
            .order('report_date');
          data = (aovData || []).map(d => ({ date: d.report_date, value: parseFloat(d.average_order_value) || 0 }));
          break;

        default:
          return res.status(400).json({ success: false, error: 'Invalid metric' });
      }

      // Calculate trend
      const values = data.map(d => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const trend = secondAvg > firstAvg ? 'up' : secondAvg < firstAvg ? 'down' : 'stable';
      const trendPercent = firstAvg > 0 ? (((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1) : 0;

      res.json({
        success: true,
        data: {
          series: data,
          summary: {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: avg.toFixed(2),
            trend,
            trendPercent,
          },
          metric,
          granularity,
          dateRange: { start, end },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching time series:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch time series', message: error.message });
    }
  }

  /**
   * Trigger daily aggregation
   */
  async triggerDailyAggregation(req: Request, res: Response) {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split('T')[0];
      const supabase = getSupabase();

      // Call the aggregation function
      const { data, error } = await supabase.rpc('aggregate_daily_sales', {
        p_date: targetDate,
      });

      if (error) throw error;

      res.json({
        success: true,
        message: `Aggregation completed for ${targetDate}`,
        data,
      });
    } catch (error: any) {
      logger.error('Error triggering aggregation:', error);
      res.status(500).json({ success: false, error: 'Failed to trigger aggregation', message: error.message });
    }
  }

  /**
   * Export report data
   */
  async exportReport(req: Request, res: Response) {
    try {
      const { reportType, format = 'json', startDate, endDate } = req.query;
      const supabase = getSupabase();

      let data: any;

      switch (reportType) {
        case 'daily_sales':
          const { data: salesData } = await supabase
            .from('report_daily_sales')
            .select('*')
            .gte('report_date', startDate)
            .lte('report_date', endDate)
            .order('report_date');
          data = salesData;
          break;

        case 'product_performance':
          const { data: productData } = await supabase
            .from('report_product_performance')
            .select('*')
            .gte('report_date', startDate)
            .lte('report_date', endDate)
            .order('total_revenue', { ascending: false });
          data = productData;
          break;

        default:
          return res.status(400).json({ success: false, error: 'Invalid report type' });
      }

      if (format === 'csv') {
        if (!data || data.length === 0) {
          return res.status(404).json({ success: false, error: 'No data found' });
        }
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row: any) => Object.values(row).join(','));
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${startDate}_${endDate}.csv"`);
        return res.send(csv);
      }

      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error exporting report:', error);
      res.status(500).json({ success: false, error: 'Failed to export report', message: error.message });
    }
  }

// =======================
// COMPREHENSIVE REPORT METHODS
// =======================

/**
 * 1. EXECUTIVE OVERVIEW (Landing Dashboard)
 */
async getExecutiveOverview(req: Request, res: Response) {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    // Today's data
    const { data: todayData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .eq('report_date', today)
      .single();

    // MTD data
    const { data: mtdData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .gte('report_date', mtdStart)
      .lte('report_date', today);

    // YTD data  
    const { data: ytdData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .gte('report_date', ytdStart)
      .lte('report_date', today);

    // Calculate summaries
    const sumData = (data: any[]) => (data || []).reduce((acc, d) => ({
      revenue: acc.revenue + (parseFloat(d.total_revenue) || 0),
      orders: acc.orders + (d.order_count || 0),
      bookings: acc.bookings + (d.booking_count || 0),
      discounts: acc.discounts + (parseFloat(d.discount_total) || 0),
      refunds: acc.refunds + (parseFloat(d.refund_total) || 0),
    }), { revenue: 0, orders: 0, bookings: 0, discounts: 0, refunds: 0 });

    const mtdSummary = sumData(mtdData || []);
    const ytdSummary = sumData(ytdData || []);

    // Active customers (users who ordered in last 30 days)
    const { count: activeCustomers } = await supabase
      .from('orders')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Order failures (cancelled/failed orders)
    const { data: failedOrders } = await supabase
      .from('orders')
      .select('id')
      .in('status', ['cancelled', 'failed'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Payment failures
    const { data: failedPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Previous period comparison (for growth %)
    const prevMtdStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMtdEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
    const { data: prevMtdData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .gte('report_date', prevMtdStart)
      .lte('report_date', prevMtdEnd);
    const prevMtdSummary = sumData(prevMtdData || []);

    const growthPercent = prevMtdSummary.revenue > 0 
      ? (((mtdSummary.revenue - prevMtdSummary.revenue) / prevMtdSummary.revenue) * 100).toFixed(1)
      : 0;

    const aov = mtdSummary.orders > 0 ? (mtdSummary.revenue / mtdSummary.orders).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        today: {
          revenue: todayData?.total_revenue || 0,
          orders: todayData?.order_count || 0,
          bookings: todayData?.booking_count || 0,
        },
        mtd: {
          revenue: mtdSummary.revenue,
          netRevenue: mtdSummary.revenue - mtdSummary.discounts - mtdSummary.refunds,
          orders: mtdSummary.orders,
          bookings: mtdSummary.bookings,
          discounts: mtdSummary.discounts,
          refunds: mtdSummary.refunds,
        },
        ytd: {
          revenue: ytdSummary.revenue,
          orders: ytdSummary.orders,
          bookings: ytdSummary.bookings,
        },
        growth: {
          orderGrowthPercent: growthPercent,
          revenueGrowthPercent: growthPercent,
        },
        aov,
        activeCustomers: activeCustomers || 0,
        systemHealth: {
          orderFailures24h: (failedOrders || []).length,
          paymentFailures24h: (failedPayments || []).length,
          status: (failedOrders || []).length + (failedPayments || []).length < 5 ? 'healthy' : 'warning',
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching executive overview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview', message: error.message });
  }
};

/**
 * 3. ORDER FLOW & OPERATIONS
 */
async getOrderFlow(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 7);
    const supabase = getSupabase();

    // Get orders with status history
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at, updated_at, total_amount')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Status funnel
    const statusCounts: Record<string, number> = {};
    (orders || []).forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    // Calculate avg times (mock for now - would need status_history table)
    const totalOrders = (orders || []).length;
    const completedOrders = (orders || []).filter(o => o.status === 'completed');
    const cancelledOrders = (orders || []).filter(o => o.status === 'cancelled');

    // Orders per hour
    const hourlyOrders: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyOrders[i] = 0;
    (orders || []).forEach(o => {
      const hour = new Date(o.created_at).getHours();
      hourlyOrders[hour]++;
    });

    // Peak hours
    const peakHours = Object.entries(hourlyOrders)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    // Bottleneck detection (simplified)
    const avgPrepTime = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => {
          const created = new Date(o.created_at).getTime();
          const updated = new Date(o.updated_at).getTime();
          return sum + (updated - created);
        }, 0) / completedOrders.length / 60000 // minutes
      : 0;

    res.json({
      success: true,
      data: {
        funnel: {
          placed: statusCounts['pending'] || 0,
          accepted: statusCounts['confirmed'] || 0,
          preparing: statusCounts['preparing'] || 0,
          ready: statusCounts['ready'] || 0,
          completed: statusCounts['completed'] || 0,
          cancelled: statusCounts['cancelled'] || 0,
        },
        metrics: {
          totalOrders,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          cancellationRate: totalOrders > 0 ? ((cancelledOrders.length / totalOrders) * 100).toFixed(1) : 0,
          avgPrepTimeMinutes: avgPrepTime.toFixed(1),
        },
        hourlyDistribution: Object.entries(hourlyOrders).map(([hour, count]) => ({
          hour: parseInt(hour),
          count,
        })),
        peakHours,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching order flow:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order flow', message: error.message });
  }
};

/**
 * 4. CUSTOMER INTELLIGENCE (Extended)
 */
async getCustomerIntelligence(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 90);
    const supabase = getSupabase();

    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('id, created_at')
      .eq('status', 'active');

    // Get orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, user_id, created_at, total_amount, status')
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // New vs returning
    const newUserIds = new Set(
      (users || [])
        .filter(u => new Date(u.created_at) >= start && new Date(u.created_at) <= end)
        .map(u => u.id)
    );

    const ordersByUser: Record<string, any[]> = {};
    (orders || []).forEach(o => {
      if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = [];
      ordersByUser[o.user_id].push(o);
    });

    let newCustomerRevenue = 0;
    let returningCustomerRevenue = 0;
    const newCustomerOrders: string[] = [];
    const returningCustomerOrders: string[] = [];

    Object.entries(ordersByUser).forEach(([userId, userOrders]) => {
      const revenue = userOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      if (newUserIds.has(userId)) {
        newCustomerRevenue += revenue;
        newCustomerOrders.push(userId);
      } else {
        returningCustomerRevenue += revenue;
        returningCustomerOrders.push(userId);
      }
    });

    // Customer Lifetime Value (CLV) - simplified
    const totalRevenue = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const uniqueCustomers = Object.keys(ordersByUser).length;
    const avgCLV = uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;

    // Top customers
    const topCustomers = Object.entries(ordersByUser)
      .map(([userId, userOrders]) => ({
        userId,
        orderCount: userOrders.length,
        totalRevenue: userOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Retention (ordered in last 30 days who also ordered 30-60 days ago)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    
    const recentCustomers = new Set(
      (orders || [])
        .filter(o => new Date(o.created_at) >= thirtyDaysAgo)
        .map(o => o.user_id)
    );
    
    const previousCustomers = new Set(
      (orders || [])
        .filter(o => new Date(o.created_at) >= sixtyDaysAgo && new Date(o.created_at) < thirtyDaysAgo)
        .map(o => o.user_id)
    );

    const retainedCustomers = [...previousCustomers].filter(id => recentCustomers.has(id));
    const retentionRate = previousCustomers.size > 0 
      ? ((retainedCustomers.length / previousCustomers.size) * 100).toFixed(1)
      : 0;

    // Churned customers (ordered 60-90 days ago, not since)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oldCustomers = new Set(
      (orders || [])
        .filter(o => new Date(o.created_at) >= ninetyDaysAgo && new Date(o.created_at) < sixtyDaysAgo)
        .map(o => o.user_id)
    );
    const churnedCustomers = [...oldCustomers].filter(id => !recentCustomers.has(id) && !previousCustomers.has(id));

    res.json({
      success: true,
      data: {
        overview: {
          totalCustomers: uniqueCustomers,
          newCustomers: newCustomerOrders.length,
          returningCustomers: returningCustomerOrders.length,
        },
        revenue: {
          newCustomerRevenue,
          returningCustomerRevenue,
          newCustomerPercent: totalRevenue > 0 ? ((newCustomerRevenue / totalRevenue) * 100).toFixed(1) : 0,
        },
        retention: {
          rate30Day: retentionRate,
          retainedCustomers: retainedCustomers.length,
          churnedCustomers: churnedCustomers.length,
        },
        clv: {
          average: avgCLV.toFixed(2),
        },
        topCustomers,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching customer intelligence:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer intelligence', message: error.message });
  }
};

/**
 * 5. PRODUCT & MENU PERFORMANCE (Extended)
 */
async getMenuPerformance(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 30);
    const supabase = getSupabase();

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        id, quantity, unit_price, total_price, 
        product_id, product_name, 
        order_id,
        orders!inner(created_at, status)
      `)
      .gte('orders.created_at', start.toISOString())
      .lte('orders.created_at', end.toISOString())
      .eq('orders.status', 'completed');

    // Aggregate by product
    const productStats: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      const id = item.product_id;
      if (!productStats[id]) {
        productStats[id] = {
          productId: id,
          productName: item.product_name,
          quantity: 0,
          revenue: 0,
          orders: new Set(),
        };
      }
      productStats[id].quantity += item.quantity || 0;
      productStats[id].revenue += parseFloat(item.total_price) || 0;
      productStats[id].orders.add(item.order_id);
    });

    const products = Object.values(productStats).map((p: any) => ({
      ...p,
      orderCount: p.orders.size,
      orders: undefined,
    }));

    // Top sellers
    const topSellers = [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    // Worst performers
    const worstPerformers = [...products].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

    // Time-based popularity (simplified - morning vs afternoon vs evening)
    const timeBasedSales: Record<string, Record<string, number>> = {
      morning: {},    // 6-12
      afternoon: {},  // 12-18
      evening: {},    // 18-24
      night: {},      // 0-6
    };

    (orderItems || []).forEach((item: any) => {
      const hour = new Date(item.orders.created_at).getHours();
      let period = 'night';
      if (hour >= 6 && hour < 12) period = 'morning';
      else if (hour >= 12 && hour < 18) period = 'afternoon';
      else if (hour >= 18) period = 'evening';

      if (!timeBasedSales[period][item.product_name]) {
        timeBasedSales[period][item.product_name] = 0;
      }
      timeBasedSales[period][item.product_name] += item.quantity || 0;
    });

    // Get top item for each period
    const timeBasedTop = Object.entries(timeBasedSales).map(([period, items]) => {
      const sorted = Object.entries(items).sort(([,a], [,b]) => b - a);
      return {
        period,
        topItem: sorted[0]?.[0] || 'N/A',
        quantity: sorted[0]?.[1] || 0,
      };
    });

    // Attach rate (items frequently ordered together)
    const orderProducts: Record<string, string[]> = {};
    (orderItems || []).forEach((item: any) => {
      if (!orderProducts[item.order_id]) orderProducts[item.order_id] = [];
      orderProducts[item.order_id].push(item.product_name);
    });

    const pairCounts: Record<string, number> = {};
    Object.values(orderProducts).forEach(products => {
      if (products.length > 1) {
        for (let i = 0; i < products.length; i++) {
          for (let j = i + 1; j < products.length; j++) {
            const pair = [products[i], products[j]].sort().join(' + ');
            pairCounts[pair] = (pairCounts[pair] || 0) + 1;
          }
        }
      }
    });

    const topPairs = Object.entries(pairCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }));

    res.json({
      success: true,
      data: {
        products,
        topSellers,
        worstPerformers,
        timeBasedPopularity: timeBasedTop,
        frequentlyBoughtTogether: topPairs,
        summary: {
          totalProducts: products.length,
          totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
          totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        },
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching menu performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch menu performance', message: error.message });
  }
};

/**
 * 6. PAYMENTS & FINANCE (Extended)
 */
async getPaymentsFinance(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 30);
    const supabase = getSupabase();

    // Get payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Group by method
    const byMethod: Record<string, { count: number; amount: number; failed: number }> = {};
    (payments || []).forEach(p => {
      const method = p.payment_method || 'unknown';
      if (!byMethod[method]) byMethod[method] = { count: 0, amount: 0, failed: 0 };
      byMethod[method].count++;
      if (p.status === 'completed') {
        byMethod[method].amount += parseFloat(p.amount) || 0;
      }
      if (p.status === 'failed') {
        byMethod[method].failed++;
      }
    });

    // Refunds
    const { data: refunds } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'refunded')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const refundTotal = (refunds || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // Outstanding (pending payments)
    const { data: outstanding } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const outstandingTotal = (outstanding || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Daily breakdown
    const dailyPayments: Record<string, { cash: number; card: number; total: number }> = {};
    (payments || []).filter(p => p.status === 'completed').forEach(p => {
      const date = p.created_at.split('T')[0];
      if (!dailyPayments[date]) dailyPayments[date] = { cash: 0, card: 0, total: 0 };
      const amount = parseFloat(p.amount) || 0;
      dailyPayments[date].total += amount;
      if (p.payment_method === 'cash') dailyPayments[date].cash += amount;
      else dailyPayments[date].card += amount;
    });

    const totals = Object.values(byMethod).reduce(
      (acc, m) => ({ count: acc.count + m.count, amount: acc.amount + m.amount, failed: acc.failed + m.failed }),
      { count: 0, amount: 0, failed: 0 }
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalPayments: totals.count,
          totalRevenue: totals.amount,
          failedPayments: totals.failed,
          failureRate: totals.count > 0 ? ((totals.failed / totals.count) * 100).toFixed(1) : 0,
        },
        byMethod: Object.entries(byMethod).map(([method, stats]) => ({
          method,
          ...stats,
          percentage: totals.amount > 0 ? ((stats.amount / totals.amount) * 100).toFixed(1) : 0,
        })),
        refunds: {
          count: (refunds || []).length,
          total: refundTotal,
        },
        outstanding: {
          count: (outstanding || []).length,
          total: outstandingTotal,
        },
        dailyReconciliation: Object.entries(dailyPayments)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, data]) => ({ date, ...data })),
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching payments finance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments finance', message: error.message });
  }
};

/**
 * 7. CAPACITY & UTILIZATION
 */
async getCapacityUtilization(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 30);
    const supabase = getSupabase();

    // Get units/rooms
    const { data: units } = await supabase
      .from('units')
      .select('id, name, type, capacity, price_per_night');

    // Get bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, unit_id, check_in, check_out, status, total_amount')
      .gte('check_in', start.toISOString())
      .lte('check_out', end.toISOString());

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const totalUnits = (units || []).length;
    const totalCapacity = totalUnits * totalDays;

    // Calculate occupancy
    let totalBookedDays = 0;
    const unitStats: Record<string, { bookedDays: number; revenue: number; noShows: number }> = {};

    (units || []).forEach(u => {
      unitStats[u.id] = { bookedDays: 0, revenue: 0, noShows: 0 };
    });

    (bookings || []).forEach(b => {
      if (b.status === 'cancelled') return;
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);
      const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000));
      
      totalBookedDays += days;
      if (unitStats[b.unit_id]) {
        unitStats[b.unit_id].bookedDays += days;
        unitStats[b.unit_id].revenue += parseFloat(b.total_amount) || 0;
      }
      if (b.status === 'no_show') {
        if (unitStats[b.unit_id]) unitStats[b.unit_id].noShows++;
      }
    });

    const occupancyRate = totalCapacity > 0 ? ((totalBookedDays / totalCapacity) * 100).toFixed(1) : 0;

    // Revenue per unit
    const unitPerformance = (units || []).map(u => {
      const stats = unitStats[u.id] || { bookedDays: 0, revenue: 0, noShows: 0 };
      return {
        unitId: u.id,
        unitName: u.name,
        type: u.type,
        bookedDays: stats.bookedDays,
        revenue: stats.revenue,
        occupancyRate: totalDays > 0 ? ((stats.bookedDays / totalDays) * 100).toFixed(1) : 0,
        revPAR: totalDays > 0 ? (stats.revenue / totalDays).toFixed(2) : 0, // Revenue per available room
        noShows: stats.noShows,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Booking conversion (completed vs total)
    const totalBookings = (bookings || []).length;
    const completedBookings = (bookings || []).filter(b => b.status === 'completed' || b.status === 'checked_out').length;
    const noShowBookings = (bookings || []).filter(b => b.status === 'no_show').length;

    res.json({
      success: true,
      data: {
        overview: {
          totalUnits,
          totalCapacityDays: totalCapacity,
          bookedDays: totalBookedDays,
          occupancyRate,
        },
        bookingMetrics: {
          totalBookings,
          completedBookings,
          noShowBookings,
          conversionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0,
          noShowRate: totalBookings > 0 ? ((noShowBookings / totalBookings) * 100).toFixed(1) : 0,
        },
        unitPerformance,
        revenue: {
          total: unitPerformance.reduce((sum, u) => sum + u.revenue, 0),
          avgRevPAR: totalUnits > 0 
            ? (unitPerformance.reduce((sum, u) => sum + parseFloat(u.revPAR as string), 0) / totalUnits).toFixed(2)
            : 0,
        },
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching capacity utilization:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch capacity utilization', message: error.message });
  }
};

/**
 * 8. STAFF & SYSTEM PERFORMANCE
 */
async getStaffPerformance(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 7);
    const supabase = getSupabase();

    // Get staff users
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, roles')
      .contains('roles', ['staff']);

    // Get orders handled by staff
    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_by, created_at, updated_at, status, total_amount')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Group by staff
    const staffStats: Record<string, { orders: number; revenue: number; avgTime: number; completed: number }> = {};
    (staff || []).forEach(s => {
      staffStats[s.id] = { orders: 0, revenue: 0, avgTime: 0, completed: 0 };
    });

    const handlingTimes: Record<string, number[]> = {};
    (orders || []).forEach(o => {
      if (o.created_by && staffStats[o.created_by]) {
        staffStats[o.created_by].orders++;
        staffStats[o.created_by].revenue += parseFloat(o.total_amount) || 0;
        if (o.status === 'completed') {
          staffStats[o.created_by].completed++;
          const time = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
          if (!handlingTimes[o.created_by]) handlingTimes[o.created_by] = [];
          handlingTimes[o.created_by].push(time);
        }
      }
    });

    // Calculate avg handling times
    Object.entries(handlingTimes).forEach(([staffId, times]) => {
      if (times.length > 0 && staffStats[staffId]) {
        staffStats[staffId].avgTime = times.reduce((a, b) => a + b, 0) / times.length / 60000; // minutes
      }
    });

    const staffPerformance = (staff || []).map(s => {
      const stats = staffStats[s.id];
      return {
        staffId: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
        ordersHandled: stats?.orders || 0,
        revenue: stats?.revenue || 0,
        completedOrders: stats?.completed || 0,
        avgHandlingTimeMinutes: stats?.avgTime?.toFixed(1) || 0,
      };
    }).sort((a, b) => b.ordersHandled - a.ordersHandled);

    // Get audit logs for system usage
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('user_id, action, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .limit(1000);

    // Login activity
    const loginsByStaff: Record<string, number> = {};
    (auditLogs || []).forEach(log => {
      if (log.action === 'LOGIN' && log.user_id) {
        loginsByStaff[log.user_id] = (loginsByStaff[log.user_id] || 0) + 1;
      }
    });

    // Error/override logs
    const overrideLogs = (auditLogs || []).filter(log => 
      log.action.includes('OVERRIDE') || log.action.includes('DISCOUNT') || log.action.includes('REFUND')
    );

    res.json({
      success: true,
      data: {
        staffPerformance,
        systemUsage: {
          totalLogins: Object.values(loginsByStaff).reduce((a, b) => a + b, 0),
          loginsByStaff: Object.entries(loginsByStaff).map(([userId, count]) => {
            const staffMember = (staff || []).find(s => s.id === userId);
            return {
              userId,
              name: staffMember ? `${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim() : 'Unknown',
              logins: count,
            };
          }).sort((a, b) => b.logins - a.logins),
        },
        overrides: {
          count: overrideLogs.length,
          logs: overrideLogs.slice(0, 20).map(log => ({
            action: log.action,
            userId: log.user_id,
            timestamp: log.created_at,
          })),
        },
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching staff performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch staff performance', message: error.message });
  }
};

/**
 * 9. COMPARATIVE & TREND ANALYSIS
 */
async getComparativeAnalysis(req: Request, res: Response) {
  try {
    const { metric = 'revenue', compareType = 'mom' } = req.query; // mom = month-over-month, wow = week-over-week
    const supabase = getSupabase();

    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    if (compareType === 'wow') {
      // Week over week
      currentEnd = new Date(now);
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // Month over month
      currentEnd = new Date(now);
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth() - 1, 1);
    }

    // Get data for both periods
    const { data: currentData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .gte('report_date', currentStart.toISOString().split('T')[0])
      .lte('report_date', currentEnd.toISOString().split('T')[0]);

    const { data: previousData } = await supabase
      .from('report_daily_sales')
      .select('*')
      .gte('report_date', previousStart.toISOString().split('T')[0])
      .lte('report_date', previousEnd.toISOString().split('T')[0]);

    // Calculate metrics
    const sumMetric = (data: any[], field: string) => 
      (data || []).reduce((sum, d) => sum + (parseFloat(d[field]) || d[field] || 0), 0);

    const metrics = ['total_revenue', 'order_count', 'booking_count', 'average_order_value'];
    const comparison: Record<string, any> = {};

    metrics.forEach(m => {
      const current = sumMetric(currentData || [], m);
      const previous = sumMetric(previousData || [], m);
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      
      comparison[m] = {
        current,
        previous,
        change: change.toFixed(1),
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      };
    });

    // Daily trend for current period
    const dailyTrend = (currentData || []).map(d => ({
      date: d.report_date,
      revenue: parseFloat(d.total_revenue) || 0,
      orders: d.order_count || 0,
    }));

    // Anomaly detection (simple: values > 2 std dev from mean)
    const values = dailyTrend.map(d => d.revenue);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    
    const anomalies = dailyTrend.filter(d => Math.abs(d.revenue - mean) > 2 * stdDev);

    // Forecast (simple linear regression)
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, v, i) => sum + v * i, 0);
    const xxSum = values.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = n > 1 ? (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum) : 0;
    const intercept = n > 0 ? (ySum - slope * xSum) / n : 0;
    
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentEnd);
      date.setDate(date.getDate() + i + 1);
      forecast.push({
        date: date.toISOString().split('T')[0],
        predictedRevenue: Math.max(0, intercept + slope * (n + i)).toFixed(2),
      });
    }

    res.json({
      success: true,
      data: {
        compareType,
        periods: {
          current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
          previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() },
        },
        comparison,
        dailyTrend,
        anomalies,
        forecast,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching comparative analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comparative analysis', message: error.message });
  }
};

/**
 * 10. EXPORT & AUDIT
 */
async getAuditReport(req: Request, res: Response) {
  try {
    const { startDate, endDate, type, userId } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 30);
    const supabase = getSupabase();

    let query = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (type) {
      query = query.eq('action', type);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: auditLogs, error } = await query;

    if (error) throw error;

    // Group by action type
    const byAction: Record<string, number> = {};
    (auditLogs || []).forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    });

    // Group by user
    const byUser: Record<string, number> = {};
    (auditLogs || []).forEach(log => {
      if (log.user_id) {
        byUser[log.user_id] = (byUser[log.user_id] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        logs: auditLogs || [],
        summary: {
          total: (auditLogs || []).length,
          byAction: Object.entries(byAction).map(([action, count]) => ({ action, count })),
          byUser: Object.entries(byUser).map(([userId, count]) => ({ userId, count })),
        },
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching audit report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit report', message: error.message });
  }
};

/**
 * Export comprehensive report (PDF/Excel placeholder)
 */
async exportComprehensiveReport(req: Request, res: Response) {
  try {
    const { format = 'json', reportTypes, startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate, 30);
    const supabase = getSupabase();

    const types = reportTypes ? (reportTypes as string).split(',') : ['daily_sales', 'product_performance'];
    const exportData: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      reports: {},
    };

    for (const type of types) {
      switch (type) {
        case 'daily_sales':
          const { data: salesData } = await supabase
            .from('report_daily_sales')
            .select('*')
            .gte('report_date', start.toISOString().split('T')[0])
            .lte('report_date', end.toISOString().split('T')[0]);
          exportData.reports.daily_sales = salesData;
          break;
        case 'product_performance':
          const { data: productData } = await supabase
            .from('report_product_performance')
            .select('*')
            .gte('report_date', start.toISOString().split('T')[0])
            .lte('report_date', end.toISOString().split('T')[0]);
          exportData.reports.product_performance = productData;
          break;
        case 'payments':
          const { data: paymentData } = await supabase
            .from('payments')
            .select('*')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
          exportData.reports.payments = paymentData;
          break;
        case 'orders':
          const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
          exportData.reports.orders = orderData;
          break;
        case 'bookings':
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('*')
            .gte('check_in', start.toISOString())
            .lte('check_out', end.toISOString());
          exportData.reports.bookings = bookingData;
          break;
      }
    }

    if (format === 'csv') {
      // Flatten all reports into a single CSV per report type
      const csvParts: string[] = [];
      Object.entries(exportData.reports).forEach(([reportName, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]).join(',');
          const rows = data.map((row: any) => Object.values(row).map(v => 
            typeof v === 'string' && v.includes(',') ? `"${v}"` : v
          ).join(','));
          csvParts.push(`=== ${reportName.toUpperCase()} ===\n${headers}\n${rows.join('\n')}`);
        }
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="comprehensive_report_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv"`);
      return res.send(csvParts.join('\n\n'));
    }

    res.json({ success: true, data: exportData });
  } catch (error: any) {
    logger.error('Error exporting comprehensive report:', error);
    res.status(500).json({ success: false, error: 'Failed to export report', message: error.message });
  }
}
}

export const reportsController = new ReportsController();


