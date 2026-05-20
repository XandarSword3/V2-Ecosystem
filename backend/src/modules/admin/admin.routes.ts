import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { rateLimits, userRateLimit } from "../../middleware/userRateLimit.middleware.js";
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
import * as notificationsController from "./controllers/notifications.controller";
import * as uploadController from "./controllers/upload.controller";
import * as deletePreviewController from "./controllers/delete-preview.controller";
import pricingRoutes from "./pricing.controller";
import * as softDeleteController from "./controllers/soft-delete.controller";
import * as reportsController from "./controllers/reports.controller";
import { validatePropertyAccess } from "../../middleware/propertyAccess.middleware.js";
import * as onboardingController from "./controllers/onboarding.controller.js";
import * as importController from "./controllers/import.controller.js";

const router = Router();

// Management roles for general admin access (excluding basic staff)
const MANAGEMENT_ROLES = [
  'admin', 'manager',
  'restaurant_manager', 'restaurant_admin',
  'pool_admin',
  'chalet_manager', 'chalet_admin',
  'snack_bar_admin'
];
// Helper for broad admin access (Managers or Super Admin)
const authorizeManager = authorize(...MANAGEMENT_ROLES);

// Base authentication required for all routes
router.use(authenticate);
router.use(validatePropertyAccess);

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
router.put('/users/:id/roles', authorize('admin', 'super_admin'), usersController.updateUserRoles); // Role assignment is sensitive
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

// Settings (using refactored controller) - ADMIN and SUPER ADMIN
router.get('/settings', authorize('admin'), settingsController.getSettings);
router.put('/settings', authorize('admin'), settingsController.updateSettings);

// FIX: Iteration 26 - Dedicated homepage settings endpoint (frontend calls /admin/settings/homepage which 404'd)
router.get('/settings/homepage', authorize('admin'), settingsController.getHomepageSettings);
router.put('/settings/homepage', authorize('admin'), settingsController.updateHomepageSettings);

// Tax settings
router.get('/settings/tax', authorize('admin'), settingsController.getTaxSettings);
router.put('/settings/tax', authorize('admin'), settingsController.updateTaxSettings);

// File Uploads (branding assets) - MANAGER
router.get('/uploads', authorizeManager, uploadController.listFiles);
router.post('/uploads', authorizeManager, rateLimits.expensive, uploadController.uploadFile);
router.delete('/uploads/:path(*)', authorizeManager, uploadController.deleteFile);
router.get('/branding', authorizeManager, uploadController.getBranding);

// Audit logs (using refactored controller) - ADMIN + SUPER ADMIN
router.get('/audit-logs', authorize('admin', 'super_admin'), auditController.getAuditLogs);
router.get('/audit-logs/:resource', authorize('admin', 'super_admin'), auditController.getAuditLogsByResource);
router.get('/audit-logs/:resource/:resourceId', authorize('admin', 'super_admin'), auditController.getAuditLogsByResource);

// Backups (rate limited - expensive operations) - SUPER ADMIN ONLY
router.get('/backups', authorize('super_admin'), backupsController.getBackups);
router.post('/backups', authorize('super_admin'), rateLimits.expensive, backupsController.createBackup);
router.get('/backups/:id/download', authorize('super_admin'), backupsController.getDownloadUrl);
router.post('/backups/restore', authorize('super_admin'), rateLimits.expensive, backupsController.restoreBackup);
router.delete('/backups/:id', authorize('super_admin'), backupsController.deleteBackup);

// Legacy Reports and Scheduled Reports endpoints removed in favor of Unified Reporting Module

// Admin Reports (dashboard-friendly endpoints)
router.get('/reports/overview', authorizeManager, reportsController.getOverviewReport);
router.get('/reports/occupancy', authorizeManager, reportsController.getOccupancyReport);
router.get('/reports/customers', authorizeManager, reportsController.getCustomersReport);
router.get('/reports/export', authorizeManager, reportsController.exportReport);

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
// SECURITY: Rate-limited — these endpoints perform file system operations
const frontendTranslationRateLimit = userRateLimit({ windowMs: 60 * 1000, maxRequests: 20, keyPrefix: 'translation-fs:', message: 'Too many translation file requests. Please wait.' });
router.get('/translations/frontend/compare', authorize('super_admin'), frontendTranslationRateLimit, translationsController.compareFrontendTranslations);
router.post('/translations/frontend/update', authorize('super_admin'), frontendTranslationRateLimit, translationsController.updateFrontendTranslation);

// UI Translations (Database Backed) - Phase 2
router.get('/translations/ui', authorizeManager, translationsController.getUiTranslations);
router.post('/translations/ui', authorizeManager, translationsController.upsertUiTranslation);
router.post('/translations/ui/publish', authorize('super_admin'), translationsController.publishTranslations);

// Delete Preview - Impact Analysis - MANAGER
router.get('/delete-preview/:entityType/:entityId', authorizeManager, deletePreviewController.getDeletePreview);

// Pricing Management - SUPER ADMIN
router.use('/pricing', pricingRoutes);

// Soft Delete Management
router.get('/deleted/:entityType', authorizeManager, softDeleteController.getDeletedRecords);
router.post('/deleted/:entityType/:entityId/restore', authorizeManager, softDeleteController.restoreRecord);
router.delete('/deleted/:entityType/:entityId/permanent', authorize('super_admin'), softDeleteController.permanentDelete);
router.post('/soft-delete/:entityType/:entityId', authorizeManager, softDeleteController.softDelete);

// Onboarding Wizard Setup
router.get('/onboarding', onboardingController.getOnboardingState);
router.put('/onboarding', onboardingController.updateOnboardingState);
router.post('/onboarding/verify-stripe', onboardingController.verifyStripe);
router.post('/onboarding/test-email', onboardingController.testEmail);
router.post('/onboarding/finalize', onboardingController.finalizeOnboarding);
router.get('/onboarding/manual', onboardingController.getOperationsManual);

// CSV Bulk Imports
router.post('/import/menu', authorizeManager, importController.importMenuItems);
router.post('/import/accommodations', authorizeManager, importController.importAccommodations);
router.post('/import/inventory', authorizeManager, importController.importInventory);

export default router;
