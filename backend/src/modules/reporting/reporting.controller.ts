/**
 * Reporting Controller
 * Phase 3.1: HTTP endpoints for advanced reporting
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { reportingService } from './reporting.service';

export class ReportingController {
  // =============================================
  // REPORT TEMPLATES
  // =============================================

  getTemplates = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { category } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const templates = await reportingService.getTemplates(propertyId, category as string);
      res.json({ templates });
  });
  getTemplate = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const template = await reportingService.getTemplateById(id);

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json({ template });
  });
  createTemplate = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const template = await reportingService.createTemplate(propertyId, req.body, userId);
      res.status(201).json({ template });
  });
  updateTemplate = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const template = await reportingService.updateTemplate(id, req.body);

      if (!template) {
        res.status(404).json({ error: 'Template not found or is system template' });
        return;
      }

      res.json({ template });
  });
  deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await reportingService.deleteTemplate(id);
      res.status(204).send();
  });
  // =============================================
  // REPORT EXECUTION
  // =============================================

  executeReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { templateId } = req.params;
      const { dateRange, filters, groupBy, sortBy, limit, offset } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      // Parse date range
      const parsedDateRange = dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined;

      const result = await reportingService.executeReport(
        propertyId,
        templateId,
        { dateRange: parsedDateRange, filters, groupBy, sortBy, limit, offset },
        userId
      );

      res.json(result);
  });
  exportReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { templateId } = req.params;
      const { format = 'pdf', dateRange, filters, groupBy, sortBy } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const parsedDateRange = dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined;

      // Execute report first
      const result = await reportingService.executeReport(
        propertyId,
        templateId,
        { dateRange: parsedDateRange, filters, groupBy, sortBy },
        userId
      );

      // Get template for name
      const template = await reportingService.getTemplateById(templateId);
      const reportName = template?.name || 'Report';

      // Export
      const exportUrl = await reportingService.exportReport(result, format, reportName);

      res.json({ exportUrl, format });
  });
  // =============================================
  // SAVED REPORTS
  // =============================================

  getSavedReports = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const reports = await reportingService.getSavedReports(propertyId, userId);
      res.json({ reports });
  });
  saveReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const saved = await reportingService.saveReport(propertyId, userId, req.body);
      res.status(201).json({ report: saved });
  });
  updateSavedReport = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      const report = await reportingService.updateSavedReport(id, userId, req.body);

      if (!report) {
        res.status(404).json({ error: 'Saved report not found' });
        return;
      }

      res.json({ report });
  });
  deleteSavedReport = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      await reportingService.deleteSavedReport(id, userId);
      res.status(204).send();
  });
  // =============================================
  // KPIs
  // =============================================

  getKPIs = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate, codes } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const kpiCodes = codes ? (codes as string).split(',') : undefined;

      const kpis = await reportingService.getKPIs(propertyId, dateRange, kpiCodes);
      res.json({ kpis, dateRange });
  });
  setKPITarget = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      const { kpiCode, periodType, periodStart, periodEnd, targetValue, stretchTarget, notes } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const target = await reportingService.setKPITarget(
        propertyId,
        kpiCode,
        periodType,
        new Date(periodStart),
        new Date(periodEnd),
        targetValue,
        stretchTarget,
        notes,
        userId
      );

      res.json({ target });
  });
  // =============================================
  // FINANCIAL REPORTS
  // =============================================

  getRevenueReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const report = await reportingService.generateRevenueReport(
        propertyId,
        dateRange,
        groupBy as 'day' | 'week' | 'month'
      );

      res.json(report);
  });
  getOccupancyReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const report = await reportingService.generateOccupancyReport(propertyId, dateRange);
      res.json(report);
  });
  getChannelPerformanceReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const report = await reportingService.generateChannelPerformanceReport(propertyId, dateRange);
      res.json(report);
  });
  // =============================================
  // OPERATIONAL REPORTS
  // =============================================

  getHousekeepingReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { date } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const reportDate = date ? new Date(date as string) : new Date();
      const report = await reportingService.generateHousekeepingReport(propertyId, reportDate);
      res.json(report);
  });
  getMaintenanceReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { startDate, endDate } = req.query;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const report = await reportingService.generateMaintenanceReport(propertyId, dateRange);
      res.json(report);
  });
  // =============================================
  // SCHEDULED REPORTS
  // =============================================

  getScheduledReports = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const reports = await reportingService.getScheduledReports(propertyId);
      res.json({ reports });
  });
  createScheduledReport = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const scheduled = await reportingService.createScheduledReport(propertyId, userId!, req.body);
      res.status(201).json({ scheduled });
  });
  updateScheduledReport = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const scheduled = await reportingService.updateScheduledReport(id, req.body);

      if (!scheduled) {
        res.status(404).json({ error: 'Scheduled report not found' });
        return;
      }

      res.json({ scheduled });
  });
  deleteScheduledReport = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await reportingService.deleteScheduledReport(id);
      res.status(204).send();
  });
  runScheduledReportNow = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await reportingService.executeScheduledReport(id);
      res.json({ message: 'Report executed successfully' });
  });
  // =============================================
  // DASHBOARDS
  // =============================================

  getDashboards = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dashboards = await reportingService.getDashboards(propertyId);
      res.json({ dashboards });
  });
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const dashboard = await reportingService.getDashboardWithWidgets(id);

      if (!dashboard) {
        res.status(404).json({ error: 'Dashboard not found' });
        return;
      }

      res.json({ dashboard });
  });
  createDashboard = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      const dashboard = await reportingService.createDashboard(propertyId, req.body, userId);
      res.status(201).json({ dashboard });
  });
  addWidget = asyncHandler(async (req: Request, res: Response) => {
      const { dashboardId } = req.params;
      const widget = await reportingService.addWidget(dashboardId, req.body);
      res.status(201).json({ widget });
  });
  updateWidgetLayout = asyncHandler(async (req: Request, res: Response) => {
      const { widgetId } = req.params;
      await reportingService.updateWidgetLayout(widgetId, req.body);
      res.json({ message: 'Widget layout updated' });
  });
  deleteWidget = asyncHandler(async (req: Request, res: Response) => {
      const { widgetId } = req.params;
      await reportingService.deleteWidget(widgetId);
      res.status(204).send();
  });
  // =============================================
  // DATA SNAPSHOTS
  // =============================================

  createSnapshot = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const { date } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      await reportingService.createDailySnapshot(propertyId, date ? new Date(date) : new Date());
      res.json({ message: 'Snapshot created' });
  });
  lockMonthSnapshot = asyncHandler(async (req: Request, res: Response) => {
      const propertyId = req.headers['x-property-id'] as string;
      const userId = req.user?.id;
      if (!userId) throw new Error('Authentication required');
      const { month } = req.body;

      if (!propertyId) {
        res.status(400).json({ error: 'Property ID required' });
        return;
      }

      await reportingService.lockMonthSnapshot(propertyId, new Date(month), userId);
      res.json({ message: 'Month snapshots locked' });
  });
}

export const reportingController = new ReportingController();
