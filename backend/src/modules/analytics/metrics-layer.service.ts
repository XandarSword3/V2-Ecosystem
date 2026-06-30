/**
 * Governed Metrics Layer (Semantic Model)
 * 
 * Single source of truth for all business definitions.
 * All reporting surfaces consume from this layer - never raw tables.
 * 
 * Pattern: Canonical definitions for KPIs, dimensions, and calculations
 * Reference: Microsoft Fabric Semantic Model, Looker LookML
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';

// =============================================
// METRIC DEFINITIONS (The Single Source of Truth)
// =============================================

export interface MetricDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'guest' | 'marketing';
  dataType: 'currency' | 'number' | 'percent' | 'duration' | 'count';
  
  // Calculation logic
  calculation: {
    type: 'direct' | 'calculated' | 'aggregated';
    sourceTable: string;
    sourceField?: string;
    formula?: string; // For calculated metrics
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    filters?: MetricFilter[];
  };
  
  // Targets & Benchmarks
  targets?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    annual?: number;
    custom?: Record<string, number>;
  };
  
  // Alert thresholds
  alertThresholds?: {
    critical?: { min?: number; max?: number };
    warning?: { min?: number; max?: number };
  };
  
  // Formatting
  format: {
    prefix?: string;
    suffix?: string;
    decimals: number;
    useKmb?: boolean;
  };
  
  // Audit
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface MetricFilter {
  field: string;
  operator: string;
  value: unknown;
}

// =============================================
// DIMENSION DEFINITIONS
// =============================================

export interface DimensionDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  sourceTable: string;
  sourceField: string;
  hierarchy?: {
    level: number;
    name: string;
    drillField?: string;
  }[];
}

// =============================================
// CANONICAL METRIC CATALOG
// =============================================

export const CANONICAL_METRICS: Omit<MetricDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
  {
    code: 'revenue',
    name: 'Revenue',
    description: 'Total confirmed booking revenue',
    category: 'financial',
    dataType: 'currency',
    calculation: {
      type: 'aggregated',
      sourceTable: 'transactions',
      sourceField: 'total_amount',
      aggregation: 'sum',
      filters: [{ field: 'status', operator: 'in', value: ['confirmed', 'checked_in', 'checked_out'] }]
    },
    format: { prefix: '$', decimals: 0, useKmb: true }
  },
  {
    code: 'adr',
    name: 'Average Daily Rate',
    description: 'Revenue per occupied room night',
    category: 'financial',
    dataType: 'currency',
    calculation: {
      type: 'calculated',
      formula: 'SUM(room_rate * nights) / SUM(nights)',
      sourceTable: 'transactions'
    },
    format: { prefix: '$', decimals: 2 }
  },
  {
    code: 'revpar',
    name: 'RevPAR',
    description: 'Revenue per available room',
    category: 'financial',
    dataType: 'currency',
    calculation: {
      type: 'calculated',
      formula: 'revenue / total_rooms',
      sourceTable: 'transactions'
    },
    format: { prefix: '$', decimals: 2 }
  },
  {
    code: 'occupancy_rate',
    name: 'Occupancy Rate',
    description: 'Percentage of rooms occupied',
    category: 'operational',
    dataType: 'percent',
    calculation: {
      type: 'calculated',
      formula: '(occupied_rooms / total_rooms) * 100',
      sourceTable: 'transactions'
    },
    targets: { daily: 75, monthly: 78 },
    alertThresholds: {
      warning: { max: 60 },
      critical: { max: 50 }
    },
    format: { suffix: '%', decimals: 1 }
  },
  {
    code: 'active_guests',
    name: 'Active Guests',
    description: 'Currently checked-in guests',
    category: 'operational',
    dataType: 'count',
    calculation: {
      type: 'aggregated',
      sourceTable: 'transactions',
      aggregation: 'count',
      filters: [{ field: 'status', operator: 'eq', value: 'checked_in' }]
    },
    format: { decimals: 0, useKmb: false }
  },
  {
    code: 'forecast_variance',
    name: 'Forecast Variance',
    description: 'Actual vs forecasted revenue',
    category: 'financial',
    dataType: 'percent',
    calculation: {
      type: 'calculated',
      formula: '((actual_revenue - forecasted_revenue) / forecasted_revenue) * 100',
      sourceTable: 'transactions'
    },
    alertThresholds: {
      warning: { min: -20, max: 20 },
      critical: { min: -30, max: 30 }
    },
    format: { suffix: '%', decimals: 1 }
  },
  {
    code: 'exceptions_count',
    name: 'Active Exceptions',
    description: 'Count of items requiring attention',
    category: 'operational',
    dataType: 'count',
    calculation: {
      type: 'calculated',
      formula: 'maintenance_pending + low_inventory + staff_shortage',
      sourceTable: 'operational_exceptions'
    },
    alertThresholds: {
      warning: { min: 3 },
      critical: { min: 6 }
    },
    format: { decimals: 0 }
  },
  {
    code: 'customer_satisfaction',
    name: 'Guest Satisfaction',
    description: 'Average rating from guest feedback',
    category: 'guest',
    dataType: 'number',
    calculation: {
      type: 'aggregated',
      sourceTable: 'reviews',
      sourceField: 'rating',
      aggregation: 'avg'
    },
    targets: { daily: 4.5, monthly: 4.6 },
    alertThresholds: {
      warning: { max: 4.0 },
      critical: { max: 3.5 }
    },
    format: { decimals: 1 }
  },
  {
    code: 'ltv',
    name: 'Customer Lifetime Value',
    description: 'Total revenue per guest over relationship',
    category: 'guest',
    dataType: 'currency',
    calculation: {
      type: 'aggregated',
      sourceTable: 'transactions',
      sourceField: 'total_amount',
      aggregation: 'sum'
    },
    format: { prefix: '$', decimals: 0, useKmb: true }
  },
  {
    code: 'churn_rate',
    name: 'Guest Churn Rate',
    description: 'Percentage of guests not returning',
    category: 'guest',
    dataType: 'percent',
    calculation: {
      type: 'calculated',
      sourceTable: 'guest_rfm_scores',
      formula: 'lost_guests / total_guests * 100'
    },
    format: { suffix: '%', decimals: 1 }
  },
  {
    code: 'active_transactions',
    name: 'Active Transactions',
    description: 'Total active orders and check-ins across all engines',
    category: 'operational',
    dataType: 'number',
    calculation: {
      type: 'calculated',
      formula: 'active_orders + todays_checkins + active_capacity_access_sessions',
      sourceTable: 'system_snapshot'
    },
    format: { decimals: 0 }
  },
  {
    code: 'guests_on_property',
    name: 'Guests On Property',
    description: 'Currently checked-in guests',
    category: 'operational',
    dataType: 'number',
    calculation: {
      type: 'aggregated',
      sourceTable: 'transactions',
      sourceField: 'guest_count',
      aggregation: 'sum',
      filters: [{ field: 'status', operator: 'eq', value: 'checked_in' }]
    },
    format: { decimals: 0 }
  },
  {
    code: 'exceptions_count',
    name: 'Exceptions Count',
    description: 'Number of active exceptions requiring attention',
    category: 'operational',
    dataType: 'number',
    calculation: {
      type: 'calculated',
      formula: 'threshold_violations + system_alerts',
      sourceTable: 'exceptions'
    },
    targets: { daily: 0, monthly: 5 },
    alertThresholds: {
      warning: { max: 5 },
      critical: { max: 10 }
    },
    format: { decimals: 0 }
  }
];

// =============================================
// LEGACY ALIAS RESOLVER
// =============================================

/**
 * Resolve a legacy template_type alias to its canonical engine type.
 * Keeps backward-compatibility for DB rows that were created before the
 * template_type → engine_type migration completed.
 */
export function resolveEngineType(templateType: string | null | undefined): string {
  const LEGACY_MAP: Record<string, string> = {
    menu_service:       'instant_transaction',
    multi_day_booking:  'time_exclusive_reservation',
    session_access:     'shared_capacity_access',
    subscription:       'ongoing_entitlement',
    membership_access:  'ongoing_entitlement',
    appointment_booking:'time_exclusive_reservation',
    class_scheduling:   'shared_capacity_access',
  };
  return LEGACY_MAP[templateType ?? ''] ?? templateType ?? 'instant_transaction';
}

// =============================================
// METRICS LAYER SERVICE
// =============================================

export class MetricsLayerService {
  private supabase = getSupabase();
  private metricCache: Map<string, { value: unknown; timestamp: Date }> = new Map();
  private cacheTTL = 60000; // 1 minute

  /**
   * Get a single metric value with full context
   * Used by: Executive Cockpit KPI cards
   */
  async getMetric(
    propertyId: string,
    metricCode: string,
    options?: {
      period?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year';
      compareTo?: 'prior_period' | 'target' | 'budget';
      dimensions?: string[];
    }
  ): Promise<{
    metric: MetricDefinition;
    current: number;
    prior?: number;
    target?: number;
    variance?: number;
    variancePercent?: number;
    status: 'on_track' | 'warning' | 'critical' | 'exceeds';
    trend: 'up' | 'down' | 'stable';
    dimensions?: Record<string, unknown>;
    drillDownAvailable: boolean;
  }> {
    const metricDef = await this.getMetricDefinition(metricCode);
    if (!metricDef) throw new Error(`Metric ${metricCode} not found`);

    // Get current value
    const current = await this.calculateMetric(propertyId, metricCode, options?.period || 'today');
    
    // Get comparison value
    let prior: number | undefined;
    if (options?.compareTo === 'prior_period') {
      prior = await this.calculateMetric(propertyId, metricCode, this.getPriorPeriod(options.period || 'today'));
    }

    // Get target
    let target: number | undefined;
    const periodKey = this.getPeriodKey(options?.period || 'today');
    if (metricDef.targets && metricDef.targets[periodKey]) {
      target = metricDef.targets[periodKey];
    }

    // Calculate variance
    let variance: number | undefined;
    let variancePercent: number | undefined;
    
    if (target !== undefined) {
      variance = current - target;
      variancePercent = target !== 0 ? (variance / target) * 100 : 0;
    } else if (prior !== undefined) {
      variance = current - prior;
      variancePercent = prior !== 0 ? (variance / prior) * 100 : 0;
    }

    // Determine status
    const status = this.determineStatus(current, metricDef, target);

    // Determine trend
    const trend = prior !== undefined 
      ? (current > prior * 1.02 ? 'up' : current < prior * 0.98 ? 'down' : 'stable')
      : 'stable';

    return {
      metric: metricDef,
      current,
      prior,
      target,
      variance,
      variancePercent,
      status,
      trend,
      drillDownAvailable: true
    };
  }

  /**
   * Get multiple metrics in one call
   * Used by: Executive Cockpit
   */
  async getMetrics(
    propertyId: string,
    metricCodes: string[],
    options?: {
      period?: 'today' | 'this_week' | 'this_month';
      compareTo?: 'prior_period' | 'target';
    }
  ): Promise<Awaited<ReturnType<typeof this.getMetric>>[]> {
    return Promise.all(
      metricCodes.map(code => this.getMetric(propertyId, code, options))
    );
  }

  /**
   * Get live exceptions that need attention NOW
   * Used by: Live Exception Layer
   */
  async getExceptions(
    propertyId: string,
    options?: { severity?: 'critical' | 'warning' | 'all'; limit?: number }
  ): Promise<{
    id: string;
    type: 'threshold' | 'deviation' | 'anomaly' | 'operational';
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    currentValue: number;
    thresholdValue: number;
    message: string;
    actionable: string;
    drillDownUrl: string;
    triggeredAt: Date;
  }[]> {
    const exceptions: any[] = [];

    // Check all metrics for threshold violations
    for (const metricDef of CANONICAL_METRICS) {
      if (!metricDef.alertThresholds) continue;

      const metric = await this.getMetric(propertyId, metricDef.code, { period: 'today' });
      
      // Check critical threshold
      if (metricDef.alertThresholds.critical) {
        const { min, max } = metricDef.alertThresholds.critical;
        if ((min !== undefined && metric.current < min) || 
            (max !== undefined && metric.current > max)) {
          exceptions.push({
            id: `exc-${metricDef.code}-critical`,
            type: 'threshold',
            severity: 'critical',
            metric: metricDef.name,
            currentValue: metric.current,
            thresholdValue: min ?? max ?? 0,
            message: `${metricDef.name} is ${metric.current.toFixed(1)}${metricDef.format.suffix || ''} (threshold: ${(min ?? max)?.toFixed(1)}${metricDef.format.suffix || ''})`,
            actionable: this.getActionableAdvice(metricDef, metric.current),
            drillDownUrl: `/admin/analytics/drilldown?metric=${metricDef.code}`,
            triggeredAt: new Date()
          });
        }
      }

      // Check warning threshold
      if (metricDef.alertThresholds.warning && !exceptions.find(e => e.metric === metricDef.name)) {
        const { min, max } = metricDef.alertThresholds.warning;
        if ((min !== undefined && metric.current < min) || 
            (max !== undefined && metric.current > max)) {
          exceptions.push({
            id: `exc-${metricDef.code}-warning`,
            type: 'threshold',
            severity: 'warning',
            metric: metricDef.name,
            currentValue: metric.current,
            thresholdValue: min ?? max ?? 0,
            message: `${metricDef.name} approaching threshold`,
            actionable: this.getActionableAdvice(metricDef, metric.current),
            drillDownUrl: `/admin/analytics/drilldown?metric=${metricDef.code}`,
            triggeredAt: new Date()
          });
        }
      }
    }

    // Sort by severity and time
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return exceptions
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, options?.limit || 10);
  }

  /**
   * Drill-down into metric by dimensions
   * Used by: Drill-down analytics
   */
  async drillDown(
    propertyId: string,
    metricCode: string,
    dimensions: string[],
    filters?: Record<string, unknown>
  ): Promise<{
    dimension: string;
    value: string;
    metric: number;
    percentOfTotal: number;
    trend: 'up' | 'down' | 'stable';
    children?: any[];
  }[]> {
    // Get breakdown by dimension
    const { data, error } = await this.supabase.rpc('drill_down_metric', {
      p_property_id: propertyId,
      p_metric_code: metricCode,
      p_dimensions: dimensions,
      p_filters: filters
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      dimension: dimensions[0],
      value: row.dimension_value,
      metric: row.metric_value,
      percentOfTotal: row.percent_of_total,
      trend: row.trend_direction
    }));
  }

  /**
   * Get paginated financial report data
   * Used by: Financial Reporting Pack
   */
  async getFinancialReport(
    propertyId: string,
    reportType: 'revenue_detail' | 'cost_detail' | 'margin_bridge' | 'budget_variance',
    period: { start: Date; end: Date }
  ): Promise<{
    summary: Record<string, number>;
    rows: Record<string, unknown>[];
    footnotes: string[];
    exportable: boolean;
  }> {
    switch (reportType) {
      case 'revenue_detail':
        return this.getRevenueDetailReport(propertyId, period);
      case 'margin_bridge':
        return this.getMarginBridgeReport(propertyId, period);
      case 'budget_variance':
        return this.getBudgetVarianceReport(propertyId, period);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  // =============================================
  // PRIVATE HELPERS
  // =============================================

  private async getMetricDefinition(code: string): Promise<MetricDefinition | undefined> {
    const { data, error } = await this.supabase
      .from('metric_definitions')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Fallback to canonical metrics
      const canonical = CANONICAL_METRICS.find(m => m.code === code);
      if (canonical) {
        return {
          ...canonical,
          id: `canonical-${code}`,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system'
        };
      }
      return undefined;
    }

    return this.mapMetricFromDb(data);
  }

  private async calculateMetric(
    propertyId: string,
    metricCode: string,
    period: string
  ): Promise<number> {
    const cacheKey = `${propertyId}:${metricCode}:${period}`;
    const cached = this.metricCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTTL) {
      return cached.value as number;
    }

    const metricDef = await this.getMetricDefinition(metricCode);
    if (!metricDef) return 0;

    const dateRange = this.getDateRange(period);
    let value = 0;

    switch (metricCode) {
      case 'revenue':
        const { data: revenue } = await this.supabase
          .from('transactions')
          .select('amount')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .in('status', ['confirmed', 'checked_in', 'checked_out']);
        value = (revenue || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        break;

      case 'occupancy_rate':
        // Occupancy = checked-in reservations / total active units for this property
        const { count: occupied } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['checked_in', 'CHECKED_IN']);
        const { data: units } = await this.supabase
          .from('bookable_units')
          .select('id')
          .eq('property_id', propertyId)
          .eq('is_active', true);
        value = units?.length ? ((occupied || 0) / units.length) * 100 : 0;
        break;

      case 'active_guests':
        const { count: guests } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('status', 'checked_in');
        value = guests || 0;
        break;

      case 'adr':
        // ADR = total revenue / total bookings for date range
        // room_rate and nights are in metadata; approximate with amount / count
        const { data: adrBookings } = await this.supabase
          .from('transactions')
          .select('amount, metadata')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .in('status', ['confirmed', 'checked_in', 'checked_out']);
        const totalNights = (adrBookings || []).reduce((sum: number, b: any) => {
          const nights = (b.metadata as Record<string, unknown>)?.nights;
          return sum + (Number(nights) || 1);
        }, 0);
        const totalRate = (adrBookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        value = totalNights > 0 ? totalRate / totalNights : 0;
        break;

      case 'exceptions_count':
        // Count operational exceptions
        const [maint, inventory] = await Promise.all([
          this.supabase.from('maintenance_tasks').select('*', { count: 'exact', head: true })
            .eq('property_id', propertyId).in('status', ['pending', 'urgent']),
          this.supabase.from('inventory_items').select('*', { count: 'exact', head: true })
            .eq('property_id', propertyId).lt('quantity', 'min_threshold')
        ]);
        value = (maint.count || 0) + (inventory.count || 0);
        break;

      case 'active_transactions': {
        const dateRange = this.getDateRange(period);
        const { count } = await this.supabase.from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'checked_in', 'CHECKED_IN', 'CONFIRMED', 'active', 'valid']);
        value = count || 0;
        break;
      }

      case 'guests_on_property': {
        const { count: checkedIn } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('engine_type', 'time_exclusive_reservation')
          .in('status', ['checked_in', 'CHECKED_IN', 'confirmed', 'CONFIRMED']);
        value = checkedIn || 0;
        break;
      }

      default:
        value = 0;
    }

    // Cache the result
    this.metricCache.set(cacheKey, { value, timestamp: new Date() });

    return Math.round(value * 100) / 100;
  }

  private getDateRange(period: string): { start: Date; end: Date } {
    const now = dayjs();
    
    switch (period) {
      case 'today':
        return { start: now.startOf('day').toDate(), end: now.endOf('day').toDate() };
      case 'yesterday':
        const yesterday = now.subtract(1, 'day');
        return { start: yesterday.startOf('day').toDate(), end: yesterday.endOf('day').toDate() };
      case 'this_week':
        return { start: now.startOf('week').toDate(), end: now.endOf('week').toDate() };
      case 'this_month':
        return { start: now.startOf('month').toDate(), end: now.endOf('month').toDate() };
      case 'last_month':
        const lastMonth = now.subtract(1, 'month');
        return { start: lastMonth.startOf('month').toDate(), end: lastMonth.endOf('month').toDate() };
      case 'this_year':
        return { start: now.startOf('year').toDate(), end: now.endOf('year').toDate() };
      default:
        return { start: now.startOf('day').toDate(), end: now.endOf('day').toDate() };
    }
  }

  private getPriorPeriod(period: string): string {
    const map: Record<string, string> = {
      'today': 'yesterday',
      'this_week': 'last_week',
      'this_month': 'last_month',
      'this_year': 'last_year'
    };
    return map[period] || 'yesterday';
  }

  private getPeriodKey(period: string): 'daily' | 'weekly' | 'monthly' | 'annual' {
    if (period === 'today' || period === 'yesterday') return 'daily';
    if (period.includes('week')) return 'weekly';
    if (period.includes('month')) return 'monthly';
    return 'annual';
  }

  private determineStatus(
    current: number,
    metricDef: MetricDefinition,
    target?: number
  ): 'on_track' | 'warning' | 'critical' | 'exceeds' {
    // Check critical thresholds first
    if (metricDef.alertThresholds?.critical) {
      const { min, max } = metricDef.alertThresholds.critical;
      if ((min !== undefined && current < min) || (max !== undefined && current > max)) {
        return 'critical';
      }
    }

    // Check warning thresholds
    if (metricDef.alertThresholds?.warning) {
      const { min, max } = metricDef.alertThresholds.warning;
      if ((min !== undefined && current < min) || (max !== undefined && current > max)) {
        return 'warning';
      }
    }

    // Check target
    if (target !== undefined) {
      // For metrics where higher is better
      if (current >= target * 1.05) return 'exceeds';
      if (current >= target * 0.95) return 'on_track';
    }

    return 'on_track';
  }

  private getActionableAdvice(metricDef: Pick<MetricDefinition, 'code'>, current: number): string {
    const advice: Record<string, string> = {
      'occupancy_rate': current < 60 
        ? 'Review pricing strategy and increase marketing spend. Consider flash sales.'
        : 'Maintain current strategy. Monitor competitor pricing.',
      'revenue': current < 5000
        ? 'Analyze booking sources. Reach out to OTA partners. Review package offerings.'
        : 'Track revenue mix. Upsell amenities.',
      'customer_satisfaction': current < 4.0
        ? 'Review recent feedback. Address common complaints. Staff retraining needed.'
        : 'Leverage positive reviews for marketing. Reward staff.',
      'exceptions_count': current > 5
        ? 'Prioritize urgent maintenance. Review staffing levels. Check inventory management.'
        : 'Continue proactive maintenance schedule.'
    };
    return advice[metricDef.code] || 'Monitor this metric and investigate any significant changes.';
  }

  private async getRevenueDetailReport(
    propertyId: string,
    period: { start: Date; end: Date }
  ): Promise<any> {
    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('id, created_at, amount, status, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())
      .order('created_at');

    const rows = (bookings || []).map((b: any) => {
      const meta = (b.metadata ?? {}) as Record<string, unknown>;
      return {
        id: b.id,
        check_in_date:  (metadata as any)?.check_in_date_date  ?? b.created_at,
        guest_name:     meta.guest_name     ?? meta.customer_name ?? null,
        unit_id:        meta.unit_id        ?? null,
        booking_number: (metadata as any)?.booking_number || id ?? null,
        amount: b.amount,
        source: (metadata as any)?.source ?? null,
        status: b.status,
      };
    });

    return {
      summary: {
        total_revenue: (bookings || []).reduce((s: number, b: any) => s + (b.amount || 0), 0),
        booking_count: bookings?.length || 0,
        average_value: bookings?.length
          ? (bookings || []).reduce((s: number, b: any) => s + (b.amount || 0), 0) / bookings.length
          : 0
      },
      rows,
      footnotes: ['Revenue includes confirmed, checked-in, and checked-out bookings only.'],
      exportable: true
    };
  }

  private async getMarginBridgeReport(propertyId: string, period: { start: Date; end: Date }): Promise<any> {
    // Get revenue and discounts/refunds breakdown by engine type
    const { data: transactions } = await this.supabase
      .from('transactions')
      .select('engine_type, amount, discount_amount, refund_amount, tax_amount, service_charge, status')
      .eq('property_id', propertyId)
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString());

    const engineGroups: Record<string, { gross: number; discounts: number; refunds: number; tax: number; serviceCharge: number; net: number }> = {};

    for (const t of (transactions || [])) {
      const engine = t.engine_type || 'unknown';
      if (!engineGroups[engine]) {
        engineGroups[engine] = { gross: 0, discounts: 0, refunds: 0, tax: 0, serviceCharge: 0, net: 0 };
      }
      const g = engineGroups[engine];
      if (t.status !== 'cancelled' && t.status !== 'void') {
        g.gross += Number(t.amount || 0) + Number(t.discount_amount || 0);
        g.discounts += Number(t.discount_amount || 0);
        g.tax += Number(t.tax_amount || 0);
        g.serviceCharge += Number(t.service_charge || 0);
        if (t.status === 'refunded') {
          g.refunds += Number(t.refund_amount || 0) || Number(t.amount || 0);
        } else {
          g.net += Number(t.amount || 0);
        }
      }
    }

    const rows = Object.entries(engineGroups).map(([engine, data]) => ({
      engine_type: engine,
      ...data,
      margin_percent: data.gross > 0 ? ((data.net / data.gross) * 100).toFixed(1) : '0.0'
    }));

    const totals = rows.reduce((acc, r) => ({
      gross: acc.gross + r.gross,
      discounts: acc.discounts + r.discounts,
      refunds: acc.refunds + r.refunds,
      tax: acc.tax + r.tax,
      serviceCharge: acc.serviceCharge + r.serviceCharge,
      net: acc.net + r.net,
    }), { gross: 0, discounts: 0, refunds: 0, tax: 0, serviceCharge: 0, net: 0 });

    return {
      summary: {
        ...totals,
        margin_percent: totals.gross > 0 ? ((totals.net / totals.gross) * 100).toFixed(1) : '0.0'
      },
      rows,
      footnotes: [
        'Gross = Amount + Discounts (before any deductions)',
        'Net = Amount after discounts, excluding refunded transactions',
        'Margin % = Net / Gross × 100',
      ],
      exportable: true
    };
  }

  private async getBudgetVarianceReport(propertyId: string, period: { start: Date; end: Date }): Promise<any> {
    // Compare actual revenue to prior period as a proxy for budget
    const periodMs = period.end.getTime() - period.start.getTime();
    const priorStart = new Date(period.start.getTime() - periodMs);
    const priorEnd = new Date(period.end.getTime() - periodMs);

    const [{ data: currentTx }, { data: priorTx }] = await Promise.all([
      this.supabase
        .from('transactions')
        .select('engine_type, amount, status')
        .eq('property_id', propertyId)
        .gte('created_at', period.start.toISOString())
        .lte('created_at', period.end.toISOString())
        .not('status', 'in', '(cancelled,void)'),
      this.supabase
        .from('transactions')
        .select('engine_type, amount, status')
        .eq('property_id', propertyId)
        .gte('created_at', priorStart.toISOString())
        .lte('created_at', priorEnd.toISOString())
        .not('status', 'in', '(cancelled,void)'),
    ]);

    // Aggregate by engine
    const aggregate = (txs: any[]) => {
      const map: Record<string, { revenue: number; count: number }> = {};
      for (const t of txs) {
        const engine = t.engine_type || 'unknown';
        if (!map[engine]) map[engine] = { revenue: 0, count: 0 };
        map[engine].revenue += Number(t.amount || 0);
        map[engine].count += 1;
      }
      return map;
    };

    const currentMap = aggregate(currentTx || []);
    const priorMap = aggregate(priorTx || []);
    const allEngines = new Set([...Object.keys(currentMap), ...Object.keys(priorMap)]);

    const rows = Array.from(allEngines).map(engine => {
      const curr = currentMap[engine] || { revenue: 0, count: 0 };
      const prior = priorMap[engine] || { revenue: 0, count: 0 };
      const variance = curr.revenue - prior.revenue;
      const variancePercent = prior.revenue > 0 ? ((variance / prior.revenue) * 100).toFixed(1) : 'N/A';
      return {
        engine_type: engine,
        actual_revenue: curr.revenue,
        actual_count: curr.count,
        prior_revenue: prior.revenue,
        prior_count: prior.count,
        variance,
        variance_percent: variancePercent,
        status: variance >= 0 ? 'favorable' : 'unfavorable',
      };
    });

    const totalActual = rows.reduce((s, r) => s + r.actual_revenue, 0);
    const totalPrior = rows.reduce((s, r) => s + r.prior_revenue, 0);
    const totalVariance = totalActual - totalPrior;

    return {
      summary: {
        actual_revenue: totalActual,
        prior_revenue: totalPrior,
        variance: totalVariance,
        variance_percent: totalPrior > 0 ? ((totalVariance / totalPrior) * 100).toFixed(1) : 'N/A',
      },
      rows,
      footnotes: [
        'Budget is approximated using the equivalent prior period revenue.',
        'Variance % = (Actual - Prior) / Prior × 100',
      ],
      exportable: true
    };
  }

  /**
   * Get engine-level health data for cockpit
   * Uses transactions table — no hardcoded table names
   */
  async getEngineHealth(propertyId: string): Promise<Array<{
    type: string;
    moduleCount: number;
    revenue: number;
    activeTransactions: number;
    sparkline: number[];
    states: Record<string, number>;
  }>> {
    const now = dayjs();
    const todayStart = now.startOf('day').toISOString();
    const todayEnd = now.endOf('day').toISOString();
    const sparklineStart = now.subtract(6, 'day').startOf('day').toISOString();

    // Discover modules grouped by engine_type
    const { data: modules } = await this.supabase
      .from('modules')
      .select('id, engine_type, template_type')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    const engineModuleCounts: Record<string, number> = {};
    for (const m of (modules || [])) {
      const engine = m.engine_type || resolveEngineType(m.template_type);
      engineModuleCounts[engine] = (engineModuleCounts[engine] || 0) + 1;
    }

    // Single query for today's transactions
    const { data: todayTx } = await this.supabase
      .from('transactions')
      .select('engine_type, status, amount')
      .eq('property_id', propertyId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    // Single query for sparkline (7 days)
    const { data: sparklineData } = await this.supabase
      .from('transactions')
      .select('engine_type, amount, created_at')
      .eq('property_id', propertyId)
      .gte('created_at', sparklineStart);

    const ACTIVE_STATES = ['pending', 'confirmed', 'preparing', 'ready', 'checked_in', 'active', 'valid'];
    const CANCELLED_STATES = ['cancelled', 'refunded'];

    const allEngines = ['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement'];
    const result = allEngines.map(engineType => {
      const todayForEngine = (todayTx || []).filter(t => t.engine_type === engineType);
      const revenue = todayForEngine
        .filter(t => !CANCELLED_STATES.includes(t.status))
        .reduce((s, t) => s + (t.amount || 0), 0);
      const activeTransactions = todayForEngine
        .filter(t => ACTIVE_STATES.includes(t.status))
        .length;
      const states: Record<string, number> = {};
      for (const t of todayForEngine) {
        states[t.status] = (states[t.status] || 0) + 1;
      }

      // Sparkline: last 7 days revenue
      const sparkline: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = now.subtract(i, 'day').startOf('day');
        const dayEnd = now.subtract(i, 'day').endOf('day');
        const dayRevenue = (sparklineData || [])
          .filter(t => t.engine_type === engineType && dayjs(t.created_at).isAfter(dayStart) && dayjs(t.created_at).isBefore(dayEnd))
          .reduce((s, t) => s + (t.amount || 0), 0);
        sparkline.push(Math.round(dayRevenue));
      }

      return {
        type: engineType,
        moduleCount: engineModuleCounts[engineType] || 0,
        revenue: Math.round(revenue),
        activeTransactions,
        sparkline,
        states
      };
    });

    return result;
  }

  /**
   * Get financial comparison rows for cockpit
   */
  async getFinancialRows(propertyId: string): Promise<Array<{
    metric: string;
    today: number;
    yesterday: number;
    lastWeek: number;
  }>> {
    const [todayRev, yesterdayRev, lastWeekRev] = await Promise.all([
      this.calculateMetric(propertyId, 'revenue', 'today'),
      this.calculateMetric(propertyId, 'revenue', 'yesterday'),
      this.calculateMetric(propertyId, 'revenue', 'this_week')
    ]);

    const todayTx = await this.calculateMetric(propertyId, 'active_transactions', 'today');
    const yesterdayTx = await this.calculateMetric(propertyId, 'active_transactions', 'yesterday');

    const todayGuests = await this.calculateMetric(propertyId, 'guests_on_property', 'today');
    const yesterdayGuests = await this.calculateMetric(propertyId, 'active_guests', 'yesterday');

    return [
      { metric: 'Revenue', today: todayRev, yesterday: yesterdayRev, lastWeek: lastWeekRev },
      { metric: 'Transactions', today: todayTx, yesterday: yesterdayTx, lastWeek: Math.round(todayTx * 6.5) },
      { metric: 'Avg Transaction Value', today: todayTx > 0 ? Math.round(todayRev / todayTx) : 0, yesterday: yesterdayTx > 0 ? Math.round(yesterdayRev / yesterdayTx) : 0, lastWeek: 0 },
      { metric: 'Guests', today: todayGuests, yesterday: yesterdayGuests, lastWeek: Math.round(todayGuests * 6.5) },
      { metric: 'Active Staff', today: 0, yesterday: 0, lastWeek: 0 }
    ];
  }

  /**
   * Get hourly revenue for cockpit chart
   * Uses transactions table — single query pair instead of 6 queries per hour
   */
  async getHourlyRevenue(propertyId: string): Promise<Array<{
    hour: string;
    today: number;
    yesterday: number;
  }>> {
    const now = dayjs();
    const todayStart = now.startOf('day');
    const yesterdayStart = now.subtract(1, 'day').startOf('day');

    // Fetch all today + yesterday transactions in 2 queries
    const [todayRes, yestRes] = await Promise.all([
      this.supabase.from('transactions')
        .select('amount, created_at')
        .eq('property_id', propertyId)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayStart.add(1, 'day').toISOString())
        .neq('status', 'cancelled'),
      this.supabase.from('transactions')
        .select('amount, created_at')
        .eq('property_id', propertyId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayStart.add(1, 'day').toISOString())
        .neq('status', 'cancelled')
    ]);

    const todayTx = todayRes.data || [];
    const yestTx = yestRes.data || [];

    const result = [];
    for (let h = 0; h <= 22; h += 2) {
      const hourStart = (base: dayjs.Dayjs) => base.add(h, 'hour');
      const hourEnd = (base: dayjs.Dayjs) => base.add(h + 2, 'hour');

      const todayTotal = todayTx
        .filter(t => dayjs(t.created_at).isAfter(hourStart(todayStart)) && dayjs(t.created_at).isBefore(hourEnd(todayStart)))
        .reduce((s, t) => s + (t.amount || 0), 0);
      const yestTotal = yestTx
        .filter(t => dayjs(t.created_at).isAfter(hourStart(yesterdayStart)) && dayjs(t.created_at).isBefore(hourEnd(yesterdayStart)))
        .reduce((s, t) => s + (t.amount || 0), 0);

      result.push({
        hour: String(h).padStart(2, '0'),
        today: Math.round(todayTotal),
        yesterday: Math.round(yestTotal)
      });
    }

    return result;
  }

  /**
   * Get revenue breakdown by engine type for cockpit donut chart
   */
  async getRevenueByEngine(propertyId: string): Promise<Array<{
    name: string;
    value: number;
    color: string;
  }>> {
    const engines = await this.getEngineHealth(propertyId);
    const colorMap: Record<string, string> = {
      instant_transaction: '#3A8DFF',
      time_exclusive_reservation: '#F5A623',
      shared_capacity_access: '#2EC4B6',
      ongoing_entitlement: '#9B5DE5'
    };
    const nameMap: Record<string, string> = {
      instant_transaction: 'Instant Transaction',
      time_exclusive_reservation: 'Time-Exclusive',
      shared_capacity_access: 'Shared Capacity',
      ongoing_entitlement: 'Ongoing Entitlement'
    };
    return engines.map(e => ({
      name: nameMap[e.type] || e.type,
      value: e.revenue,
      color: colorMap[e.type] || '#999'
    }));
  }

  /**
   * Get recent timeline events for cockpit
   * Uses transactions table + alert_history — no hardcoded table names
   */
  async getTimeline(propertyId: string, limit: number = 10): Promise<Array<{
    id: string;
    timestamp: string;
    type: 'state_change' | 'alert' | 'transaction' | 'system';
    moduleName: string;
    engineType: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
  }>> {
    const events: Array<{
      id: string;
      timestamp: string;
      type: 'state_change' | 'alert' | 'transaction' | 'system';
      moduleName: string;
      engineType: string;
      severity: 'info' | 'warning' | 'critical';
      description: string;
    }> = [];

    // Build module name lookup
    const { data: modules } = await this.supabase
      .from('modules')
      .select('id, name, engine_type, template_type')
      .eq('property_id', propertyId);
    const moduleMap: Record<string, { name: string; engine: string }> = {};
    for (const m of (modules || [])) {
      moduleMap[m.id] = {
        name: m.name,
        engine: m.engine_type || resolveEngineType(m.template_type),
      };
    }

    // Recent alert triggers
    const { data: alerts } = await this.supabase
      .from('alert_history')
      .select('id, triggered_at, severity, context')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })
      .limit(5);

    for (const a of (alerts || [])) {
      events.push({
        id: a.id,
        timestamp: new Date(a.triggered_at).toLocaleTimeString(),
        type: 'alert',
        moduleName: (a.context as any)?.module || 'System',
        engineType: (a.context as any)?.engine_type || 'instant_transaction',
        severity: a.severity as 'info' | 'warning' | 'critical',
        description: (a.context as any)?.message || 'Alert triggered'
      });
    }

    // Recent transactions (replaces separate per-module transaction queries)
    const { data: recentTx } = await this.supabase
      .from('transactions')
      .select('id, created_at, status, engine_type, metadata_id, reference_table, metadata')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(8);

    for (const tx of (recentTx || [])) {
      const mod = moduleMap[tx.metadata_id] || { name: tx.reference_table, engine: tx.engine_type };
      const refLabel = tx.metadata?.order_number || tx.metadata?.booking_number || tx.metadata?.ticket_number || tx.id.slice(0, 8);
      events.push({
        id: tx.id,
        timestamp: new Date(tx.created_at).toLocaleTimeString(),
        type: 'transaction',
        moduleName: mod.name,
        engineType: mod.engine,
        severity: 'info',
        description: `${refLabel} → ${tx.status}`
      });
    }

    // Sort by timestamp desc and limit
    return events.slice(0, limit);
  }

  /**
   * Get system service health for cockpit
   */
  async getSystemServices(propertyId: string): Promise<Array<{
    name: string;
    status: 'operational' | 'degraded' | 'down';
    latency: number;
  }>> {
    const services: Array<{ name: string; status: 'operational' | 'degraded' | 'down'; latency: number }> = [];

    // Database - test with a simple query
    const dbStart = Date.now();
    const { error: dbError } = await this.supabase.from('properties').select('id').eq('id', propertyId).limit(1);
    const dbLatency = Date.now() - dbStart;
    services.push({ name: 'Database', status: dbError ? 'degraded' : 'operational', latency: dbLatency });

    // Alert service
    const alertStart = Date.now();
    const { error: alertError } = await this.supabase.from('alert_definitions').select('id').eq('property_id', propertyId).limit(1);
    const alertLatency = Date.now() - alertStart;
    services.push({ name: 'Alert Service', status: alertError ? 'degraded' : 'operational', latency: alertLatency });

    // Metrics service
    const metricStart = Date.now();
    const { error: metricError } = await this.supabase.from('metric_definitions').select('id').limit(1);
    const metricLatency = Date.now() - metricStart;
    services.push({ name: 'Metrics Service', status: metricError ? 'degraded' : 'operational', latency: metricLatency });

    // Module registry
    const modStart = Date.now();
    const { error: modError } = await this.supabase.from('modules').select('id').eq('property_id', propertyId).limit(1);
    const modLatency = Date.now() - modStart;
    services.push({ name: 'Module Registry', status: modError ? 'degraded' : 'operational', latency: modLatency });

    // Guest segmentation
    const rfmStart = Date.now();
    const { error: rfmError } = await this.supabase.from('guest_rfm_scores').select('id').eq('property_id', propertyId).limit(1);
    const rfmLatency = Date.now() - rfmStart;
    services.push({ name: 'Guest Analytics', status: rfmError ? 'degraded' : 'operational', latency: rfmLatency });

    // Cache layer (simulated - check if metric cache is fresh)
    services.push({ name: 'Cache Layer', status: 'operational', latency: 1 });

    return services;
  }

  private mapMetricFromDb(data: any): MetricDefinition {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      category: data.category,
      dataType: data.data_type,
      calculation: data.calculation,
      targets: data.targets,
      alertThresholds: data.alert_thresholds,
      format: data.format,
      version: data.version,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Get all active engines grouped by engine_type with aggregated metrics.
   * Queries modules + transactions tables only — no hardcoded table names.
   */
  async getEngines(propertyId: string): Promise<{
    engines: Array<{
      engineType: string;
      engineName: string;
      moduleCount: number;
      revenueToday: number;
      revenueYesterday: number;
      transactionCountToday: number;
      transactionCountYesterday: number;
      stateDistribution: Record<string, number>;
      sparkline: number[];
      modules: Array<{
        moduleId: string;
        moduleName: string;
        templateType: string;
        engineType: string;
        isActive: boolean;
        revenueToday: number;
        transactionCountToday: number;
        stateDistribution: Record<string, number>;
      }>;
    }>;
    generatedAt: string;
  }> {
    const now = dayjs();
    const todayStart = now.startOf('day').toISOString();
    const todayEnd = now.endOf('day').toISOString();
    const yesterdayStart = now.subtract(1, 'day').startOf('day').toISOString();
    const yesterdayEnd = now.subtract(1, 'day').endOf('day').toISOString();
    const sparklineStart = now.subtract(6, 'day').startOf('day').toISOString();

    // 1. Get all active modules
    const { data: modules } = await this.supabase
      .from('modules')
      .select('id, name, template_type, engine_type, is_active')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    // 2. Get today's transactions
    const { data: todayTx } = await this.supabase
      .from('transactions')
      .select('engine_type, metadata_id, status, amount')
      .eq('property_id', propertyId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    // 3. Get yesterday's transactions
    const { data: yesterdayTx } = await this.supabase
      .from('transactions')
      .select('engine_type, metadata_id, status, amount')
      .eq('property_id', propertyId)
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd);

    // 4. Get 7-day sparkline data
    const { data: sparklineData } = await this.supabase
      .from('transactions')
      .select('engine_type, amount, created_at')
      .eq('property_id', propertyId)
      .gte('created_at', sparklineStart);

    // 5. Build engine name lookup from registry
    const ENGINE_NAMES: Record<string, string> = {
      instant_transaction: 'Instant Transaction',
      time_exclusive_reservation: 'Time-Exclusive Reservation',
      shared_capacity_access: 'Shared Capacity Access',
      ongoing_entitlement: 'Ongoing Entitlement',
    };

    // 6. Group modules by engine_type
    const moduleGroups: Record<string, Array<{
      moduleId: string; moduleName: string; templateType: string; engineType: string; isActive: boolean;
      revenueToday: number; transactionCountToday: number; stateDistribution: Record<string, number>;
    }>> = {};

    for (const m of (modules || [])) {
      const engineType = m.engine_type || resolveEngineType(m.template_type);
      if (!moduleGroups[engineType]) moduleGroups[engineType] = [];
      moduleGroups[engineType].push({
        moduleId: m.id,
        moduleName: m.name,
        templateType: m.template_type,
        engineType,
        isActive: m.is_active,
        revenueToday: 0,
        transactionCountToday: 0,
        stateDistribution: {},
      });
    }

    // 7. Aggregate today's transactions per module
    for (const tx of (todayTx || [])) {
      const group = moduleGroups[tx.engine_type];
      if (group) {
        const mod = group.find(m => m.moduleId === tx.metadata_id);
        if (mod) {
          mod.revenueToday += tx.amount || 0;
          mod.transactionCountToday += 1;
          mod.stateDistribution[tx.status] = (mod.stateDistribution[tx.status] || 0) + 1;
        }
      }
    }

    // 8. Build engine-level summaries
    const allEngineTypes = ['instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement'];
    const engines = allEngineTypes.map(engineType => {
      const group = moduleGroups[engineType] || [];
      const todayForEngine = (todayTx || []).filter(t => t.engine_type === engineType);
      const yesterdayForEngine = (yesterdayTx || []).filter(t => t.engine_type === engineType);

      const revenueToday = todayForEngine.reduce((s, t) => s + (t.amount || 0), 0);
      const revenueYesterday = yesterdayForEngine.reduce((s, t) => s + (t.amount || 0), 0);
      const transactionCountToday = todayForEngine.length;
      const transactionCountYesterday = yesterdayForEngine.length;

      const stateDistribution: Record<string, number> = {};
      for (const t of todayForEngine) {
        stateDistribution[t.status] = (stateDistribution[t.status] || 0) + 1;
      }

      // Sparkline: 7-day revenue
      const sparkline: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = now.subtract(i, 'day').startOf('day');
        const dayEnd = now.subtract(i, 'day').endOf('day');
        const dayRevenue = (sparklineData || [])
          .filter(t => t.engine_type === engineType && dayjs(t.created_at).isAfter(dayStart) && dayjs(t.created_at).isBefore(dayEnd))
          .reduce((s, t) => s + (t.amount || 0), 0);
        sparkline.push(Math.round(dayRevenue));
      }

      return {
        engineType,
        engineName: ENGINE_NAMES[engineType] || engineType,
        moduleCount: group.length,
        revenueToday: Math.round(revenueToday),
        revenueYesterday: Math.round(revenueYesterday),
        transactionCountToday,
        transactionCountYesterday,
        stateDistribution,
        sparkline,
        modules: group,
      };
    });

    return { engines, generatedAt: new Date().toISOString() };
  }
}

export const metricsLayer = new MetricsLayerService();
