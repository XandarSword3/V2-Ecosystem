import { getSupabase } from '../../database/connection.js';
import dayjs from 'dayjs';
import { z } from 'zod';

export interface Transaction {
  id: string;
  engine_type: string;
  module_id: string;
  property_id: string;
  amount: number | string;
  status: string;
  customer_id: string | null;
  staff_id: string | null;
  created_at: string;
  discount_amount?: number | string;
  promo_code?: string;
  refund_amount?: number | string;
}

export interface DateRangeParams {
  from: string;
  to: string;
  propertyId?: string;
  moduleId?: string;
  engineType?: string;
}

// Ensure amount is parsed securely
const toNum = (val: string | number | undefined | null): number => {
  if (!val) return 0;
  return typeof val === 'string' ? parseFloat(val) : val;
};

// Helper to fetch transactions with base filtering
async function fetchTransactions(params: DateRangeParams) {
  const supabase = getSupabase();
  let query = supabase
    .from('transactions')
    .select('*')
    .gte('created_at', params.from)
    .lte('created_at', params.to);

  if (params.propertyId) query = query.eq('property_id', params.propertyId);
  if (params.moduleId) query = query.eq('module_id', params.moduleId);
  if (params.engineType) query = query.eq('engine_type', params.engineType);

  // Load a maximum of 50000 rows for in-memory processing to avoid limits
  // In production, complex analytical queries should use SQL views/RPCs
  query = query.limit(50000);

  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []) as Transaction[];
}

export const economicsService = {
  // Revenue Queries
  async getRevenueOverTime(params: DateRangeParams & { interval: 'hour' | 'day' | 'week' | 'month' }) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void');

    const groupedMap = new Map<string, Record<string, number>>();

    completed.forEach(t => {
      let format = 'YYYY-MM-DD';
      if (params.interval === 'hour') format = 'YYYY-MM-DD HH:00';
      if (params.interval === 'month') format = 'YYYY-MM';

      const timeKey = dayjs(t.created_at).startOf(params.interval).format(format);
      if (!groupedMap.has(timeKey)) groupedMap.set(timeKey, {});
      
      const timeData = groupedMap.get(timeKey)!;
      const engine = t.engine_type || 'unknown';
      timeData[engine] = (timeData[engine] || 0) + toNum(t.amount);
    });

    const result = Array.from(groupedMap.entries()).map(([time, engines]) => ({
      time,
      ...engines,
    })).sort((a, b) => a.time.localeCompare(b.time));

    return result;
  },

  async getRevenueByModule(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    
    const revenueMap = new Map<string, { revenue: number, count: number, moduleName: string, refundCount: number }>();
    
    txs.forEach(t => {
      const module = t.module_id || 'unknown';
      if (!revenueMap.has(module)) revenueMap.set(module, { revenue: 0, count: 0, moduleName: module, refundCount: 0 });
      const current = revenueMap.get(module)!;
      
      if (t.status === 'refunded') {
        current.refundCount += 1;
      } else if (t.status !== 'cancelled' && t.status !== 'void') {
        current.revenue += toNum(t.amount);
        current.count += 1;
      }
    });

    return Array.from(revenueMap.values())
      .map(r => {
        const totalAttempts = r.count + r.refundCount;
        return { 
          ...r, 
          averageValue: r.count > 0 ? r.revenue / r.count : 0,
          refundRate: totalAttempts > 0 ? (r.refundCount / totalAttempts) * 100 : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },

  async getRevenueByEngineType(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void');
    const revenueMap = new Map<string, number>();

    completed.forEach(t => {
      const engine = t.engine_type || 'unknown';
      revenueMap.set(engine, (revenueMap.get(engine) || 0) + toNum(t.amount));
    });

    return Array.from(revenueMap.entries())
      .map(([engine_type, revenue]) => ({ engine_type, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  async getGrossVsNet(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    
    let gross = 0;
    let discounts = 0;
    let refunds = 0;
    let net = 0;

    txs.forEach(t => {
      const amount = toNum(t.amount);
      const discount = toNum(t.discount_amount);
      const refund = toNum(t.refund_amount);

      if (t.status === 'refunded') {
        refunds += amount;
      } else if (t.status !== 'cancelled' && t.status !== 'void') {
        net += amount;
        discounts += discount;
        gross += (amount + discount);
      }
    });

    return { gross, discounts, refunds, net };
  },

  // Volume Queries
  async getTransactionVolume(params: DateRangeParams & { interval: 'hour' | 'day' | 'week' | 'month' }) {
    const txs = await fetchTransactions(params);
    const groupedMap = new Map<string, number>();

    txs.forEach(t => {
      let format = 'YYYY-MM-DD';
      if (params.interval === 'hour') format = 'YYYY-MM-DD HH:00';
      if (params.interval === 'month') format = 'YYYY-MM';

      const timeKey = dayjs(t.created_at).startOf(params.interval).format(format);
      groupedMap.set(timeKey, (groupedMap.get(timeKey) || 0) + 1);
    });

    return Array.from(groupedMap.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));
  },

  async getAverageTransactionValue(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void');
    
    let totalRevenue = 0;
    const engineMap = new Map<string, { revenue: number, count: number }>();

    completed.forEach(t => {
      const amount = toNum(t.amount);
      const engine = t.engine_type || 'unknown';
      totalRevenue += amount;
      
      if (!engineMap.has(engine)) engineMap.set(engine, { revenue: 0, count: 0 });
      const current = engineMap.get(engine)!;
      current.revenue += amount;
      current.count += 1;
    });

    const overall = completed.length > 0 ? totalRevenue / completed.length : 0;
    const byEngine = Array.from(engineMap.entries()).map(([engine_type, data]) => ({
      engine_type,
      average: data.count > 0 ? data.revenue / data.count : 0
    }));

    return { overall, byEngine };
  },

  async getPeakHours(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void');
    
    const hoursMap = new Map<number, { revenue: number, count: number }>();
    for (let i = 0; i < 24; i++) hoursMap.set(i, { revenue: 0, count: 0 });

    completed.forEach(t => {
      const hour = dayjs(t.created_at).hour();
      const amount = toNum(t.amount);
      const current = hoursMap.get(hour)!;
      current.revenue += amount;
      current.count += 1;
    });

    // Calculate number of days in range for average
    const days = Math.max(1, dayjs(params.to).diff(dayjs(params.from), 'day'));

    return Array.from(hoursMap.entries()).map(([hour, data]) => ({
      hour,
      averageRevenue: data.revenue / days,
      transactionCount: data.count
    })).sort((a, b) => a.hour - b.hour);
  },

  // Customer Queries
  async getTopCustomers(params: DateRangeParams & { limit?: number }) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void' && t.customer_id);
    
    const customerMap = new Map<string, { spend: number, transactions: number }>();
    completed.forEach(t => {
      const cust = t.customer_id!;
      if (!customerMap.has(cust)) customerMap.set(cust, { spend: 0, transactions: 0 });
      const current = customerMap.get(cust)!;
      current.spend += toNum(t.amount);
      current.transactions += 1;
    });

    return Array.from(customerMap.entries())
      .map(([customer_id, data]) => ({ customer_id, ...data }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, params.limit || 10);
  },

  async getRepeatVsNew(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void' && t.customer_id);
    
    const customerCounts = new Map<string, number>();
    completed.forEach(t => {
      const cust = t.customer_id!;
      customerCounts.set(cust, (customerCounts.get(cust) || 0) + 1);
    });

    let repeat = 0;
    let newCust = 0;

    Array.from(customerCounts.values()).forEach(count => {
      if (count > 1) repeat++;
      else newCust++;
    });

    return { repeat, newCust, total: repeat + newCust };
  },

  async getCustomerRetentionRate(params: DateRangeParams) {
    const supabase = getSupabase();
    
    // Previous period
    const diff = dayjs(params.to).diff(dayjs(params.from), 'millisecond');
    const prevFrom = dayjs(params.from).subtract(diff, 'millisecond').toISOString();
    const prevTo = params.from;

    const { data: prevTxs } = await supabase
      .from('transactions')
      .select('customer_id')
      .gte('created_at', prevFrom)
      .lte('created_at', prevTo)
      .not('customer_id', 'is', null);

    const prevCustomers = new Set((prevTxs || []).map(t => t.customer_id));
    
    if (prevCustomers.size === 0) return { retentionRate: 0, prevPeriodTotal: 0, returningCount: 0 };

    const txs = await fetchTransactions(params);
    const currentCustomers = new Set(txs.map(t => t.customer_id).filter(Boolean));

    let returning = 0;
    prevCustomers.forEach(c => {
      if (currentCustomers.has(c)) returning++;
    });

    return {
      retentionRate: (returning / prevCustomers.size) * 100,
      prevPeriodTotal: prevCustomers.size,
      returningCount: returning
    };
  },

  // Staff Queries
  async getStaffPerformance(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void' && t.staff_id);
    
    const staffMap = new Map<string, { transactions: number, revenue: number }>();
    completed.forEach(t => {
      const staff = t.staff_id!;
      if (!staffMap.has(staff)) staffMap.set(staff, { transactions: 0, revenue: 0 });
      const current = staffMap.get(staff)!;
      current.transactions += 1;
      current.revenue += toNum(t.amount);
    });

    return Array.from(staffMap.entries())
      .map(([staff_id, data]) => ({ staff_id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  async getCancellationsByStaff(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    
    const staffMap = new Map<string, { total: number, cancelled: number }>();
    txs.forEach(t => {
      if (!t.staff_id) return;
      const staff = t.staff_id;
      if (!staffMap.has(staff)) staffMap.set(staff, { total: 0, cancelled: 0 });
      const current = staffMap.get(staff)!;
      current.total += 1;
      if (t.status === 'cancelled') {
        current.cancelled += 1;
      }
    });

    return Array.from(staffMap.entries())
      .map(([staff_id, data]) => ({
        staff_id,
        total: data.total,
        cancelled: data.cancelled,
        cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0
      }))
      .sort((a, b) => b.cancellationRate - a.cancellationRate);
  },

  // Insight Queries
  async getCrossModulePatterns(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void' && t.customer_id);

    // map: customerId_day -> Set<engine_types>
    const customerDayEngines = new Map<string, Set<string>>();

    completed.forEach(t => {
      const day = dayjs(t.created_at).format('YYYY-MM-DD');
      const key = `${t.customer_id}_${day}`;
      if (!customerDayEngines.has(key)) customerDayEngines.set(key, new Set());
      const set = customerDayEngines.get(key)!;
      if (t.engine_type) set.add(t.engine_type);
    });

    const pairsCount = new Map<string, number>();
    let multiEngineDays = 0;
    let totalDays = customerDayEngines.size;

    customerDayEngines.forEach(engines => {
      const arr = Array.from(engines).sort();
      if (arr.length > 1) {
        multiEngineDays++;
        // count pairs
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const pair = `${arr[i]} & ${arr[j]}`;
            pairsCount.set(pair, (pairsCount.get(pair) || 0) + 1);
          }
        }
      }
    });

    const topPairs = Array.from(pairsCount.entries())
      .map(([pair, count]) => ({ pair, count, percentage: (count / Math.max(1, totalDays)) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      crossModuleDayPercentage: totalDays > 0 ? (multiEngineDays / totalDays) * 100 : 0,
      topPairs
    };
  },

  async getSlowPeriods(params: DateRangeParams) {
    const peakHours = await this.getPeakHours(params);
    const overallAvg = peakHours.reduce((sum, h) => sum + h.averageRevenue, 0) / 24;

    return peakHours
      .filter(h => h.averageRevenue < (overallAvg * 0.5))
      .map(h => ({
        hour: h.hour,
        averageRevenue: h.averageRevenue,
        percentageBelowAverage: overallAvg > 0 ? ((overallAvg - h.averageRevenue) / overallAvg) * 100 : 0
      }));
  },

  async getPromoEffectiveness(params: DateRangeParams) {
    const txs = await fetchTransactions(params);
    const completed = txs.filter(t => t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'void');

    let withPromoVol = 0;
    let withPromoRev = 0;
    let noPromoVol = 0;
    let noPromoRev = 0;

    completed.forEach(t => {
      const amount = toNum(t.amount);
      if (t.promo_code) {
        withPromoVol++;
        withPromoRev += amount;
      } else {
        noPromoVol++;
        noPromoRev += amount;
      }
    });

    const withPromoAvg = withPromoVol > 0 ? withPromoRev / withPromoVol : 0;
    const noPromoAvg = noPromoVol > 0 ? noPromoRev / noPromoVol : 0;

    return {
      withPromo: {
        volume: withPromoVol,
        revenue: withPromoRev,
        averageValue: withPromoAvg
      },
      withoutPromo: {
        volume: noPromoVol,
        revenue: noPromoRev,
        averageValue: noPromoAvg
      },
      valueDifferencePercentage: noPromoAvg > 0 ? ((withPromoAvg - noPromoAvg) / noPromoAvg) * 100 : 0
    };
  }
};
