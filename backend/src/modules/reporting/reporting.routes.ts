/**
 * Reporting Routes
 * Phase 3.1: Advanced Reporting System
 */

import { Router } from 'express';
import { reportingController } from './reporting.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
import { createRateLimiter } from '../../middleware/api-security.middleware.js';

const router = Router();

// Rate limiter for expensive report execution endpoints
const reportRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many report execution requests',
});

// All routes require authentication and property access validation
router.use(authenticate);
router.use(validatePropertyAccess);

// =============================================
// REPORT TEMPLATES
// =============================================
router.get('/templates', reportingController.getTemplates.bind(reportingController));
router.get('/templates/:id', reportingController.getTemplate.bind(reportingController));
router.post('/templates', authorize('admin', 'manager'), reportingController.createTemplate.bind(reportingController));
router.put('/templates/:id', authorize('admin', 'manager'), reportingController.updateTemplate.bind(reportingController));
router.delete('/templates/:id', authorize('admin', 'manager'), reportingController.deleteTemplate.bind(reportingController));

// =============================================
// REPORT EXECUTION
// =============================================
router.post('/execute/:templateId', reportRateLimit, reportingController.executeReport.bind(reportingController));
router.post('/export/:templateId', reportRateLimit, reportingController.exportReport.bind(reportingController));

// =============================================
// SAVED REPORTS
// =============================================
router.get('/saved', reportingController.getSavedReports.bind(reportingController));
router.post('/saved', reportingController.saveReport.bind(reportingController));
router.put('/saved/:id', reportingController.updateSavedReport.bind(reportingController));
router.delete('/saved/:id', reportingController.deleteSavedReport.bind(reportingController));

// =============================================
// KPIs
// =============================================
router.get('/kpis', reportingController.getKPIs.bind(reportingController));
router.post('/kpis/targets', authorize('admin', 'manager'), reportingController.setKPITarget.bind(reportingController));

// =============================================
// FINANCIAL REPORTS (Pre-built)
// =============================================
router.get('/financial/revenue', reportingController.getRevenueReport.bind(reportingController));
router.get('/financial/occupancy', reportingController.getOccupancyReport.bind(reportingController));
router.get('/financial/channels', reportingController.getChannelPerformanceReport.bind(reportingController));

// =============================================
// OPERATIONAL REPORTS (Pre-built)
// =============================================
router.get('/operational/housekeeping', reportingController.getHousekeepingReport.bind(reportingController));
router.get('/operational/maintenance', reportingController.getMaintenanceReport.bind(reportingController));

// =============================================
// SCHEDULED REPORTS
// =============================================
router.get('/scheduled', reportingController.getScheduledReports.bind(reportingController));
router.post('/scheduled', authorize('admin', 'manager'), reportingController.createScheduledReport.bind(reportingController));
router.put('/scheduled/:id', authorize('admin', 'manager'), reportingController.updateScheduledReport.bind(reportingController));
router.delete('/scheduled/:id', authorize('admin', 'manager'), reportingController.deleteScheduledReport.bind(reportingController));
router.post('/scheduled/:id/run', authorize('admin', 'manager'), reportingController.runScheduledReportNow.bind(reportingController));

// =============================================
// DASHBOARDS
// =============================================
router.get('/dashboards', reportingController.getDashboards.bind(reportingController));
router.get('/dashboards/:id', reportingController.getDashboard.bind(reportingController));
router.post('/dashboards', authorize('admin', 'manager'), reportingController.createDashboard.bind(reportingController));
router.post('/dashboards/:dashboardId/widgets', authorize('admin', 'manager'), reportingController.addWidget.bind(reportingController));
router.patch('/dashboards/widgets/:widgetId/layout', authorize('admin', 'manager'), reportingController.updateWidgetLayout.bind(reportingController));
router.delete('/dashboards/widgets/:widgetId', authorize('admin', 'manager'), reportingController.deleteWidget.bind(reportingController));

// =============================================
// DATA SNAPSHOTS
// =============================================
router.post('/snapshots', authorize('admin'), reportingController.createSnapshot.bind(reportingController));
router.post('/snapshots/lock-month', authorize('admin'), reportingController.lockMonthSnapshot.bind(reportingController));

export { router as reportingRoutes };

