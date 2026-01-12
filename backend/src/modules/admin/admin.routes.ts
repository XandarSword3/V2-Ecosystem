import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import * as adminController from "./admin.controller";
import * as modulesController from "./modules.controller";
import * as backupsController from "./backups.controller";
import * as translationsController from "./translations.controller";

import * as usersController from "./users.controller";
import * as permissionsController from "./permissions.controller";

// Import refactored controllers
import * as rolesController from "./controllers/roles.controller";
import * as settingsController from "./controllers/settings.controller";
import * as auditController from "./controllers/audit.controller";
import * as reportsController from "./controllers/reports.controller";
import * as notificationsController from "./controllers/notifications.controller";

const router = Router();

// All admin routes require super_admin role
router.use(authenticate);
router.use(authorize('super_admin'));

// Modules
router.get('/modules', modulesController.getModules);
router.get('/modules/:id', modulesController.getModule);
router.post('/modules', modulesController.createModule);
router.put('/modules/:id', modulesController.updateModule);
router.delete('/modules/:id', modulesController.deleteModule);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/revenue', adminController.getRevenueStats);

// Users (Enhanced)
router.get('/users', usersController.getUsers); // Supports ?type=customer|staff|...
router.post('/users', adminController.createUser);
router.get('/users/:id', usersController.getUserDetails); // Enhanced details
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/roles', adminController.updateUserRoles);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/permissions', permissionsController.updateUserPermissions); // User Override

// Roles & Permissions (using refactored controller)
router.get('/roles', rolesController.getRoles);
router.post('/roles', rolesController.createRole);
router.put('/roles/:id', rolesController.updateRole);
router.delete('/roles/:id', rolesController.deleteRole);
router.get('/roles/:id/permissions', permissionsController.getRolePermissions);
router.put('/roles/:id/permissions', permissionsController.updateRolePermissions);
router.get('/permissions', permissionsController.getAllPermissions);

// Settings (using refactored controller)
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// Audit logs (using refactored controller)
router.get('/audit-logs', auditController.getAuditLogs);
router.get('/audit-logs/:resource', auditController.getAuditLogsByResource);
router.get('/audit-logs/:resource/:resourceId', auditController.getAuditLogsByResource);

// Backups (rate limited - expensive operations)
router.get('/backups', backupsController.getBackups);
router.post('/backups', rateLimits.expensive, backupsController.createBackup);
router.get('/backups/:id/download', backupsController.getDownloadUrl);
router.post('/backups/restore', rateLimits.expensive, backupsController.restoreBackup);
router.delete('/backups/:id', backupsController.deleteBackup);

// Reports (rate limited - expensive operations)
router.get('/reports/overview', reportsController.getOverviewReport);
router.get('/reports/occupancy', reportsController.getOccupancyReport);
router.get('/reports/customers', reportsController.getCustomerAnalytics);
router.get('/reports/export', rateLimits.expensive, reportsController.exportReport);

// Notifications (using refactored controller)
router.get('/notifications', notificationsController.getNotifications);
router.put('/notifications/:id/read', notificationsController.markNotificationRead);
router.put('/notifications/read-all', notificationsController.markAllNotificationsRead);
router.post('/notifications/broadcast', notificationsController.broadcastNotification);
router.delete('/notifications/:id', notificationsController.deleteNotification);

// Translation Management - Database Translations
router.get('/translations/missing', translationsController.getMissingTranslations);
router.get('/translations/stats', translationsController.getTranslationStats);
router.put('/translations/:table/:id', translationsController.updateTranslation);
router.post('/translations/auto-translate', translationsController.autoTranslate);
router.post('/translations/batch-translate', translationsController.batchAutoTranslate);

// Translation Management - Languages
router.get('/translations/languages', translationsController.getSupportedLanguages);
router.post('/translations/languages', translationsController.addLanguage);
router.put('/translations/languages/:code', translationsController.updateLanguage);
router.delete('/translations/languages/:code', translationsController.deleteLanguage);

// Frontend Translation Files Comparison
router.get('/translations/frontend/compare', translationsController.compareFrontendTranslations);
router.post('/translations/frontend/update', translationsController.updateFrontendTranslation);

export default router;
