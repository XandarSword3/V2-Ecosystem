/**
 * Reporting Service with Dependency Injection
 *
 * This service handles all reporting and analytics operations including:
 * - Revenue reports
 * - Booking analytics
 * - Order statistics
 * - User activity reports
 * - Dashboard data aggregation
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  BookingSummary,
  Container,
  DateRange,
  OrderSummary,
  ReportFilters,
  ReportPeriod,
  ReportType,
  RevenueSummary,
  UserSummary,
} from '../container/types';

// Custom error class
export class ReportingServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ReportingServiceError';
  }
}

// Valid periods and report types
const VALID_PERIODS: ReportPeriod[] = ['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom'];
const VALID_REPORT_TYPES: ReportType[] = ['revenue', 'bookings', 'orders', 'users', 'pool', 'reviews'];

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DashboardSummary {
  revenue: {
    today: number;
    week: number;
    month: number;
    trend: number; // Percentage change from previous period
  };
  bookings: {
    pending: number;
    confirmed: number;
    checkingInToday: number;
    checkingOutToday: number;
  };
  orders: {
    pending: number;
    inProgress: number;
    completedToday: number;
  };
  users: {
    total: number;
    newThisWeek: number;
    activeToday: number;
  };
}

export interface ReportExportOptions {
  format: 'json' | 'csv';
  includeDetails: boolean;
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  period: ReportPeriod;
  dateRange: DateRange;
  generatedAt: string;
  data: RevenueSummary | BookingSummary | OrderSummary | UserSummary;
}

export function createReportingService(container: Container) {
  const { reportingRepository, logger } = container;

  /**
   * Validates a UUID format
   */
  function isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  /**
   * Calculate date range from period
   */
  function getDateRangeFromPeriod(period: ReportPeriod): DateRange {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: string;

    switch (period) {
      case 'today':
        startDate = endDate;
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        return { startDate, endDate: startDate };
      }
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      }
      case 'quarter': {
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        startDate = quarterAgo.toISOString().split('T')[0];
        break;
      }
      case 'year': {
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
      }
      default:
        throw new ReportingServiceError(`Invalid period: ${period}`, 'INVALID_PERIOD');
    }

    return { startDate, endDate };
  }

  /**
   * Validate report filters
   */
  function validateFilters(filters: ReportFilters): void {
    if (filters.period && !VALID_PERIODS.includes(filters.period)) {
      throw new ReportingServiceError(
        `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
        'INVALID_PERIOD'
      );
    }

    if (filters.period === 'custom' && !filters.dateRange) {
      throw new ReportingServiceError(
        'Date range is required for custom period',
        'MISSING_DATE_RANGE'
      );
    }

    if (filters.dateRange) {
      const { startDate, endDate } = filters.dateRange;
      
      if (!startDate || isNaN(Date.parse(startDate))) {
        throw new ReportingServiceError('Invalid start date format', 'INVALID_START_DATE');
      }
      
      if (!endDate || isNaN(Date.parse(endDate))) {
        throw new ReportingServiceError('Invalid end date format', 'INVALID_END_DATE');
      }
      
      if (startDate > endDate) {
        throw new ReportingServiceError(
          'Start date must be before or equal to end date',
          'INVALID_DATE_RANGE'
        );
      }

      // Check for maximum date range (1 year)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        throw new ReportingServiceError(
          'Date range cannot exceed 365 days',
          'DATE_RANGE_TOO_LARGE'
        );
      }
    }

    if (filters.moduleId && !isValidUUID(filters.moduleId)) {
      throw new ReportingServiceError('Invalid module ID format', 'INVALID_MODULE_ID');
    }

    if (filters.chaletId && !isValidUUID(filters.chaletId)) {
      throw new ReportingServiceError('Invalid chalet ID format', 'INVALID_CHALET_ID');
    }
  }

  /**
   * Normalize filters with date range
   */
  function normalizeFilters(filters: ReportFilters): ReportFilters & { dateRange: DateRange } {
    validateFilters(filters);

    const dateRange = filters.dateRange || getDateRangeFromPeriod(filters.period || 'month');
    
    return {
      ...filters,
      dateRange,
    };
  }

  /**
   * Get revenue report
   */
  async function getRevenueReport(filters: ReportFilters = {}): Promise<RevenueSummary> {
    const normalizedFilters = normalizeFilters(filters);
    logger.info(`Generating revenue report for ${normalizedFilters.dateRange.startDate} to ${normalizedFilters.dateRange.endDate}`);
    
    const summary = await reportingRepository.getRevenueSummary(normalizedFilters);
    return summary;
  }

  /**
   * Get booking report
   */
  async function getBookingReport(filters: ReportFilters = {}): Promise<BookingSummary> {
    const normalizedFilters = normalizeFilters(filters);
    logger.info(`Generating booking report for ${normalizedFilters.dateRange.startDate} to ${normalizedFilters.dateRange.endDate}`);
    
    const summary = await reportingRepository.getBookingSummary(normalizedFilters);
    return summary;
  }

  /**
   * Get order report
   */
  async function getOrderReport(filters: ReportFilters = {}): Promise<OrderSummary> {
    const normalizedFilters = normalizeFilters(filters);
    logger.info(`Generating order report for ${normalizedFilters.dateRange.startDate} to ${normalizedFilters.dateRange.endDate}`);
    
    const summary = await reportingRepository.getOrderSummary(normalizedFilters);
    return summary;
  }

  /**
   * Get user report
   */
  async function getUserReport(filters: ReportFilters = {}): Promise<UserSummary> {
    const normalizedFilters = normalizeFilters(filters);
    logger.info(`Generating user report for ${normalizedFilters.dateRange.startDate} to ${normalizedFilters.dateRange.endDate}`);
    
    const summary = await reportingRepository.getUserSummary(normalizedFilters);
    return summary;
  }

  /**
   * Get dashboard summary with all key metrics
   */
  async function getDashboardSummary(): Promise<DashboardSummary> {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Get revenue data for different periods
    const [todayRevenue, weekRevenue, monthRevenue] = await Promise.all([
      reportingRepository.getRevenueSummary({ period: 'today', dateRange: { startDate: today, endDate: today } }),
      reportingRepository.getRevenueSummary({ period: 'week', dateRange: { startDate: weekAgo.toISOString().split('T')[0], endDate: today } }),
      reportingRepository.getRevenueSummary({ period: 'month', dateRange: { startDate: monthAgo.toISOString().split('T')[0], endDate: today } }),
    ]);

    // Get booking and order data
    const [bookings, orders, users] = await Promise.all([
      reportingRepository.getBookingSummary({ period: 'today', dateRange: { startDate: today, endDate: today } }),
      reportingRepository.getOrderSummary({ period: 'today', dateRange: { startDate: today, endDate: today } }),
      reportingRepository.getUserSummary({ period: 'week', dateRange: { startDate: weekAgo.toISOString().split('T')[0], endDate: today } }),
    ]);

    // Calculate revenue trend (week over week)
    const previousWeek = new Date(weekAgo);
    previousWeek.setDate(previousWeek.getDate() - 7);
    const previousWeekRevenue = await reportingRepository.getRevenueSummary({
      period: 'custom',
      dateRange: {
        startDate: previousWeek.toISOString().split('T')[0],
        endDate: weekAgo.toISOString().split('T')[0],
      },
    });

    const trend = previousWeekRevenue.totalRevenue > 0
      ? ((weekRevenue.totalRevenue - previousWeekRevenue.totalRevenue) / previousWeekRevenue.totalRevenue) * 100
      : 0;

    return {
      revenue: {
        today: todayRevenue.totalRevenue,
        week: weekRevenue.totalRevenue,
        month: monthRevenue.totalRevenue,
        trend: Math.round(trend * 100) / 100,
      },
      bookings: {
        pending: bookings.pendingBookings,
        confirmed: bookings.confirmedBookings,
        checkingInToday: 0, // Would need specific repository method
        checkingOutToday: 0, // Would need specific repository method
      },
      orders: {
        pending: orders.pendingOrders,
        inProgress: 0, // Would need specific status tracking
        completedToday: orders.completedOrders,
      },
      users: {
        total: users.totalUsers,
        newThisWeek: users.newUsers,
        activeToday: users.activeUsers,
      },
    };
  }

  /**
   * Generate a full report by type
   */
  async function generateReport(
    type: ReportType,
    filters: ReportFilters = {}
  ): Promise<GeneratedReport> {
    if (!VALID_REPORT_TYPES.includes(type)) {
      throw new ReportingServiceError(
        `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
        'INVALID_REPORT_TYPE'
      );
    }

    const normalizedFilters = normalizeFilters(filters);

    let data: RevenueSummary | BookingSummary | OrderSummary | UserSummary;

    switch (type) {
      case 'revenue':
        data = await reportingRepository.getRevenueSummary(normalizedFilters);
        break;
      case 'bookings':
        data = await reportingRepository.getBookingSummary(normalizedFilters);
        break;
      case 'orders':
        data = await reportingRepository.getOrderSummary(normalizedFilters);
        break;
      case 'users':
        data = await reportingRepository.getUserSummary(normalizedFilters);
        break;
      case 'pool':
        // Pool uses order summary for snack/food orders at pool
        data = await reportingRepository.getOrderSummary({
          ...normalizedFilters,
          moduleId: normalizedFilters.moduleId || 'pool',
        });
        break;
      case 'reviews':
        // Reviews can use user summary for now
        data = await reportingRepository.getUserSummary(normalizedFilters);
        break;
      default:
        throw new ReportingServiceError(`Unsupported report type: ${type}`, 'UNSUPPORTED_TYPE');
    }

    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      type,
      period: normalizedFilters.period || 'custom',
      dateRange: normalizedFilters.dateRange,
      generatedAt: new Date().toISOString(),
      data,
    };

    logger.info(`Generated ${type} report ${report.id}`);
    return report;
  }

  /**
   * Compare two periods
   */
  async function comparePeriods(
    reportType: ReportType,
    period1: DateRange,
    period2: DateRange
  ): Promise<{
    period1Data: RevenueSummary | BookingSummary | OrderSummary | UserSummary;
    period2Data: RevenueSummary | BookingSummary | OrderSummary | UserSummary;
    comparison: {
      percentageChange: Record<string, number>;
    };
  }> {
    // Validate date ranges
    if (!period1.startDate || !period1.endDate) {
      throw new ReportingServiceError('Period 1 dates are required', 'MISSING_DATES');
    }
    if (!period2.startDate || !period2.endDate) {
      throw new ReportingServiceError('Period 2 dates are required', 'MISSING_DATES');
    }

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      throw new ReportingServiceError('Invalid report type', 'INVALID_REPORT_TYPE');
    }

    const [report1, report2] = await Promise.all([
      generateReport(reportType, { period: 'custom', dateRange: period1 }),
      generateReport(reportType, { period: 'custom', dateRange: period2 }),
    ]);

    // Calculate percentage changes for numeric fields
    const percentageChange: Record<string, number> = {};
    const data1 = report1.data as unknown as Record<string, unknown>;
    const data2 = report2.data as unknown as Record<string, unknown>;

    for (const key of Object.keys(data1)) {
      const val1 = data1[key];
      const val2 = data2[key];
      
      if (typeof val1 === 'number' && typeof val2 === 'number' && val2 !== 0) {
        percentageChange[key] = Math.round(((val1 - val2) / val2) * 10000) / 100;
      }
    }

    return {
      period1Data: report1.data,
      period2Data: report2.data,
      comparison: { percentageChange },
    };
  }

  /**
   * Export report data to specified format
   */
  function exportReport(
    report: GeneratedReport,
    options: ReportExportOptions
  ): string {
    if (options.format === 'json') {
      return JSON.stringify(
        options.includeDetails ? report : { type: report.type, data: report.data },
        null,
        2
      );
    }

    if (options.format === 'csv') {
      const data = report.data as unknown as Record<string, unknown>;
      const headers: string[] = [];
      const values: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' || typeof value === 'string') {
          headers.push(key);
          values.push(String(value));
        }
      }

      return `${headers.join(',')}\n${values.join(',')}`;
    }

    throw new ReportingServiceError('Invalid export format', 'INVALID_FORMAT');
  }

  /**
   * Get available report types
   */
  function getAvailableReportTypes(): ReportType[] {
    return [...VALID_REPORT_TYPES];
  }

  /**
   * Get available periods
   */
  function getAvailablePeriods(): ReportPeriod[] {
    return [...VALID_PERIODS];
  }

  /**
   * Validate report type
   */
  function isValidReportType(type: string): type is ReportType {
    return VALID_REPORT_TYPES.includes(type as ReportType);
  }

  /**
   * Validate period
   */
  function isValidPeriod(period: string): period is ReportPeriod {
    return VALID_PERIODS.includes(period as ReportPeriod);
  }

  /**
   * Calculate growth rate between two values
   */
  function calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  /**
   * Get KPIs (Key Performance Indicators)
   */
  async function getKPIs(): Promise<{
    revenue: { value: number; trend: number; label: string };
    bookings: { value: number; trend: number; label: string };
    orders: { value: number; trend: number; label: string };
    users: { value: number; trend: number; label: string };
  }> {
    const currentMonth = await Promise.all([
      getRevenueReport({ period: 'month' }),
      getBookingReport({ period: 'month' }),
      getOrderReport({ period: 'month' }),
      getUserReport({ period: 'month' }),
    ]);

    // Get previous month for trend calculation
    const prevMonthEnd = new Date();
    prevMonthEnd.setMonth(prevMonthEnd.getMonth() - 1);
    const prevMonthStart = new Date(prevMonthEnd);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const previousMonth = await Promise.all([
      getRevenueReport({
        period: 'custom',
        dateRange: {
          startDate: prevMonthStart.toISOString().split('T')[0],
          endDate: prevMonthEnd.toISOString().split('T')[0],
        },
      }),
      getBookingReport({
        period: 'custom',
        dateRange: {
          startDate: prevMonthStart.toISOString().split('T')[0],
          endDate: prevMonthEnd.toISOString().split('T')[0],
        },
      }),
      getOrderReport({
        period: 'custom',
        dateRange: {
          startDate: prevMonthStart.toISOString().split('T')[0],
          endDate: prevMonthEnd.toISOString().split('T')[0],
        },
      }),
      getUserReport({
        period: 'custom',
        dateRange: {
          startDate: prevMonthStart.toISOString().split('T')[0],
          endDate: prevMonthEnd.toISOString().split('T')[0],
        },
      }),
    ]);

    return {
      revenue: {
        value: currentMonth[0].totalRevenue,
        trend: calculateGrowthRate(currentMonth[0].totalRevenue, previousMonth[0].totalRevenue),
        label: 'Total Revenue',
      },
      bookings: {
        value: currentMonth[1].totalBookings,
        trend: calculateGrowthRate(currentMonth[1].totalBookings, previousMonth[1].totalBookings),
        label: 'Total Bookings',
      },
      orders: {
        value: currentMonth[2].totalOrders,
        trend: calculateGrowthRate(currentMonth[2].totalOrders, previousMonth[2].totalOrders),
        label: 'Total Orders',
      },
      users: {
        value: currentMonth[3].totalUsers,
        trend: calculateGrowthRate(currentMonth[3].newUsers, previousMonth[3].newUsers),
        label: 'Total Users',
      },
    };
  }

  return {
    // Individual reports
    getRevenueReport,
    getBookingReport,
    getOrderReport,
    getUserReport,

    // Dashboard and aggregations
    getDashboardSummary,
    getKPIs,

    // Report generation
    generateReport,
    comparePeriods,
    exportReport,

    // Utilities
    getDateRangeFromPeriod,
    getAvailableReportTypes,
    getAvailablePeriods,
    isValidReportType,
    isValidPeriod,
    calculateGrowthRate,
  };
}

export type ReportingService = ReturnType<typeof createReportingService>;
