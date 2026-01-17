/**
 * Reporting Service Unit Tests
 *
 * Comprehensive tests for the reporting service covering:
 * - Revenue reports
 * - Booking analytics
 * - Order statistics
 * - User reports
 * - Dashboard summary
 * - Period comparisons
 * - Export functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReportingService, ReportingServiceError } from '../../src/lib/services/reporting.service';
import { InMemoryReportingRepository } from '../../src/lib/repositories/reporting.repository.memory';
import type { Container, ReportType, ReportPeriod } from '../../src/lib/container/types';

// Test data
const TEST_MODULE_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CHALET_ID = '22222222-2222-2222-2222-222222222222';

function createMockContainer(reportingRepo: InMemoryReportingRepository): Container {
  return {
    reportingRepository: reportingRepo,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Container;
}

describe('ReportingService', () => {
  let reportingRepo: InMemoryReportingRepository;
  let container: Container;
  let reportingService: ReturnType<typeof createReportingService>;

  beforeEach(() => {
    reportingRepo = new InMemoryReportingRepository();
    container = createMockContainer(reportingRepo);
    reportingService = createReportingService(container);

    // Set up default test data
    reportingRepo.setRevenueData({
      totalRevenue: 10000,
      totalOrders: 150,
      totalBookings: 25,
      averageOrderValue: 66.67,
      averageBookingValue: 400,
      revenueByDay: [
        { date: '2024-01-01', amount: 500 },
        { date: '2024-01-02', amount: 750 },
      ],
      revenueByModule: { restaurant: 6000, pool: 4000 },
    });

    reportingRepo.setBookingData({
      totalBookings: 25,
      confirmedBookings: 20,
      pendingBookings: 3,
      cancelledBookings: 2,
      occupancyRate: 75,
      averageStayDuration: 3.5,
      popularChalets: [
        { chaletId: TEST_CHALET_ID, chaletName: 'Beach Chalet', bookingCount: 10 },
      ],
    });

    reportingRepo.setOrderData({
      totalOrders: 150,
      completedOrders: 140,
      pendingOrders: 8,
      cancelledOrders: 2,
      averageOrderValue: 66.67,
      topItems: [
        { itemId: '1', itemName: 'Burger', quantity: 50, revenue: 500 },
      ],
      ordersByStatus: { completed: 140, pending: 8, cancelled: 2 },
    });

    reportingRepo.setUserData({
      totalUsers: 500,
      newUsers: 25,
      activeUsers: 150,
      usersByRole: { user: 450, staff: 40, admin: 10 },
      userGrowthByDay: [
        { date: '2024-01-01', count: 10 },
        { date: '2024-01-02', count: 15 },
      ],
    });
  });

  // =============================================
  // REVENUE REPORT TESTS
  // =============================================
  describe('getRevenueReport', () => {
    it('should get revenue report with default period', async () => {
      const result = await reportingService.getRevenueReport();

      expect(result.totalRevenue).toBe(10000);
      expect(result.totalOrders).toBe(150);
      expect(result.averageOrderValue).toBe(66.67);
    });

    it('should get revenue report for today', async () => {
      const result = await reportingService.getRevenueReport({ period: 'today' });

      expect(result).toBeDefined();
      expect(result.totalRevenue).toBe(10000);
    });

    it('should get revenue report for week', async () => {
      const result = await reportingService.getRevenueReport({ period: 'week' });

      expect(result).toBeDefined();
      expect(result.revenueByDay).toBeDefined();
    });

    it('should get revenue report for month', async () => {
      const result = await reportingService.getRevenueReport({ period: 'month' });

      expect(result).toBeDefined();
      expect(result.revenueByModule).toBeDefined();
    });

    it('should get revenue report for quarter', async () => {
      const result = await reportingService.getRevenueReport({ period: 'quarter' });
      expect(result).toBeDefined();
    });

    it('should get revenue report for year', async () => {
      const result = await reportingService.getRevenueReport({ period: 'year' });
      expect(result).toBeDefined();
    });

    it('should get revenue report for custom date range', async () => {
      const result = await reportingService.getRevenueReport({
        period: 'custom',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(result).toBeDefined();
    });

    it('should filter by module ID', async () => {
      const result = await reportingService.getRevenueReport({
        moduleId: TEST_MODULE_ID,
      });

      expect(result).toBeDefined();
    });

    it('should throw error for invalid period', async () => {
      await expect(
        reportingService.getRevenueReport({ period: 'invalid' as ReportPeriod })
      ).rejects.toThrow('Invalid period');
    });

    it('should throw error for custom period without date range', async () => {
      await expect(
        reportingService.getRevenueReport({ period: 'custom' })
      ).rejects.toThrow('Date range is required for custom period');
    });

    it('should throw error for invalid start date', async () => {
      await expect(
        reportingService.getRevenueReport({
          period: 'custom',
          dateRange: { startDate: 'invalid', endDate: '2024-01-31' },
        })
      ).rejects.toThrow('Invalid start date format');
    });

    it('should throw error for invalid end date', async () => {
      await expect(
        reportingService.getRevenueReport({
          period: 'custom',
          dateRange: { startDate: '2024-01-01', endDate: 'invalid' },
        })
      ).rejects.toThrow('Invalid end date format');
    });

    it('should throw error when start date is after end date', async () => {
      await expect(
        reportingService.getRevenueReport({
          period: 'custom',
          dateRange: { startDate: '2024-12-31', endDate: '2024-01-01' },
        })
      ).rejects.toThrow('Start date must be before or equal to end date');
    });

    it('should throw error for date range exceeding 365 days', async () => {
      await expect(
        reportingService.getRevenueReport({
          period: 'custom',
          dateRange: { startDate: '2022-01-01', endDate: '2024-01-01' },
        })
      ).rejects.toThrow('Date range cannot exceed 365 days');
    });

    it('should throw error for invalid module ID format', async () => {
      await expect(
        reportingService.getRevenueReport({ moduleId: 'invalid-id' })
      ).rejects.toThrow('Invalid module ID format');
    });

    it('should throw error for invalid chalet ID format', async () => {
      await expect(
        reportingService.getRevenueReport({ chaletId: 'invalid-id' })
      ).rejects.toThrow('Invalid chalet ID format');
    });
  });

  // =============================================
  // BOOKING REPORT TESTS
  // =============================================
  describe('getBookingReport', () => {
    it('should get booking report with default period', async () => {
      const result = await reportingService.getBookingReport();

      expect(result.totalBookings).toBe(25);
      expect(result.confirmedBookings).toBe(20);
      expect(result.occupancyRate).toBe(75);
    });

    it('should get booking report for specific period', async () => {
      const result = await reportingService.getBookingReport({ period: 'week' });

      expect(result).toBeDefined();
      expect(result.pendingBookings).toBe(3);
    });

    it('should include popular chalets', async () => {
      const result = await reportingService.getBookingReport();

      expect(result.popularChalets).toBeDefined();
      expect(result.popularChalets.length).toBeGreaterThan(0);
    });

    it('should filter by chalet ID', async () => {
      const result = await reportingService.getBookingReport({
        chaletId: TEST_CHALET_ID,
      });

      expect(result).toBeDefined();
    });

    it('should get average stay duration', async () => {
      const result = await reportingService.getBookingReport();

      expect(result.averageStayDuration).toBe(3.5);
    });
  });

  // =============================================
  // ORDER REPORT TESTS
  // =============================================
  describe('getOrderReport', () => {
    it('should get order report with default period', async () => {
      const result = await reportingService.getOrderReport();

      expect(result.totalOrders).toBe(150);
      expect(result.completedOrders).toBe(140);
      expect(result.averageOrderValue).toBe(66.67);
    });

    it('should include orders by status', async () => {
      const result = await reportingService.getOrderReport();

      expect(result.ordersByStatus).toBeDefined();
      expect(result.ordersByStatus.completed).toBe(140);
    });

    it('should include top items', async () => {
      const result = await reportingService.getOrderReport();

      expect(result.topItems).toBeDefined();
      expect(result.topItems.length).toBeGreaterThan(0);
    });

    it('should get order report for specific module', async () => {
      const result = await reportingService.getOrderReport({
        moduleId: TEST_MODULE_ID,
      });

      expect(result).toBeDefined();
    });
  });

  // =============================================
  // USER REPORT TESTS
  // =============================================
  describe('getUserReport', () => {
    it('should get user report with default period', async () => {
      const result = await reportingService.getUserReport();

      expect(result.totalUsers).toBe(500);
      expect(result.newUsers).toBe(25);
      expect(result.activeUsers).toBe(150);
    });

    it('should include users by role', async () => {
      const result = await reportingService.getUserReport();

      expect(result.usersByRole).toBeDefined();
      expect(result.usersByRole.admin).toBe(10);
    });

    it('should include user growth by day', async () => {
      const result = await reportingService.getUserReport();

      expect(result.userGrowthByDay).toBeDefined();
      expect(result.userGrowthByDay.length).toBeGreaterThan(0);
    });
  });

  // =============================================
  // DASHBOARD SUMMARY TESTS
  // =============================================
  describe('getDashboardSummary', () => {
    it('should get dashboard summary', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(result.revenue).toBeDefined();
      expect(result.bookings).toBeDefined();
      expect(result.orders).toBeDefined();
      expect(result.users).toBeDefined();
    });

    it('should include revenue for different periods', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(result.revenue.today).toBeDefined();
      expect(result.revenue.week).toBeDefined();
      expect(result.revenue.month).toBeDefined();
    });

    it('should include revenue trend', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(typeof result.revenue.trend).toBe('number');
    });

    it('should include booking counts', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(result.bookings.pending).toBeDefined();
      expect(result.bookings.confirmed).toBeDefined();
    });

    it('should include order counts', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(result.orders.pending).toBeDefined();
      expect(result.orders.completedToday).toBeDefined();
    });

    it('should include user stats', async () => {
      const result = await reportingService.getDashboardSummary();

      expect(result.users.total).toBeDefined();
      expect(result.users.newThisWeek).toBeDefined();
    });
  });

  // =============================================
  // GENERATE REPORT TESTS
  // =============================================
  describe('generateReport', () => {
    it('should generate revenue report', async () => {
      const result = await reportingService.generateReport('revenue');

      expect(result.id).toBeDefined();
      expect(result.type).toBe('revenue');
      expect(result.generatedAt).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should generate bookings report', async () => {
      const result = await reportingService.generateReport('bookings');

      expect(result.type).toBe('bookings');
      expect(result.data).toBeDefined();
    });

    it('should generate orders report', async () => {
      const result = await reportingService.generateReport('orders');

      expect(result.type).toBe('orders');
      expect(result.data).toBeDefined();
    });

    it('should generate users report', async () => {
      const result = await reportingService.generateReport('users');

      expect(result.type).toBe('users');
      expect(result.data).toBeDefined();
    });

    it('should generate pool report', async () => {
      const result = await reportingService.generateReport('pool');

      expect(result.type).toBe('pool');
    });

    it('should generate reviews report', async () => {
      const result = await reportingService.generateReport('reviews');

      expect(result.type).toBe('reviews');
    });

    it('should include date range in report', async () => {
      const result = await reportingService.generateReport('revenue', {
        period: 'custom',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      expect(result.dateRange.startDate).toBe('2024-01-01');
      expect(result.dateRange.endDate).toBe('2024-01-31');
    });

    it('should throw error for invalid report type', async () => {
      await expect(
        reportingService.generateReport('invalid' as ReportType)
      ).rejects.toThrow('Invalid report type');
    });

    it('should set period to custom when date range provided', async () => {
      const result = await reportingService.generateReport('revenue', {
        period: 'custom',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      expect(result.period).toBe('custom');
    });
  });

  // =============================================
  // COMPARE PERIODS TESTS
  // =============================================
  describe('comparePeriods', () => {
    it('should compare two revenue periods', async () => {
      const result = await reportingService.comparePeriods(
        'revenue',
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        { startDate: '2023-12-01', endDate: '2023-12-31' }
      );

      expect(result.period1Data).toBeDefined();
      expect(result.period2Data).toBeDefined();
      expect(result.comparison).toBeDefined();
    });

    it('should calculate percentage changes', async () => {
      reportingRepo.setRevenueData({ totalRevenue: 10000 });

      const result = await reportingService.comparePeriods(
        'revenue',
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        { startDate: '2023-12-01', endDate: '2023-12-31' }
      );

      expect(result.comparison.percentageChange).toBeDefined();
    });

    it('should compare booking periods', async () => {
      const result = await reportingService.comparePeriods(
        'bookings',
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        { startDate: '2023-12-01', endDate: '2023-12-31' }
      );

      expect(result.period1Data).toBeDefined();
    });

    it('should throw error for missing period 1 dates', async () => {
      await expect(
        reportingService.comparePeriods(
          'revenue',
          { startDate: '', endDate: '' },
          { startDate: '2023-12-01', endDate: '2023-12-31' }
        )
      ).rejects.toThrow('Period 1 dates are required');
    });

    it('should throw error for missing period 2 dates', async () => {
      await expect(
        reportingService.comparePeriods(
          'revenue',
          { startDate: '2024-01-01', endDate: '2024-01-31' },
          { startDate: '', endDate: '' }
        )
      ).rejects.toThrow('Period 2 dates are required');
    });

    it('should throw error for invalid report type', async () => {
      await expect(
        reportingService.comparePeriods(
          'invalid' as ReportType,
          { startDate: '2024-01-01', endDate: '2024-01-31' },
          { startDate: '2023-12-01', endDate: '2023-12-31' }
        )
      ).rejects.toThrow('Invalid report type');
    });
  });

  // =============================================
  // EXPORT REPORT TESTS
  // =============================================
  describe('exportReport', () => {
    it('should export report as JSON', async () => {
      const report = await reportingService.generateReport('revenue');
      const exported = reportingService.exportReport(report, {
        format: 'json',
        includeDetails: true,
      });

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.type).toBe('revenue');
    });

    it('should export report as JSON without details', async () => {
      const report = await reportingService.generateReport('revenue');
      const exported = reportingService.exportReport(report, {
        format: 'json',
        includeDetails: false,
      });

      const parsed = JSON.parse(exported);
      expect(parsed.data).toBeDefined();
      expect(parsed.id).toBeUndefined();
    });

    it('should export report as CSV', async () => {
      const report = await reportingService.generateReport('revenue');
      const exported = reportingService.exportReport(report, {
        format: 'csv',
        includeDetails: false,
      });

      expect(exported).toContain(',');
      expect(exported.split('\n').length).toBe(2); // Headers + data
    });

    it('should include numeric values in CSV', async () => {
      const report = await reportingService.generateReport('revenue');
      const exported = reportingService.exportReport(report, {
        format: 'csv',
        includeDetails: false,
      });

      expect(exported).toContain('totalRevenue');
      expect(exported).toContain('10000');
    });

    it('should throw error for invalid format', async () => {
      const report = await reportingService.generateReport('revenue');

      expect(() =>
        reportingService.exportReport(report, {
          format: 'xml' as 'json' | 'csv',
          includeDetails: false,
        })
      ).toThrow('Invalid export format');
    });
  });

  // =============================================
  // UTILITY FUNCTION TESTS
  // =============================================
  describe('getDateRangeFromPeriod', () => {
    it('should return date range for today', () => {
      const result = reportingService.getDateRangeFromPeriod('today');
      const today = new Date().toISOString().split('T')[0];

      expect(result.startDate).toBe(today);
      expect(result.endDate).toBe(today);
    });

    it('should return date range for yesterday', () => {
      const result = reportingService.getDateRangeFromPeriod('yesterday');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().split('T')[0];

      expect(result.startDate).toBe(expectedDate);
      expect(result.endDate).toBe(expectedDate);
    });

    it('should return date range for week', () => {
      const result = reportingService.getDateRangeFromPeriod('week');
      const today = new Date().toISOString().split('T')[0];

      expect(result.endDate).toBe(today);
      expect(result.startDate).toBeDefined();
    });

    it('should return date range for month', () => {
      const result = reportingService.getDateRangeFromPeriod('month');

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('should return date range for quarter', () => {
      const result = reportingService.getDateRangeFromPeriod('quarter');

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('should return date range for year', () => {
      const result = reportingService.getDateRangeFromPeriod('year');

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('should throw error for custom period', () => {
      expect(() => reportingService.getDateRangeFromPeriod('custom')).toThrow(
        'Invalid period'
      );
    });
  });

  describe('getAvailableReportTypes', () => {
    it('should return all available report types', () => {
      const types = reportingService.getAvailableReportTypes();

      expect(types).toContain('revenue');
      expect(types).toContain('bookings');
      expect(types).toContain('orders');
      expect(types).toContain('users');
      expect(types).toContain('pool');
      expect(types).toContain('reviews');
    });
  });

  describe('getAvailablePeriods', () => {
    it('should return all available periods', () => {
      const periods = reportingService.getAvailablePeriods();

      expect(periods).toContain('today');
      expect(periods).toContain('yesterday');
      expect(periods).toContain('week');
      expect(periods).toContain('month');
      expect(periods).toContain('quarter');
      expect(periods).toContain('year');
      expect(periods).toContain('custom');
    });
  });

  describe('isValidReportType', () => {
    it('should return true for valid report types', () => {
      expect(reportingService.isValidReportType('revenue')).toBe(true);
      expect(reportingService.isValidReportType('bookings')).toBe(true);
      expect(reportingService.isValidReportType('orders')).toBe(true);
      expect(reportingService.isValidReportType('users')).toBe(true);
    });

    it('should return false for invalid report types', () => {
      expect(reportingService.isValidReportType('invalid')).toBe(false);
      expect(reportingService.isValidReportType('')).toBe(false);
    });
  });

  describe('isValidPeriod', () => {
    it('should return true for valid periods', () => {
      expect(reportingService.isValidPeriod('today')).toBe(true);
      expect(reportingService.isValidPeriod('week')).toBe(true);
      expect(reportingService.isValidPeriod('month')).toBe(true);
    });

    it('should return false for invalid periods', () => {
      expect(reportingService.isValidPeriod('invalid')).toBe(false);
      expect(reportingService.isValidPeriod('')).toBe(false);
    });
  });

  describe('calculateGrowthRate', () => {
    it('should calculate positive growth rate', () => {
      const result = reportingService.calculateGrowthRate(120, 100);
      expect(result).toBe(20);
    });

    it('should calculate negative growth rate', () => {
      const result = reportingService.calculateGrowthRate(80, 100);
      expect(result).toBe(-20);
    });

    it('should return 100 when previous is zero and current is positive', () => {
      const result = reportingService.calculateGrowthRate(100, 0);
      expect(result).toBe(100);
    });

    it('should return 0 when both are zero', () => {
      const result = reportingService.calculateGrowthRate(0, 0);
      expect(result).toBe(0);
    });

    it('should handle decimal precision', () => {
      const result = reportingService.calculateGrowthRate(133, 100);
      expect(result).toBe(33);
    });
  });

  // =============================================
  // KPI TESTS
  // =============================================
  describe('getKPIs', () => {
    it('should get all KPIs', async () => {
      const result = await reportingService.getKPIs();

      expect(result.revenue).toBeDefined();
      expect(result.bookings).toBeDefined();
      expect(result.orders).toBeDefined();
      expect(result.users).toBeDefined();
    });

    it('should include KPI values', async () => {
      const result = await reportingService.getKPIs();

      expect(typeof result.revenue.value).toBe('number');
      expect(typeof result.bookings.value).toBe('number');
    });

    it('should include KPI trends', async () => {
      const result = await reportingService.getKPIs();

      expect(typeof result.revenue.trend).toBe('number');
      expect(typeof result.bookings.trend).toBe('number');
    });

    it('should include KPI labels', async () => {
      const result = await reportingService.getKPIs();

      expect(result.revenue.label).toBe('Total Revenue');
      expect(result.bookings.label).toBe('Total Bookings');
      expect(result.orders.label).toBe('Total Orders');
      expect(result.users.label).toBe('Total Users');
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================
  describe('ReportingServiceError', () => {
    it('should have correct error name', async () => {
      try {
        await reportingService.getRevenueReport({ period: 'invalid' as ReportPeriod });
      } catch (error) {
        expect(error).toBeInstanceOf(ReportingServiceError);
        expect((error as ReportingServiceError).name).toBe('ReportingServiceError');
      }
    });

    it('should have error code', async () => {
      try {
        await reportingService.getRevenueReport({ period: 'invalid' as ReportPeriod });
      } catch (error) {
        expect((error as ReportingServiceError).code).toBe('INVALID_PERIOD');
      }
    });
  });
});
