import { getSupabase } from '../../database/connection.js';
import dayjs from 'dayjs';

export interface DateRangeParams {
  from: string;
  to: string;
  propertyId?: string;
  moduleId?: string;
  engineType?: string;
}

const buildRpcParams = (params: DateRangeParams, extraParams: any = {}) => {
  return {
    p_from: params.from,
    p_to: params.to,
    p_property_id: params.propertyId || null,
    p_module_id: params.moduleId || null,
    p_engine_type: params.engineType || null,
    ...extraParams
  };
};

const toError = (supabaseError: any): Error => {
  const msg = supabaseError?.message || supabaseError?.hint || supabaseError?.code || JSON.stringify(supabaseError);
  console.error('[Economics RPC Error]', JSON.stringify(supabaseError, null, 2));
  const err = new Error(`Supabase RPC error: ${msg}`);
  (err as any).cause = supabaseError;
  return err;
};

export const economicsService = {
  // Revenue Queries
  async getRevenueOverTime(params: DateRangeParams & { interval: 'hour' | 'day' | 'week' | 'month' }) {
    const { data, error } = await getSupabase().rpc('get_economics_revenue_over_time', buildRpcParams(params, { p_interval: params.interval }));
    if (error) throw toError(error);

    const groupedMap = new Map<string, Record<string, number>>();
    (data || []).forEach((row: any) => {
      const timeKey = row.bucket;
      if (!groupedMap.has(timeKey)) groupedMap.set(timeKey, {});
      groupedMap.get(timeKey)![row.engine_type] = Number(row.revenue);
    });

    return Array.from(groupedMap.entries()).map(([time, engines]) => ({
      time,
      ...engines,
    })).sort((a, b) => a.time.localeCompare(b.time));
  },

  async getRevenueByModule(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_revenue_by_module', buildRpcParams(params));
    if (error) throw toError(error);
    
    return (data || []).map((r: any) => {
      const rev = Number(r.revenue);
      const count = Number(r.transaction_count);
      const refundCount = Number(r.refund_count);
      const totalAttempts = count + refundCount;
      return {
        moduleName: r.module_name,
        revenue: rev,
        count: count,
        averageValue: count > 0 ? rev / count : 0,
        refundRate: totalAttempts > 0 ? (refundCount / totalAttempts) * 100 : 0
      };
    });
  },

  async getRevenueByEngineType(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_revenue_by_engine', buildRpcParams(params));
    if (error) throw toError(error);
    
    return (data || []).map((r: any) => ({
      engine_type: r.engine_type,
      revenue: Number(r.revenue)
    }));
  },

  async getGrossVsNet(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_gross_vs_net', buildRpcParams(params));
    if (error) throw toError(error);
    if (!data || data.length === 0) return { gross: 0, net: 0, discounts: 0, refunds: 0 };
    const r = data[0];
    return {
      gross: Number(r.gross),
      net: Number(r.net),
      discounts: Number(r.discounts),
      refunds: Number(r.refunds)
    };
  },

  // Volume Queries
  async getTransactionVolume(params: DateRangeParams & { interval: 'hour' | 'day' | 'week' | 'month' }) {
    const { data, error } = await getSupabase().rpc('get_economics_volume', buildRpcParams(params, { p_interval: params.interval }));
    if (error) throw toError(error);
    return (data || []).map((r: any) => ({ time: r.bucket, count: Number(r.volume_count) }));
  },

  async getAverageTransactionValue(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_avg_value', buildRpcParams(params));
    if (error) throw toError(error);
    
    let totalRevenue = 0;
    let totalCount = 0;
    const byEngine = (data || []).map((r: any) => {
      const rev = Number(r.revenue);
      const c = Number(r.transaction_count);
      totalRevenue += rev;
      totalCount += c;
      return { engine_type: r.engine_type, average: Number(r.average) };
    });

    return {
      overall: totalCount > 0 ? totalRevenue / totalCount : 0,
      byEngine
    };
  },

  async getPeakHours(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_peak_hours', buildRpcParams(params));
    if (error) throw toError(error);

    const days = Math.max(1, dayjs(params.to).diff(dayjs(params.from), 'day'));
    
    const hoursMap = new Map<number, any>();
    for (let i = 0; i < 24; i++) hoursMap.set(i, { hour: i, averageRevenue: 0, transactionCount: 0 });

    (data || []).forEach((r: any) => {
      hoursMap.set(Number(r.hour_of_day), {
        hour: Number(r.hour_of_day),
        averageRevenue: Number(r.revenue) / days,
        transactionCount: Number(r.transaction_count)
      });
    });

    return Array.from(hoursMap.values()).sort((a, b) => a.hour - b.hour);
  },

  // Customer Queries
  async getTopCustomers(params: DateRangeParams & { limit?: number }) {
    const { data, error } = await getSupabase().rpc('get_economics_top_customers', buildRpcParams(params, { p_limit: params.limit || 10 }));
    if (error) throw toError(error);
    return (data || []).map((r: any) => ({
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      spend: Number(r.spend),
      transactions: Number(r.transaction_count)
    }));
  },

  async getRepeatVsNew(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_repeat_vs_new', buildRpcParams(params));
    if (error) throw toError(error);
    
    let repeat = 0;
    let newCust = 0;
    (data || []).forEach((r: any) => {
      if (Number(r.transaction_count) > 1) repeat++;
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

    const { data: prevData, error: prevError } = await supabase.rpc('get_economics_repeat_vs_new', buildRpcParams({
      from: prevFrom, to: prevTo, propertyId: params.propertyId, moduleId: params.moduleId, engineType: params.engineType
    }));
    if (prevError) throw prevError;

    const prevCustomers = new Set((prevData || []).map((t: any) => t.customer_id));
    if (prevCustomers.size === 0) return { retentionRate: 0, prevPeriodTotal: 0, returningCount: 0 };

    const { data: currData, error: currError } = await supabase.rpc('get_economics_repeat_vs_new', buildRpcParams(params));
    if (currError) throw currError;

    let returning = 0;
    (currData || []).forEach((r: any) => {
      if (prevCustomers.has(r.customer_id)) returning++;
    });

    return {
      retentionRate: (returning / prevCustomers.size) * 100,
      prevPeriodTotal: prevCustomers.size,
      returningCount: returning
    };
  },

  // Staff Queries
  async getStaffPerformance(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_staff_performance', buildRpcParams(params));
    if (error) throw toError(error);
    
    return (data || []).map((r: any) => {
      const txs = Number(r.transaction_count);
      const cancels = Number(r.cancellation_count);
      return {
        staff_id: r.staff_id,
        staff_name: r.staff_name,
        transactions: txs,
        revenue: Number(r.revenue),
        cancellationRate: (txs + cancels) > 0 ? (cancels / (txs + cancels)) * 100 : 0
      };
    });
  },

  async getCancellationsByStaff(params: DateRangeParams) {
    // Already included in getStaffPerformance
    return this.getStaffPerformance(params);
  },

  // Insight Queries
  async getCrossModulePatterns(params: DateRangeParams) {
    const { data, error } = await getSupabase().rpc('get_economics_cross_module', {
      p_from: params.from,
      p_to: params.to,
      p_property_id: params.propertyId || null
    });
    if (error) throw toError(error);

    const customerDayEngines = new Map<string, Set<string>>();
    (data || []).forEach((r: any) => {
      const key = `${r.customer_id}_${r.day_date}`;
      if (!customerDayEngines.has(key)) customerDayEngines.set(key, new Set());
      customerDayEngines.get(key)!.add(r.engine_type);
    });

    const pairsCount = new Map<string, number>();
    let multiEngineDays = 0;
    let totalDays = customerDayEngines.size;

    customerDayEngines.forEach(engines => {
      const arr = Array.from(engines).sort();
      if (arr.length > 1) {
        multiEngineDays++;
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
    const { data, error } = await getSupabase().rpc('get_economics_promo_effectiveness', buildRpcParams(params));
    if (error) throw toError(error);

    let withPromoVol = 0;
    let withPromoRev = 0;
    let noPromoVol = 0;
    let noPromoRev = 0;

    (data || []).forEach((r: any) => {
      if (r.has_promo) {
        withPromoVol = Number(r.transaction_count);
        withPromoRev = Number(r.revenue);
      } else {
        noPromoVol = Number(r.transaction_count);
        noPromoRev = Number(r.revenue);
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
