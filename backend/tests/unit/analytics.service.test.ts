/**
 * Analytics Service Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAnalyticsService, AnalyticsServiceError } from '../../src/lib/services/analytics.service.js';
import { InMemoryAnalyticsRepository } from '../../src/lib/repositories/analytics.repository.memory.js';
import type { Container, MetricType, MetricPeriod } from '../../src/lib/container/types.js';

// Test constants
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const INVALID_UUID = 'not-a-valid-uuid';

describe('AnalyticsService', () => {
  let service: ReturnType<typeof createAnalyticsService>;
  let repository: InMemoryAnalyticsRepository;

  beforeEach(() => {
    repository = new InMemoryAnalyticsRepository();
    const container = {
      analyticsRepository: repository,
      logger: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      },
    } as unknown as Container;
    service = createAnalyticsService(container);
  });

  // ============================================
  // RECORD METRIC TESTS
  // ============================================
  describe('recordMetric', () => {
    const validInput = {
      name: 'Daily Revenue',
      type: 'revenue' as MetricType,
      value: 5000,
      period: 'daily' as MetricPeriod,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    };

    it('should record metric with required fields', async () => {
      const metric = await service.recordMetric(validInput);

      expect(metric.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(metric.name).toBe('Daily Revenue');
      expect(metric.type).toBe('revenue');
      expect(metric.value).toBe(5000);
      expect(metric.period).toBe('daily');
    });

    it('should calculate change from previous value', async () => {
      const metric = await service.recordMetric({
        ...validInput,
        previousValue: 4000,
      });

      expect(metric.change).toBe(1000);
      expect(metric.changePercent).toBe(25);
    });

    it('should handle zero previous value', async () => {
      const metric = await service.recordMetric({
        ...validInput,
        previousValue: 0,
      });

      expect(metric.change).toBe(5000);
      expect(metric.changePercent).toBeNull();
    });

    it('should set unit and metadata', async () => {
      const metric = await service.recordMetric({
        ...validInput,
        unit: 'EUR',
        metadata: { source: 'pms' },
      });

      expect(metric.unit).toBe('EUR');
      expect(metric.metadata).toEqual({ source: 'pms' });
    });

    it('should reject empty name', async () => {
      await expect(
        service.recordMetric({ ...validInput, name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject invalid type', async () => {
      await expect(
        service.recordMetric({ ...validInput, type: 'invalid' as MetricType })
      ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
    });

    it('should reject invalid period', async () => {
      await expect(
        service.recordMetric({ ...validInput, period: 'invalid' as MetricPeriod })
      ).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
    });

    it('should reject invalid start date', async () => {
      await expect(
        service.recordMetric({ ...validInput, startDate: 'invalid' })
      ).rejects.toMatchObject({ code: 'INVALID_START_DATE' });
    });

    it('should reject invalid end date', async () => {
      await expect(
        service.recordMetric({ ...validInput, endDate: 'invalid' })
      ).rejects.toMatchObject({ code: 'INVALID_END_DATE' });
    });

    it('should reject end before start', async () => {
      await expect(
        service.recordMetric({
          ...validInput,
          startDate: '2026-01-15',
          endDate: '2026-01-01',
        })
      ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    });
  });

  describe('getMetric', () => {
    it('should retrieve metric by ID', async () => {
      const created = await service.recordMetric({
        name: 'Occupancy',
        type: 'occupancy',
        value: 85,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });

      const metric = await service.getMetric(created.id);
      expect(metric).toBeDefined();
      expect(metric?.name).toBe('Occupancy');
    });

    it('should return null for non-existent', async () => {
      const metric = await service.getMetric(VALID_UUID);
      expect(metric).toBeNull();
    });

    it('should reject invalid ID', async () => {
      await expect(
        service.getMetric(INVALID_UUID)
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });
  });

  describe('getMetricsByType', () => {
    it('should get metrics by type and period', async () => {
      await service.recordMetric({
        name: 'Revenue 1',
        type: 'revenue',
        value: 5000,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      await service.recordMetric({
        name: 'Revenue 2',
        type: 'revenue',
        value: 6000,
        period: 'weekly',
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      const dailyRevenue = await service.getMetricsByType('revenue', 'daily');
      expect(dailyRevenue).toHaveLength(1);
      expect(dailyRevenue[0].name).toBe('Revenue 1');
    });

    it('should reject invalid type', async () => {
      await expect(
        service.getMetricsByType('invalid' as MetricType, 'daily')
      ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
    });

    it('should reject invalid period', async () => {
      await expect(
        service.getMetricsByType('revenue', 'invalid' as MetricPeriod)
      ).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
    });
  });

  describe('getMetricsForPeriod', () => {
    it('should get metrics within period', async () => {
      await service.recordMetric({
        name: 'Jan Metric',
        type: 'revenue',
        value: 5000,
        period: 'daily',
        startDate: '2026-01-15',
        endDate: '2026-01-15',
      });
      await service.recordMetric({
        name: 'Feb Metric',
        type: 'revenue',
        value: 6000,
        period: 'daily',
        startDate: '2026-02-15',
        endDate: '2026-02-15',
      });

      const janMetrics = await service.getMetricsForPeriod('2026-01-01', '2026-01-31');
      expect(janMetrics).toHaveLength(1);
      expect(janMetrics[0].name).toBe('Jan Metric');
    });
  });

  describe('getLatestMetrics', () => {
    it('should get latest metrics by type', async () => {
      await service.recordMetric({
        name: 'Old Revenue',
        type: 'revenue',
        value: 4000,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      await service.recordMetric({
        name: 'New Revenue',
        type: 'revenue',
        value: 5000,
        period: 'daily',
        startDate: '2026-01-02',
        endDate: '2026-01-02',
      });

      const latest = await service.getLatestMetrics(['revenue']);
      expect(latest).toHaveLength(1);
      expect(latest[0].name).toBe('New Revenue');
    });
  });

  // ============================================
  // DASHBOARD MANAGEMENT TESTS
  // ============================================
  describe('createDashboard', () => {
    const validInput = {
      name: 'Main Dashboard',
      ownerId: VALID_UUID,
    };

    it('should create dashboard with required fields', async () => {
      const dashboard = await service.createDashboard(validInput);

      expect(dashboard.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(dashboard.name).toBe('Main Dashboard');
      expect(dashboard.ownerId).toBe(VALID_UUID);
      expect(dashboard.isDefault).toBe(false);
      expect(dashboard.isPublic).toBe(false);
    });

    it('should set optional fields', async () => {
      const dashboard = await service.createDashboard({
        ...validInput,
        description: 'Overview dashboard',
        isDefault: true,
        isPublic: true,
      });

      expect(dashboard.description).toBe('Overview dashboard');
      expect(dashboard.isDefault).toBe(true);
      expect(dashboard.isPublic).toBe(true);
    });

    it('should unset previous default when creating new default', async () => {
      const first = await service.createDashboard({
        ...validInput,
        isDefault: true,
      });
      const second = await service.createDashboard({
        name: 'Second Dashboard',
        ownerId: VALID_UUID,
        isDefault: true,
      });

      const updatedFirst = await service.getDashboard(first.id);
      expect(updatedFirst?.isDefault).toBe(false);
      expect(second.isDefault).toBe(true);
    });

    it('should reject empty name', async () => {
      await expect(
        service.createDashboard({ ...validInput, name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject invalid owner ID', async () => {
      await expect(
        service.createDashboard({ ...validInput, ownerId: INVALID_UUID })
      ).rejects.toMatchObject({ code: 'INVALID_ID' });
    });
  });

  describe('getDashboard', () => {
    it('should retrieve dashboard by ID', async () => {
      const created = await service.createDashboard({
        name: 'Test Dashboard',
        ownerId: VALID_UUID,
      });

      const dashboard = await service.getDashboard(created.id);
      expect(dashboard).toBeDefined();
      expect(dashboard?.name).toBe('Test Dashboard');
    });

    it('should return null for non-existent', async () => {
      const dashboard = await service.getDashboard(VALID_UUID);
      expect(dashboard).toBeNull();
    });
  });

  describe('getDashboardsByOwner', () => {
    it('should get dashboards by owner', async () => {
      await service.createDashboard({
        name: 'Owner 1 Dash',
        ownerId: VALID_UUID,
      });
      await service.createDashboard({
        name: 'Owner 2 Dash',
        ownerId: VALID_UUID_2,
      });

      const dashboards = await service.getDashboardsByOwner(VALID_UUID);
      expect(dashboards).toHaveLength(1);
      expect(dashboards[0].name).toBe('Owner 1 Dash');
    });
  });

  describe('updateDashboard', () => {
    let dashboardId: string;

    beforeEach(async () => {
      const dashboard = await service.createDashboard({
        name: 'Original Name',
        ownerId: VALID_UUID,
      });
      dashboardId = dashboard.id;
    });

    it('should update name', async () => {
      const updated = await service.updateDashboard(dashboardId, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update description', async () => {
      const updated = await service.updateDashboard(dashboardId, { description: 'New desc' });
      expect(updated.description).toBe('New desc');
    });

    it('should set as default', async () => {
      const updated = await service.updateDashboard(dashboardId, { isDefault: true });
      expect(updated.isDefault).toBe(true);
    });

    it('should reject empty name', async () => {
      await expect(
        service.updateDashboard(dashboardId, { name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });
  });

  describe('deleteDashboard', () => {
    it('should delete dashboard', async () => {
      const dashboard = await service.createDashboard({
        name: 'To Delete',
        ownerId: VALID_UUID,
      });

      await service.deleteDashboard(dashboard.id);
      const deleted = await service.getDashboard(dashboard.id);
      expect(deleted).toBeNull();
    });

    it('should reject deleting default dashboard', async () => {
      const dashboard = await service.createDashboard({
        name: 'Default',
        ownerId: VALID_UUID,
        isDefault: true,
      });

      await expect(
        service.deleteDashboard(dashboard.id)
      ).rejects.toMatchObject({ code: 'CANNOT_DELETE_DEFAULT' });
    });
  });

  describe('setDefaultDashboard', () => {
    it('should set dashboard as default', async () => {
      const dashboard = await service.createDashboard({
        name: 'New Default',
        ownerId: VALID_UUID,
      });

      const updated = await service.setDefaultDashboard(dashboard.id);
      expect(updated.isDefault).toBe(true);
    });

    it('should unset previous default', async () => {
      const first = await service.createDashboard({
        name: 'First',
        ownerId: VALID_UUID,
        isDefault: true,
      });
      const second = await service.createDashboard({
        name: 'Second',
        ownerId: VALID_UUID,
      });

      await service.setDefaultDashboard(second.id);

      const updatedFirst = await service.getDashboard(first.id);
      expect(updatedFirst?.isDefault).toBe(false);
    });
  });

  // ============================================
  // WIDGET MANAGEMENT TESTS
  // ============================================
  describe('createWidget', () => {
    let dashboardId: string;

    beforeEach(async () => {
      const dashboard = await service.createDashboard({
        name: 'Widget Dashboard',
        ownerId: VALID_UUID,
      });
      dashboardId = dashboard.id;
    });

    it('should create widget with required fields', async () => {
      const widget = await service.createWidget({
        dashboardId,
        name: 'Revenue Widget',
        type: 'metric',
      });

      expect(widget.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(widget.name).toBe('Revenue Widget');
      expect(widget.type).toBe('metric');
    });

    it('should set metric type', async () => {
      const widget = await service.createWidget({
        dashboardId,
        name: 'Revenue Metric',
        type: 'metric',
        metricType: 'revenue',
      });

      expect(widget.metricType).toBe('revenue');
    });

    it('should set position', async () => {
      const widget = await service.createWidget({
        dashboardId,
        name: 'Positioned Widget',
        type: 'chart',
        position: { x: 2, y: 1, width: 4, height: 2 },
      });

      expect(widget.position).toEqual({ x: 2, y: 1, width: 4, height: 2 });
    });

    it('should reject empty name', async () => {
      await expect(
        service.createWidget({ dashboardId, name: '', type: 'metric' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject invalid widget type', async () => {
      await expect(
        service.createWidget({ dashboardId, name: 'Bad', type: 'invalid' as 'metric' })
      ).rejects.toMatchObject({ code: 'INVALID_WIDGET_TYPE' });
    });

    it('should reject invalid metric type', async () => {
      await expect(
        service.createWidget({
          dashboardId,
          name: 'Bad',
          type: 'metric',
          metricType: 'invalid' as MetricType,
        })
      ).rejects.toMatchObject({ code: 'INVALID_METRIC_TYPE' });
    });

    it('should reject invalid dimensions', async () => {
      await expect(
        service.createWidget({
          dashboardId,
          name: 'Bad',
          type: 'metric',
          position: { x: 0, y: 0, width: 0, height: 1 },
        })
      ).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });
  });

  describe('updateWidget', () => {
    let dashboardId: string;
    let widgetId: string;

    beforeEach(async () => {
      const dashboard = await service.createDashboard({
        name: 'Update Widget Dashboard',
        ownerId: VALID_UUID,
      });
      dashboardId = dashboard.id;

      const widget = await service.createWidget({
        dashboardId,
        name: 'Original Widget',
        type: 'metric',
      });
      widgetId = widget.id;
    });

    it('should update widget name', async () => {
      const updated = await service.updateWidget(widgetId, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('should update widget config', async () => {
      const updated = await service.updateWidget(widgetId, { config: { color: 'blue' } });
      expect(updated.config).toEqual({ color: 'blue' });
    });

    it('should update widget position', async () => {
      const updated = await service.updateWidget(widgetId, {
        position: { x: 5, y: 3, width: 2, height: 2 },
      });
      expect(updated.position).toEqual({ x: 5, y: 3, width: 2, height: 2 });
    });

    it('should reject empty name', async () => {
      await expect(
        service.updateWidget(widgetId, { name: '' })
      ).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });

    it('should reject invalid dimensions', async () => {
      await expect(
        service.updateWidget(widgetId, {
          position: { x: 0, y: 0, width: -1, height: 1 },
        })
      ).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });
  });

  describe('deleteWidget', () => {
    it('should delete widget', async () => {
      const dashboard = await service.createDashboard({
        name: 'Delete Widget Dashboard',
        ownerId: VALID_UUID,
      });
      const widget = await service.createWidget({
        dashboardId: dashboard.id,
        name: 'To Delete',
        type: 'metric',
      });

      await service.deleteWidget(widget.id);
      const deleted = await service.getWidget(widget.id);
      expect(deleted).toBeNull();
    });
  });

  describe('moveWidget', () => {
    it('should move widget', async () => {
      const dashboard = await service.createDashboard({
        name: 'Move Widget Dashboard',
        ownerId: VALID_UUID,
      });
      const widget = await service.createWidget({
        dashboardId: dashboard.id,
        name: 'Movable',
        type: 'chart',
        position: { x: 0, y: 0, width: 2, height: 2 },
      });

      const moved = await service.moveWidget(widget.id, { x: 5, y: 3 });
      expect(moved.position.x).toBe(5);
      expect(moved.position.y).toBe(3);
      expect(moved.position.width).toBe(2); // Preserved
    });
  });

  describe('resizeWidget', () => {
    it('should resize widget', async () => {
      const dashboard = await service.createDashboard({
        name: 'Resize Widget Dashboard',
        ownerId: VALID_UUID,
      });
      const widget = await service.createWidget({
        dashboardId: dashboard.id,
        name: 'Resizable',
        type: 'chart',
        position: { x: 1, y: 1, width: 2, height: 2 },
      });

      const resized = await service.resizeWidget(widget.id, { width: 4, height: 3 });
      expect(resized.position.width).toBe(4);
      expect(resized.position.height).toBe(3);
      expect(resized.position.x).toBe(1); // Preserved
    });

    it('should reject invalid dimensions', async () => {
      const dashboard = await service.createDashboard({
        name: 'Bad Resize Dashboard',
        ownerId: VALID_UUID,
      });
      const widget = await service.createWidget({
        dashboardId: dashboard.id,
        name: 'BadResize',
        type: 'chart',
      });

      await expect(
        service.resizeWidget(widget.id, { width: 0, height: 2 })
      ).rejects.toMatchObject({ code: 'INVALID_DIMENSIONS' });
    });
  });

  // ============================================
  // CALCULATION TESTS
  // ============================================
  describe('calculateOccupancyRate', () => {
    it('should calculate occupancy rate', () => {
      const rate = service.calculateOccupancyRate(85, 100);
      expect(rate).toBe(85);
    });

    it('should handle decimal rates', () => {
      const rate = service.calculateOccupancyRate(75, 90);
      expect(rate).toBe(83.33);
    });

    it('should reject zero total rooms', () => {
      expect(() => service.calculateOccupancyRate(10, 0)).toThrow(AnalyticsServiceError);
    });
  });

  describe('calculateADR', () => {
    it('should calculate ADR', () => {
      const adr = service.calculateADR(10000, 50);
      expect(adr).toBe(200);
    });

    it('should return 0 for no rooms sold', () => {
      const adr = service.calculateADR(0, 0);
      expect(adr).toBe(0);
    });
  });

  describe('calculateRevPAR', () => {
    it('should calculate RevPAR', () => {
      const revpar = service.calculateRevPAR(8500, 100);
      expect(revpar).toBe(85);
    });

    it('should reject zero rooms available', () => {
      expect(() => service.calculateRevPAR(5000, 0)).toThrow(AnalyticsServiceError);
    });
  });

  describe('calculateGrowthRate', () => {
    it('should calculate positive growth', () => {
      const growth = service.calculateGrowthRate(120, 100);
      expect(growth).toBe(20);
    });

    it('should calculate negative growth', () => {
      const growth = service.calculateGrowthRate(80, 100);
      expect(growth).toBe(-20);
    });

    it('should return null for zero previous', () => {
      const growth = service.calculateGrowthRate(100, 0);
      expect(growth).toBeNull();
    });
  });

  // ============================================
  // TIME SERIES TESTS
  // ============================================
  describe('generateTimeSeries', () => {
    it('should generate time series with sum aggregation', async () => {
      const m1 = await service.recordMetric({
        name: 'R1',
        type: 'revenue',
        value: 1000,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      const m2 = await service.recordMetric({
        name: 'R2',
        type: 'revenue',
        value: 2000,
        period: 'daily',
        startDate: '2026-01-02',
        endDate: '2026-01-02',
      });

      const series = service.generateTimeSeries([m1, m2], 'sum');
      expect(series).toHaveLength(2);
      expect(series[0].value).toBe(1000);
      expect(series[1].value).toBe(2000);
    });

    it('should aggregate same-date values', async () => {
      const m1 = await service.recordMetric({
        name: 'R1',
        type: 'revenue',
        value: 1000,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      const m2 = await service.recordMetric({
        name: 'R2',
        type: 'revenue',
        value: 500,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });

      const series = service.generateTimeSeries([m1, m2], 'sum');
      expect(series).toHaveLength(1);
      expect(series[0].value).toBe(1500);
    });

    it('should apply average aggregation', async () => {
      const m1 = await service.recordMetric({
        name: 'O1',
        type: 'occupancy',
        value: 80,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      const m2 = await service.recordMetric({
        name: 'O2',
        type: 'occupancy',
        value: 90,
        period: 'daily',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });

      const series = service.generateTimeSeries([m1, m2], 'average');
      expect(series[0].value).toBe(85);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getMetricTypes', () => {
    it('should return all metric types', () => {
      const types = service.getMetricTypes();
      expect(types).toContain('revenue');
      expect(types).toContain('occupancy');
      expect(types).toContain('adr');
      expect(types).toContain('revpar');
    });
  });

  describe('getMetricPeriods', () => {
    it('should return all periods', () => {
      const periods = service.getMetricPeriods();
      expect(periods).toContain('daily');
      expect(periods).toContain('weekly');
      expect(periods).toContain('monthly');
    });
  });

  describe('getWidgetTypes', () => {
    it('should return all widget types', () => {
      const types = service.getWidgetTypes();
      expect(types).toContain('metric');
      expect(types).toContain('chart');
      expect(types).toContain('table');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency', () => {
      const formatted = service.formatCurrency(1234.56);
      expect(formatted).toContain('1,234.56');
    });
  });

  describe('formatPercentage', () => {
    it('should format positive percentage', () => {
      const formatted = service.formatPercentage(15.5);
      expect(formatted).toBe('+15.5%');
    });

    it('should format negative percentage', () => {
      const formatted = service.formatPercentage(-8.2);
      expect(formatted).toBe('-8.2%');
    });
  });
});
