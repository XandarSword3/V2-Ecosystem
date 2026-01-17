/**
 * Analytics Service
 *
 * Provides hotel performance metrics, KPIs, and dashboard management.
 */

import type {
  Container,
  Metric,
  MetricType,
  MetricPeriod,
  MetricAggregation,
  Dashboard,
  DashboardWidget,
  TimeSeriesPoint,
  AnalyticsFilters,
} from '../container/types.js';

// Constants
const METRIC_TYPES: MetricType[] = [
  'revenue',
  'occupancy',
  'bookings',
  'guests',
  'ratings',
  'cancellations',
  'adr',
  'revpar',
  'custom',
];

const METRIC_PERIODS: MetricPeriod[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];

const METRIC_AGGREGATIONS: MetricAggregation[] = [
  'sum',
  'average',
  'count',
  'min',
  'max',
];

const WIDGET_TYPES = ['metric', 'chart', 'table', 'gauge', 'heatmap'] as const;

// Custom error class
export class AnalyticsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecordMetricInput {
  name: string;
  type: MetricType;
  value: number;
  previousValue?: number;
  period: MetricPeriod;
  startDate: string;
  endDate: string;
  unit?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDashboardInput {
  name: string;
  description?: string;
  ownerId: string;
  isDefault?: boolean;
  isPublic?: boolean;
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isPublic?: boolean;
}

export interface CreateWidgetInput {
  dashboardId: string;
  name: string;
  type: typeof WIDGET_TYPES[number];
  metricType?: MetricType;
  config?: Record<string, unknown>;
  position?: { x: number; y: number; width: number; height: number };
}

export interface UpdateWidgetInput {
  name?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number; width: number; height: number };
}

export interface PerformanceSummary {
  revenue: { value: number; change: number | null };
  occupancy: { value: number; change: number | null };
  adr: { value: number; change: number | null };
  revpar: { value: number; change: number | null };
  bookings: { value: number; change: number | null };
  cancellations: { value: number; change: number | null };
  rating: { value: number; change: number | null };
  periodStart: string;
  periodEnd: string;
}

export function createAnalyticsService(container: Container) {
  const { analyticsRepository, logger } = container;

  // ============================================
  // VALIDATION HELPERS
  // ============================================
  function validateId(id: string, field: string = 'ID'): void {
    if (!UUID_REGEX.test(id)) {
      throw new AnalyticsServiceError(`Invalid ${field} format`, 'INVALID_ID');
    }
  }

  function validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      throw new AnalyticsServiceError('Invalid start date', 'INVALID_START_DATE');
    }
    if (isNaN(end.getTime())) {
      throw new AnalyticsServiceError('Invalid end date', 'INVALID_END_DATE');
    }
    if (end < start) {
      throw new AnalyticsServiceError('End date must be after start date', 'INVALID_DATE_RANGE');
    }
  }

  async function getDashboardOrThrow(id: string): Promise<Dashboard> {
    validateId(id);
    const dashboard = await analyticsRepository.getDashboard(id);
    if (!dashboard) {
      throw new AnalyticsServiceError('Dashboard not found', 'NOT_FOUND', 404);
    }
    return dashboard;
  }

  async function getWidgetOrThrow(id: string): Promise<DashboardWidget> {
    validateId(id);
    const widget = await analyticsRepository.getWidget(id);
    if (!widget) {
      throw new AnalyticsServiceError('Widget not found', 'WIDGET_NOT_FOUND', 404);
    }
    return widget;
  }

  // ============================================
  // METRIC RECORDING
  // ============================================
  async function recordMetric(input: RecordMetricInput): Promise<Metric> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new AnalyticsServiceError('Metric name is required', 'INVALID_NAME');
    }

    // Validate type
    if (!METRIC_TYPES.includes(input.type)) {
      throw new AnalyticsServiceError('Invalid metric type', 'INVALID_TYPE');
    }

    // Validate period
    if (!METRIC_PERIODS.includes(input.period)) {
      throw new AnalyticsServiceError('Invalid metric period', 'INVALID_PERIOD');
    }

    // Validate dates
    validateDateRange(input.startDate, input.endDate);

    // Calculate change
    let change: number | null = null;
    let changePercent: number | null = null;

    if (input.previousValue !== undefined && input.previousValue !== null) {
      change = input.value - input.previousValue;
      if (input.previousValue !== 0) {
        changePercent = Math.round((change / input.previousValue) * 100 * 100) / 100;
      }
    }

    const metric = await analyticsRepository.createMetric({
      name: input.name.trim(),
      type: input.type,
      value: input.value,
      previousValue: input.previousValue ?? null,
      change,
      changePercent,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate,
      unit: input.unit || null,
      metadata: input.metadata || {},
    });

    logger?.info?.(`Metric recorded: ${metric.name} = ${metric.value}`);
    return metric;
  }

  async function getMetric(id: string): Promise<Metric | null> {
    validateId(id);
    return analyticsRepository.getMetric(id);
  }

  async function getMetricsByType(type: MetricType, period: MetricPeriod): Promise<Metric[]> {
    if (!METRIC_TYPES.includes(type)) {
      throw new AnalyticsServiceError('Invalid metric type', 'INVALID_TYPE');
    }
    if (!METRIC_PERIODS.includes(period)) {
      throw new AnalyticsServiceError('Invalid metric period', 'INVALID_PERIOD');
    }

    return analyticsRepository.getMetricsByType(type, period);
  }

  async function getMetricsForPeriod(startDate: string, endDate: string): Promise<Metric[]> {
    validateDateRange(startDate, endDate);
    return analyticsRepository.getMetricsForPeriod(startDate, endDate);
  }

  async function getLatestMetrics(types?: MetricType[]): Promise<Metric[]> {
    const metricTypes = types || METRIC_TYPES;
    return analyticsRepository.getLatestMetrics(metricTypes);
  }

  // ============================================
  // DASHBOARD MANAGEMENT
  // ============================================
  async function createDashboard(input: CreateDashboardInput): Promise<Dashboard> {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new AnalyticsServiceError('Dashboard name is required', 'INVALID_NAME');
    }

    // Validate owner
    validateId(input.ownerId, 'owner ID');

    // If setting as default, unset any existing default
    if (input.isDefault) {
      const existingDefault = await analyticsRepository.getDefaultDashboard();
      if (existingDefault) {
        await analyticsRepository.updateDashboard(existingDefault.id, { isDefault: false });
      }
    }

    const dashboard = await analyticsRepository.createDashboard({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      widgets: [],
      ownerId: input.ownerId,
      isDefault: input.isDefault || false,
      isPublic: input.isPublic || false,
    });

    logger?.info?.(`Dashboard created: ${dashboard.name}`);
    return dashboard;
  }

  async function getDashboard(id: string): Promise<Dashboard | null> {
    validateId(id);
    return analyticsRepository.getDashboard(id);
  }

  async function getDashboardsByOwner(ownerId: string): Promise<Dashboard[]> {
    validateId(ownerId, 'owner ID');
    return analyticsRepository.getDashboardsByOwner(ownerId);
  }

  async function getDefaultDashboard(): Promise<Dashboard | null> {
    return analyticsRepository.getDefaultDashboard();
  }

  async function updateDashboard(id: string, input: UpdateDashboardInput): Promise<Dashboard> {
    const dashboard = await getDashboardOrThrow(id);

    const updates: Partial<Dashboard> = {};

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new AnalyticsServiceError('Dashboard name cannot be empty', 'INVALID_NAME');
      }
      updates.name = input.name.trim();
    }

    if (input.description !== undefined) {
      updates.description = input.description?.trim() || null;
    }

    if (input.isDefault !== undefined) {
      if (input.isDefault && !dashboard.isDefault) {
        // Unset any existing default
        const existingDefault = await analyticsRepository.getDefaultDashboard();
        if (existingDefault && existingDefault.id !== id) {
          await analyticsRepository.updateDashboard(existingDefault.id, { isDefault: false });
        }
      }
      updates.isDefault = input.isDefault;
    }

    if (input.isPublic !== undefined) {
      updates.isPublic = input.isPublic;
    }

    if (Object.keys(updates).length === 0) {
      return dashboard;
    }

    const updated = await analyticsRepository.updateDashboard(id, updates);
    logger?.info?.(`Dashboard updated: ${updated.name}`);
    return updated;
  }

  async function deleteDashboard(id: string): Promise<void> {
    const dashboard = await getDashboardOrThrow(id);

    if (dashboard.isDefault) {
      throw new AnalyticsServiceError(
        'Cannot delete default dashboard',
        'CANNOT_DELETE_DEFAULT'
      );
    }

    await analyticsRepository.deleteDashboard(id);
    logger?.info?.(`Dashboard deleted: ${dashboard.name}`);
  }

  async function setDefaultDashboard(id: string): Promise<Dashboard> {
    const dashboard = await getDashboardOrThrow(id);

    if (dashboard.isDefault) {
      return dashboard;
    }

    // Unset existing default
    const existingDefault = await analyticsRepository.getDefaultDashboard();
    if (existingDefault) {
      await analyticsRepository.updateDashboard(existingDefault.id, { isDefault: false });
    }

    const updated = await analyticsRepository.updateDashboard(id, { isDefault: true });
    logger?.info?.(`Dashboard set as default: ${updated.name}`);
    return updated;
  }

  // ============================================
  // WIDGET MANAGEMENT
  // ============================================
  async function createWidget(input: CreateWidgetInput): Promise<DashboardWidget> {
    // Validate dashboard
    await getDashboardOrThrow(input.dashboardId);

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new AnalyticsServiceError('Widget name is required', 'INVALID_NAME');
    }

    // Validate type
    if (!WIDGET_TYPES.includes(input.type)) {
      throw new AnalyticsServiceError('Invalid widget type', 'INVALID_WIDGET_TYPE');
    }

    // Validate metric type if provided
    if (input.metricType && !METRIC_TYPES.includes(input.metricType)) {
      throw new AnalyticsServiceError('Invalid metric type', 'INVALID_METRIC_TYPE');
    }

    const position = input.position || { x: 0, y: 0, width: 1, height: 1 };

    // Validate position
    if (position.width <= 0 || position.height <= 0) {
      throw new AnalyticsServiceError(
        'Widget dimensions must be positive',
        'INVALID_DIMENSIONS'
      );
    }

    const widget = await analyticsRepository.createWidget({
      dashboardId: input.dashboardId,
      name: input.name.trim(),
      type: input.type,
      metricType: input.metricType || null,
      config: input.config || {},
      position,
    });

    logger?.info?.(`Widget created: ${widget.name}`);
    return widget;
  }

  async function getWidget(id: string): Promise<DashboardWidget | null> {
    validateId(id);
    try {
      return await getWidgetOrThrow(id);
    } catch (e) {
      if (e instanceof AnalyticsServiceError && e.code === 'WIDGET_NOT_FOUND') {
        return null;
      }
      throw e;
    }
  }

  async function getWidgetsForDashboard(dashboardId: string): Promise<DashboardWidget[]> {
    await getDashboardOrThrow(dashboardId);
    return analyticsRepository.getWidgetsForDashboard(dashboardId);
  }

  async function updateWidget(id: string, input: UpdateWidgetInput): Promise<DashboardWidget> {
    const widget = await getWidgetOrThrow(id);

    const updates: Partial<DashboardWidget> = {};

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new AnalyticsServiceError('Widget name cannot be empty', 'INVALID_NAME');
      }
      updates.name = input.name.trim();
    }

    if (input.config !== undefined) {
      updates.config = input.config;
    }

    if (input.position !== undefined) {
      if (input.position.width <= 0 || input.position.height <= 0) {
        throw new AnalyticsServiceError(
          'Widget dimensions must be positive',
          'INVALID_DIMENSIONS'
        );
      }
      updates.position = input.position;
    }

    if (Object.keys(updates).length === 0) {
      return widget;
    }

    const updated = await analyticsRepository.updateWidget(id, updates);
    logger?.info?.(`Widget updated: ${updated.name}`);
    return updated;
  }

  async function deleteWidget(id: string): Promise<void> {
    const widget = await getWidgetOrThrow(id);
    await analyticsRepository.deleteWidget(id);
    logger?.info?.(`Widget deleted: ${widget.name}`);
  }

  async function moveWidget(
    id: string,
    position: { x: number; y: number }
  ): Promise<DashboardWidget> {
    const widget = await getWidgetOrThrow(id);
    
    const newPosition = {
      ...widget.position,
      x: position.x,
      y: position.y,
    };

    const updated = await analyticsRepository.updateWidget(id, { position: newPosition });
    return updated;
  }

  async function resizeWidget(
    id: string,
    dimensions: { width: number; height: number }
  ): Promise<DashboardWidget> {
    const widget = await getWidgetOrThrow(id);

    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new AnalyticsServiceError(
        'Widget dimensions must be positive',
        'INVALID_DIMENSIONS'
      );
    }

    const newPosition = {
      ...widget.position,
      width: dimensions.width,
      height: dimensions.height,
    };

    const updated = await analyticsRepository.updateWidget(id, { position: newPosition });
    return updated;
  }

  // ============================================
  // PERFORMANCE CALCULATIONS
  // ============================================
  function calculateOccupancyRate(
    occupiedRooms: number,
    totalRooms: number
  ): number {
    if (totalRooms <= 0) {
      throw new AnalyticsServiceError('Total rooms must be positive', 'INVALID_TOTAL_ROOMS');
    }
    return Math.round((occupiedRooms / totalRooms) * 100 * 100) / 100;
  }

  function calculateADR(totalRevenue: number, roomsSold: number): number {
    if (roomsSold <= 0) {
      return 0;
    }
    return Math.round((totalRevenue / roomsSold) * 100) / 100;
  }

  function calculateRevPAR(totalRevenue: number, totalRoomsAvailable: number): number {
    if (totalRoomsAvailable <= 0) {
      throw new AnalyticsServiceError(
        'Total rooms available must be positive',
        'INVALID_ROOMS_AVAILABLE'
      );
    }
    return Math.round((totalRevenue / totalRoomsAvailable) * 100) / 100;
  }

  function calculateGrowthRate(current: number, previous: number): number | null {
    if (previous === 0) {
      return null;
    }
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }

  // ============================================
  // TIME SERIES DATA
  // ============================================
  function generateTimeSeries(
    metrics: Metric[],
    aggregation: MetricAggregation = 'sum'
  ): TimeSeriesPoint[] {
    // Group by date
    const grouped: Map<string, number[]> = new Map();
    
    for (const metric of metrics) {
      const date = metric.startDate;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(metric.value);
    }

    // Apply aggregation
    const result: TimeSeriesPoint[] = [];
    
    for (const [date, values] of grouped) {
      let value: number;
      
      switch (aggregation) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'average':
          value = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          value = values.length;
          break;
        case 'min':
          value = Math.min(...values);
          break;
        case 'max':
          value = Math.max(...values);
          break;
        default:
          value = values.reduce((a, b) => a + b, 0);
      }

      result.push({ date, value: Math.round(value * 100) / 100 });
    }

    // Sort by date
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // ============================================
  // PERFORMANCE SUMMARY
  // ============================================
  async function getPerformanceSummary(
    startDate: string,
    endDate: string
  ): Promise<PerformanceSummary> {
    validateDateRange(startDate, endDate);

    const metrics = await analyticsRepository.getMetricsForPeriod(startDate, endDate);

    const getMetricValue = (type: MetricType): { value: number; change: number | null } => {
      const metric = metrics.find(m => m.type === type);
      return {
        value: metric?.value ?? 0,
        change: metric?.changePercent ?? null,
      };
    };

    return {
      revenue: getMetricValue('revenue'),
      occupancy: getMetricValue('occupancy'),
      adr: getMetricValue('adr'),
      revpar: getMetricValue('revpar'),
      bookings: getMetricValue('bookings'),
      cancellations: getMetricValue('cancellations'),
      rating: getMetricValue('ratings'),
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  function getMetricTypes(): MetricType[] {
    return [...METRIC_TYPES];
  }

  function getMetricPeriods(): MetricPeriod[] {
    return [...METRIC_PERIODS];
  }

  function getMetricAggregations(): MetricAggregation[] {
    return [...METRIC_AGGREGATIONS];
  }

  function getWidgetTypes(): typeof WIDGET_TYPES[number][] {
    return [...WIDGET_TYPES];
  }

  function formatCurrency(value: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  }

  function formatPercentage(value: number): string {
    return `${value >= 0 ? '+' : ''}${value}%`;
  }

  return {
    // Metrics
    recordMetric,
    getMetric,
    getMetricsByType,
    getMetricsForPeriod,
    getLatestMetrics,

    // Dashboards
    createDashboard,
    getDashboard,
    getDashboardsByOwner,
    getDefaultDashboard,
    updateDashboard,
    deleteDashboard,
    setDefaultDashboard,

    // Widgets
    createWidget,
    getWidget,
    getWidgetsForDashboard,
    updateWidget,
    deleteWidget,
    moveWidget,
    resizeWidget,

    // Calculations
    calculateOccupancyRate,
    calculateADR,
    calculateRevPAR,
    calculateGrowthRate,

    // Time series
    generateTimeSeries,

    // Summary
    getPerformanceSummary,

    // Utility
    getMetricTypes,
    getMetricPeriods,
    getMetricAggregations,
    getWidgetTypes,
    formatCurrency,
    formatPercentage,
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
