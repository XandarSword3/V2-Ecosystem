import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import * as modulesController from "./modules.controller";
import * as backupsController from "./backups.controller";
import * as translationsController from "./translations.controller";

import * as usersController from "./users.controller";
import * as permissionsController from "./permissions.controller";

// Import refactored controllers
import * as dashboardController from "./controllers/dashboard.controller";
import * as rolesController from "./controllers/roles.controller";
import * as settingsController from "./controllers/settings.controller";
import * as auditController from "./controllers/audit.controller";
import * as reportsController from "./controllers/reports.controller";
import * as notificationsController from "./controllers/notifications.controller";
import * as uploadController from "./controllers/upload.controller";
import * as scheduledReportsController from "./controllers/scheduled-reports.controller";
import * as deletePreviewController from "./controllers/delete-preview.controller";
import * as softDeleteController from "./controllers/soft-delete.controller";

const router = Router();

// Management roles for general admin access (excluding basic staff)
const MANAGEMENT_ROLES = [
  'restaurant_manager', 'restaurant_admin',
  'pool_admin', 
  'chalet_manager', 'chalet_admin',
  'snack_bar_admin'
];
// Helper for broad admin access (Managers or Super Admin)
const authorizeManager = authorize(...MANAGEMENT_ROLES);

// Base authentication required for all routes
router.use(authenticate);

// --- SUPER ADMIN ONLY ROUTES ---

// Modules
router.get('/modules', modulesController.getModules);
router.get('/modules/:id', modulesController.getModule);
router.post('/modules', authorize('super_admin'), modulesController.createModule);
router.put('/modules/:id', modulesController.updateModule);
router.delete('/modules/:id', modulesController.deleteModule);


// --- SHARED ADMIN/MANAGER ROUTES ---

// Dashboard
router.get('/dashboard', authorizeManager, dashboardController.getDashboard);
router.get('/dashboard/revenue', authorizeManager, dashboardController.getRevenueStats);

// Users (Enhanced)
router.get('/users', authorizeManager, usersController.getUsers); // Supports ?type=customer|staff|...
router.post('/users', authorizeManager, usersController.createUser);
router.get('/users/:id', authorizeManager, usersController.getUserDetails); // Enhanced details
router.put('/users/:id', authorizeManager, usersController.updateUser);
router.put('/users/:id/roles', authorize('super_admin'), usersController.updateUserRoles); // Role assignment is sensitive
router.delete('/users/:id', authorize('super_admin'), usersController.deleteUser);
router.put('/users/:id/permissions', authorize('super_admin'), permissionsController.updateUserPermissions); // User Override

// Roles & Permissions (using refactored controller) - SUPER ADMIN ONLY
router.get('/roles', authorize('super_admin'), rolesController.getRoles);
router.post('/roles', authorize('super_admin'), rolesController.createRole);
router.put('/roles/:id', authorize('super_admin'), rolesController.updateRole);
router.delete('/roles/:id', authorize('super_admin'), rolesController.deleteRole);
router.get('/roles/:id/permissions', authorize('super_admin'), permissionsController.getRolePermissions);
router.put('/roles/:id/permissions', authorize('super_admin'), permissionsController.updateRolePermissions);
router.get('/permissions', authorize('super_admin'), permissionsController.getAllPermissions);

// Settings (using refactored controller) - SUPER ADMIN ONLY
router.get('/settings', authorize('super_admin'), settingsController.getSettings);
router.put('/settings', authorize('super_admin'), settingsController.updateSettings);

// File Uploads (branding assets) - MANAGER
router.get('/uploads', authorizeManager, uploadController.listFiles);
router.post('/uploads', authorizeManager, rateLimits.expensive, uploadController.uploadFile);
router.delete('/uploads/:path(*)', authorizeManager, uploadController.deleteFile);
router.get('/branding', authorizeManager, uploadController.getBranding);

// Audit logs (using refactored controller) - SUPER ADMIN ONLY
router.get('/audit-logs', authorize('super_admin'), auditController.getAuditLogs);
router.get('/audit-logs/:resource', authorize('super_admin'), auditController.getAuditLogsByResource);
router.get('/audit-logs/:resource/:resourceId', authorize('super_admin'), auditController.getAuditLogsByResource);

// Backups (rate limited - expensive operations) - SUPER ADMIN ONLY
router.get('/backups', authorize('super_admin'), backupsController.getBackups);
router.post('/backups', authorize('super_admin'), rateLimits.expensive, backupsController.createBackup);
router.get('/backups/:id/download', authorize('super_admin'), backupsController.getDownloadUrl);
router.post('/backups/restore', authorize('super_admin'), rateLimits.expensive, backupsController.restoreBackup);
router.delete('/backups/:id', authorize('super_admin'), backupsController.deleteBackup);

// Reports (rate limited - expensive operations) - MANAGER
router.get('/reports/overview', authorizeManager, reportsController.getOverviewReport);
router.get('/reports/occupancy', authorizeManager, reportsController.getOccupancyReport);
router.get('/reports/customers', authorizeManager, reportsController.getCustomerAnalytics);
router.get('/reports/export', authorizeManager, rateLimits.expensive, reportsController.exportReport);

// Scheduled Reports - MANAGER
router.get('/reports/scheduled', authorizeManager, scheduledReportsController.getScheduledReports);
router.post('/reports/scheduled', authorizeManager, scheduledReportsController.createScheduledReport);
router.put('/reports/scheduled/:id', authorizeManager, scheduledReportsController.updateScheduledReport);
router.delete('/reports/scheduled/:id', authorizeManager, scheduledReportsController.deleteScheduledReport);
router.post('/reports/scheduled/:id/send', authorizeManager, rateLimits.expensive, scheduledReportsController.sendReportNow);
router.get('/reports/preview', authorizeManager, scheduledReportsController.previewReport);

// Notifications (using refactored controller) - MANAGER
router.get('/notifications', authorizeManager, notificationsController.getNotifications);
router.get('/notifications/broadcasts', authorizeManager, notificationsController.getBroadcasts);
router.get('/notifications/priorities', authorizeManager, notificationsController.getValidPriorities);
router.put('/notifications/:id/read', authorizeManager, notificationsController.markNotificationRead);
router.put('/notifications/read-all', authorizeManager, notificationsController.markAllNotificationsRead);
router.post('/notifications/broadcast', authorizeManager, notificationsController.broadcastNotification);
router.post('/notifications/delete-multiple', authorizeManager, notificationsController.deleteMultipleNotifications);
router.post('/notifications/process-scheduled', authorizeManager, rateLimits.expensive, notificationsController.processScheduledNotifications);
router.delete('/notifications/:id', authorizeManager, notificationsController.deleteNotification);

// Notification Templates - ADMIN/MANAGER
router.get('/notifications/templates', authorizeManager, notificationsController.getTemplates);
router.get('/notifications/templates/:id', authorizeManager, notificationsController.getTemplateById);
router.post('/notifications/templates', authorizeManager, notificationsController.createTemplate);
router.put('/notifications/templates/:id', authorizeManager, notificationsController.updateTemplate);
router.delete('/notifications/templates/:id', authorizeManager, notificationsController.deleteTemplate);
router.post('/notifications/templates/:id/send', authorizeManager, notificationsController.sendFromTemplate);

// Translation Management - Database Translations - MANAGER
router.get('/translations/status', authorizeManager, translationsController.getTranslationServiceStatus);
router.get('/translations/missing', authorizeManager, translationsController.getMissingTranslations);
router.get('/translations/stats', authorizeManager, translationsController.getTranslationStats);
router.put('/translations/:table/:id', authorizeManager, translationsController.updateTranslation);
router.post('/translations/auto-translate', authorizeManager, translationsController.autoTranslate);
router.post('/translations/batch-translate', authorizeManager, translationsController.batchAutoTranslate);

// Translation Management - Languages - SUPER ADMIN
router.get('/translations/languages', authorize('super_admin'), translationsController.getSupportedLanguages);
router.post('/translations/languages', authorize('super_admin'), translationsController.addLanguage);
router.put('/translations/languages/:code', authorize('super_admin'), translationsController.updateLanguage);
router.delete('/translations/languages/:code', authorize('super_admin'), translationsController.deleteLanguage);

// Frontend Translation Files Comparison - SUPER ADMIN
router.get('/translations/frontend/compare', authorize('super_admin'), translationsController.compareFrontendTranslations);
router.post('/translations/frontend/update', authorize('super_admin'), translationsController.updateFrontendTranslation);

// UI Translations (Database Backed) - Phase 2
router.get('/translations/ui', authorizeManager, translationsController.getUiTranslations);
router.post('/translations/ui', authorizeManager, translationsController.upsertUiTranslation);
router.post('/translations/ui/publish', authorize('super_admin'), translationsController.publishTranslations);

// Delete Preview - Impact Analysis - MANAGER
router.get('/delete-preview/:entityType/:entityId', authorizeManager, deletePreviewController.getDeletePreview);

// Soft Delete Management
router.get('/deleted/:entityType', authorizeManager, softDeleteController.getDeletedRecords);
router.post('/deleted/:entityType/:entityId/restore', authorizeManager, softDeleteController.restoreRecord);
router.delete('/deleted/:entityType/:entityId/permanent', authorize('super_admin'), softDeleteController.permanentDelete);
router.post('/soft-delete/:entityType/:entityId', authorizeManager, softDeleteController.softDelete);

export default router;
