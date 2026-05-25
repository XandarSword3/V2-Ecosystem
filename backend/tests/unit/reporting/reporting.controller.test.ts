import { createMockReqRes } from '../utils';

// Mock the reporting service
vi.mock('../../../src/modules/reporting/reporting.service', () => ({
  reportingService: {
    getTemplates: vi.fn(),
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    executeReport: vi.fn(),
    exportReport: vi.fn(),
    getSavedReports: vi.fn(),
    saveReport: vi.fn(),
    updateSavedReport: vi.fn(),
    deleteSavedReport: vi.fn(),
    scheduleReport: vi.fn(),
    createScheduledReport: vi.fn(),
    getScheduledReports: vi.fn(),
    updateScheduledReport: vi.fn(),
    deleteScheduledReport: vi.fn(),
    executeScheduledReport: vi.fn(),
    getDashboards: vi.fn(),
    getDashboardWithWidgets: vi.fn(),
    createDashboard: vi.fn(),
    addWidget: vi.fn(),
    updateWidgetLayout: vi.fn(),
    deleteWidget: vi.fn(),
    createDailySnapshot: vi.fn(),
    lockMonthSnapshot: vi.fn(),
    getKPIs: vi.fn(),
    setKPITarget: vi.fn(),
    generateRevenueReport: vi.fn(),
    generateOccupancyReport: vi.fn(),
    generateChannelPerformanceReport: vi.fn(),
    generateHousekeepingReport: vi.fn(),
    generateMaintenanceReport: vi.fn(),
    getRevenueReport: vi.fn(),
    getOccupancyReport: vi.fn(),
    getChannelPerformanceReport: vi.fn(),
    getHousekeepingReport: vi.fn(),
    getMaintenanceReport: vi.fn(),
  }
}));

import { reportingController } from '../../../src/modules/reporting/reporting.controller';
import { reportingService } from '../../../src/modules/reporting/reporting.service';

describe('Reporting Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTemplates', () => {
    it('should return all report templates', async () => {
      const mockTemplates = [
        { id: 'tpl-1', name: 'Revenue Report', category: 'financial' },
        { id: 'tpl-2', name: 'Occupancy Report', category: 'operational' }
      ];
      vi.mocked(reportingService.getTemplates).mockResolvedValue(mockTemplates);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: {}
      });

      await reportingController.getTemplates(req, res, next);

      expect(reportingService.getTemplates).toHaveBeenCalledWith('prop-1', undefined);
      expect(res.json).toHaveBeenCalledWith({ templates: mockTemplates });
    });

    it('should filter templates by category', async () => {
      const mockTemplates = [{ id: 'tpl-1', name: 'Revenue Report', category: 'financial' }];
      vi.mocked(reportingService.getTemplates).mockResolvedValue(mockTemplates);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { category: 'financial' }
      });

      await reportingController.getTemplates(req, res, next);

      expect(reportingService.getTemplates).toHaveBeenCalledWith('prop-1', 'financial');
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        headers: {},
        query: {}
      });

      await reportingController.getTemplates(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property ID required' });
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');
      vi.mocked(reportingService.getTemplates).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: {}
      });

      await reportingController.getTemplates(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getTemplate', () => {
    it('should return a specific template', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Revenue Report', category: 'financial' };
      vi.mocked(reportingService.getTemplateById).mockResolvedValue(mockTemplate);

      const { req, res, next } = createMockReqRes({
        params: { id: 'tpl-1' }
      });

      await reportingController.getTemplate(req, res, next);

      expect(reportingService.getTemplateById).toHaveBeenCalledWith('tpl-1');
      expect(res.json).toHaveBeenCalledWith({ template: mockTemplate });
    });

    it('should return 404 for non-existent template', async () => {
      vi.mocked(reportingService.getTemplateById).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid-id' }
      });

      await reportingController.getTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Template not found' });
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const mockTemplate = { id: 'tpl-new', name: 'Custom Report', category: 'custom' };
      vi.mocked(reportingService.createTemplate).mockResolvedValue(mockTemplate);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { name: 'Custom Report', category: 'custom', columns: [] },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.createTemplate(req, res, next);

      expect(reportingService.createTemplate).toHaveBeenCalledWith('prop-1', req.body, 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ template: mockTemplate });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        headers: {},
        body: { name: 'Custom Report' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.createTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Updated Report' };
      vi.mocked(reportingService.updateTemplate).mockResolvedValue(mockTemplate);

      const { req, res, next } = createMockReqRes({
        params: { id: 'tpl-1' },
        body: { name: 'Updated Report' }
      });

      await reportingController.updateTemplate(req, res, next);

      expect(reportingService.updateTemplate).toHaveBeenCalledWith('tpl-1', { name: 'Updated Report' });
      expect(res.json).toHaveBeenCalledWith({ template: mockTemplate });
    });

    it('should return 404 for non-existent or system template', async () => {
      vi.mocked(reportingService.updateTemplate).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'system-tpl' },
        body: { name: 'Updated' }
      });

      await reportingController.updateTemplate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      vi.mocked(reportingService.deleteTemplate).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'tpl-1' }
      });

      await reportingController.deleteTemplate(req, res, next);

      expect(reportingService.deleteTemplate).toHaveBeenCalledWith('tpl-1');
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('executeReport', () => {
    it('should execute a report', async () => {
      const mockResult = {
        data: [{ date: '2024-01-01', revenue: 5000 }],
        metadata: { totalRows: 1 }
      };
      vi.mocked(reportingService.executeReport).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        params: { templateId: 'tpl-1' },
        body: {
          dateRange: { start: '2024-01-01', end: '2024-01-31' },
          filters: {}
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.executeReport(req, res, next);

      expect(reportingService.executeReport).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        headers: {},
        params: { templateId: 'tpl-1' },
        body: {},
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.executeReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('exportReport', () => {
    it('should export a report to PDF', async () => {
      const mockResult = { data: [], metadata: {} };
      const mockTemplate = { id: 'tpl-1', name: 'Revenue Report' };
      vi.mocked(reportingService.executeReport).mockResolvedValue(mockResult);
      vi.mocked(reportingService.getTemplateById).mockResolvedValue(mockTemplate);
      vi.mocked(reportingService.exportReport).mockResolvedValue('https://storage.example.com/report.pdf');

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        params: { templateId: 'tpl-1' },
        body: { format: 'pdf' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.exportReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ exportUrl: 'https://storage.example.com/report.pdf', format: 'pdf' });
    });
  });

  describe('getSavedReports', () => {
    it('should return saved reports', async () => {
      const mockReports = [
        { id: 'sr-1', name: 'Q1 Revenue', created_at: '2024-01-15' }
      ];
      vi.mocked(reportingService.getSavedReports).mockResolvedValue(mockReports);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getSavedReports(req, res, next);

      expect(reportingService.getSavedReports).toHaveBeenCalledWith('prop-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ reports: mockReports });
    });
  });

  describe('saveReport', () => {
    it('should save a report', async () => {
      const mockSaved = { id: 'sr-new', name: 'Q2 Revenue' };
      vi.mocked(reportingService.saveReport).mockResolvedValue(mockSaved);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { name: 'Q2 Revenue', templateId: 'tpl-1', config: {} },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.saveReport(req, res, next);

      expect(reportingService.saveReport).toHaveBeenCalledWith('prop-1', 'user-1', req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('createScheduledReport', () => {
    it('should create a scheduled report', async () => {
      const mockScheduled = { id: 'sch-1', frequency: 'daily' };
      vi.mocked(reportingService.createScheduledReport).mockResolvedValue(mockScheduled);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { savedReportId: 'sr-1', frequency: 'daily', recipients: ['admin@hotel.com'] },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ scheduled: mockScheduled });
    });
  });

  describe('getScheduledReports', () => {
    it('should return scheduled reports', async () => {
      const mockReports = [{ id: 'sch-1', frequency: 'daily' }];
      vi.mocked(reportingService.getScheduledReports).mockResolvedValue(mockReports);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getScheduledReports(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ reports: mockReports });
    });
  });

  describe('getDashboards', () => {
    it('should return dashboards', async () => {
      const mockDashboards = [{ id: 'dash-1', name: 'Main Dashboard' }];
      vi.mocked(reportingService.getDashboards).mockResolvedValue(mockDashboards);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getDashboards(req, res, next);

      expect(reportingService.getDashboards).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith({ dashboards: mockDashboards });
    });
  });

  describe('getDashboard', () => {
    it('should return a specific dashboard', async () => {
      const mockDashboard = { id: 'dash-1', name: 'Main Dashboard', widgets: [] };
      vi.mocked(reportingService.getDashboardWithWidgets).mockResolvedValue(mockDashboard);

      const { req, res, next } = createMockReqRes({
        params: { id: 'dash-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ dashboard: mockDashboard });
    });

    it('should return 404 for non-existent dashboard', async () => {
      vi.mocked(reportingService.getDashboardWithWidgets).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid-id' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getDashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createSnapshot', () => {
    it('should create a report snapshot', async () => {
      vi.mocked(reportingService.createDailySnapshot).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { date: '2024-01-01' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.createSnapshot(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Snapshot created' });
    });
  });

  describe('lockMonthSnapshot', () => {
    it('should lock month snapshots', async () => {
      vi.mocked(reportingService.lockMonthSnapshot).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { month: '2024-01-01' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.lockMonthSnapshot(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Month snapshots locked' });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { month: '2024-01-01' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.lockMonthSnapshot(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getKPIs', () => {
    it('should return KPIs', async () => {
      const mockKpis = [{ code: 'RevPAR', value: 150, trend: 'up' }];
      vi.mocked(reportingService.getKPIs).mockResolvedValue(mockKpis);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getKPIs(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const call = (res.json as any).mock.calls[0][0];
      expect(call.kpis).toEqual(mockKpis);
    });

    it('should filter KPIs by codes', async () => {
      vi.mocked(reportingService.getKPIs).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { codes: 'RevPAR,ADR,OccupancyRate' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getKPIs(req, res, next);

      expect(reportingService.getKPIs).toHaveBeenCalledWith(
        'prop-1',
        expect.any(Object),
        ['RevPAR', 'ADR', 'OccupancyRate']
      );
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getKPIs(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('setKPITarget', () => {
    it('should set a KPI target', async () => {
      const mockTarget = { id: 'target-1', kpiCode: 'RevPAR', targetValue: 180 };
      vi.mocked(reportingService.setKPITarget).mockResolvedValue(mockTarget);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: {
          kpiCode: 'RevPAR',
          periodType: 'monthly',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
          targetValue: 180,
          stretchTarget: 200,
          notes: 'Holiday season target'
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.setKPITarget(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ target: mockTarget });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { kpiCode: 'RevPAR' }
      });

      await reportingController.setKPITarget(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getRevenueReport', () => {
    it('should return revenue report', async () => {
      const mockReport = { totalRevenue: 100000, byCategory: [] };
      vi.mocked(reportingService.generateRevenueReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31', groupBy: 'day' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getRevenueReport(req, res, next);

      expect(reportingService.generateRevenueReport).toHaveBeenCalledWith(
        'prop-1',
        expect.any(Object),
        'day'
      );
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getRevenueReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getOccupancyReport', () => {
    it('should return occupancy report', async () => {
      const mockReport = { avgOccupancy: 0.75, byRoomType: [] };
      vi.mocked(reportingService.generateOccupancyReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getOccupancyReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getOccupancyReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getChannelPerformanceReport', () => {
    it('should return channel performance report', async () => {
      const mockReport = { channels: [], summary: {} };
      vi.mocked(reportingService.generateChannelPerformanceReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getChannelPerformanceReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getChannelPerformanceReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getHousekeepingReport', () => {
    it('should return housekeeping report', async () => {
      const mockReport = { roomsStatus: [], tasksSummary: {} };
      vi.mocked(reportingService.generateHousekeepingReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { date: '2024-01-15' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getHousekeepingReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getHousekeepingReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getMaintenanceReport', () => {
    it('should return maintenance report', async () => {
      const mockReport = { issues: [], completed: [], pending: [] };
      vi.mocked(reportingService.generateMaintenanceReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.getMaintenanceReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await reportingController.getMaintenanceReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateSavedReport', () => {
    it('should update a saved report', async () => {
      const mockReport = { id: 'sr-1', name: 'Updated Report' };
      vi.mocked(reportingService.updateSavedReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sr-1' },
        body: { name: 'Updated Report' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.updateSavedReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ report: mockReport });
    });

    it('should return 404 for non-existent saved report', async () => {
      vi.mocked(reportingService.updateSavedReport).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid-id' },
        body: { name: 'Updated' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.updateSavedReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteSavedReport', () => {
    it('should delete a saved report', async () => {
      vi.mocked(reportingService.deleteSavedReport).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sr-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.deleteSavedReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('updateScheduledReport', () => {
    it('should update a scheduled report', async () => {
      const mockScheduled = { id: 'sch-1', frequency: 'weekly' };
      vi.mocked(reportingService.updateScheduledReport).mockResolvedValue(mockScheduled);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sch-1' },
        body: { frequency: 'weekly' }
      });

      await reportingController.updateScheduledReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ scheduled: mockScheduled });
    });

    it('should return 404 for non-existent scheduled report', async () => {
      vi.mocked(reportingService.updateScheduledReport).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid-id' },
        body: {}
      });

      await reportingController.updateScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteScheduledReport', () => {
    it('should delete a scheduled report', async () => {
      vi.mocked(reportingService.deleteScheduledReport).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sch-1' }
      });

      await reportingController.deleteScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('runScheduledReportNow', () => {
    it('should run a scheduled report immediately', async () => {
      vi.mocked(reportingService.executeScheduledReport).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sch-1' }
      });

      await reportingController.runScheduledReportNow(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Report executed successfully' });
    });

    it('should call next on error', async () => {
      const error = new Error('Execution failed');
      vi.mocked(reportingService.executeScheduledReport).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { id: 'sch-1' }
      });

      await reportingController.runScheduledReportNow(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createDashboard', () => {
    it('should create a dashboard', async () => {
      const mockDashboard = { id: 'dash-new', name: 'New Dashboard' };
      vi.mocked(reportingService.createDashboard).mockResolvedValue(mockDashboard);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: { name: 'New Dashboard' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await reportingController.createDashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ dashboard: mockDashboard });
    });

    it('should return 400 if property ID missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'New Dashboard' }
      });

      await reportingController.createDashboard(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('addWidget', () => {
    it('should add a widget to a dashboard', async () => {
      const mockWidget = { id: 'widget-new', type: 'chart' };
      vi.mocked(reportingService.addWidget).mockResolvedValue(mockWidget);

      const { req, res, next } = createMockReqRes({
        params: { dashboardId: 'dash-1' },
        body: { type: 'chart', config: {} }
      });

      await reportingController.addWidget(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ widget: mockWidget });
    });
  });

  describe('updateWidgetLayout', () => {
    it('should update widget layout', async () => {
      vi.mocked(reportingService.updateWidgetLayout).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { widgetId: 'widget-1' },
        body: { x: 0, y: 0, width: 2, height: 2 }
      });

      await reportingController.updateWidgetLayout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ message: 'Widget layout updated' });
    });
  });

  describe('deleteWidget', () => {
    it('should delete a widget', async () => {
      vi.mocked(reportingService.deleteWidget).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { widgetId: 'widget-1' }
      });

      await reportingController.deleteWidget(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('createSnapshot - error handling', () => {
    it('should call next on error', async () => {
      const error = new Error('Snapshot failed');
      vi.mocked(reportingService.createDailySnapshot).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        headers: { 'x-property-id': 'prop-1' },
        body: {}
      });

      await reportingController.createSnapshot(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
