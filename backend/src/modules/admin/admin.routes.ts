import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { rateLimits, userRateLimit } from "../../middleware/userRateLimit.middleware.js";
import * as modulesController from "./modules.controller";
import * as backupsController from "./backups.controller";
import * as translationsController from "./translations.controller";

import * as usersController from "./users.controller";
import * as permissionsController from "./permissions.controller";

// Import refactored controllers
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
import * as moduleTemplatesController from "./controllers/module-templates.controller.js";
import * as plansController from "./controllers/plans.controller.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { getSupabase } from "../../database/connection.js";

// NOTE: dashboardController import intentionally removed — /admin/dashboard routes were
// deleted as part of Issue 3 fix. The frontend /admin page now redirects to /admin/modules.
// Revenue data is available through the /admin/reports endpoints (dynamic module aggregation, Issue 13/26).

const router = Router();

// Management roles for general admin access (excluding basic staff)
// Per-module roles eliminated by the engine refit. All admin access now flows through 'admin' and 'manager'.
const MANAGEMENT_ROLES = [
  'admin', 'manager',
];
// Helper for broad admin access (Managers or Super Admin)
const authorizeManager = authorize(...MANAGEMENT_ROLES);

// Base authentication required for all routes
router.use(authenticate);
router.use(validatePropertyAccess);

// --- CURRENCIES (Issue 11 — live currency list from DB, no hardcoding on frontend) ---
// Returns all active currencies from the currencies table.
// Used by the Properties page currency selectors and anywhere else a currency dropdown is needed.
router.get('/currencies', asyncHandler(async (req, res) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('currencies')
    .select('code, symbol, name, is_default')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('code', { ascending: true });

  if (error) throw error;

  res.json({ success: true, data: data ?? [] });
}));

// --- SUPER ADMIN ONLY ROUTES ---
// NOTE: 'super_admin' here means the actual platform operator only
// (is_platform_root tenant). Tenant owners get the separate 'tenant_owner'
// role (see provisioning.service.ts) — do NOT add it to the platform-global
// routes below (Plans, Backups, Translation languages/filesystem). Those
// touch the whole platform / filesystem, not just one tenant's data.

// Modules
router.get('/modules', modulesController.getModules);
router.get('/modules/:id', modulesController.getModule);
router.post('/modules', authorize('admin', 'super_admin', 'tenant_owner'), modulesController.createModule);
router.put('/modules/:id', modulesController.updateModule);
router.delete('/modules/:id', modulesController.deleteModule);

// Module Templates (read-only — official templates are seeded via migrations)
router.get('/module-templates', moduleTemplatesController.getModuleTemplates);
router.get('/module-templates/:id', moduleTemplatesController.getModuleTemplate);

// Plans — platform-level subscription plans, fully editable by the platform
// operator ONLY. Deliberately excludes 'tenant_owner' — a tenant owner must
// never be able to edit the platform's global Stripe billing plans.
router.get('/plans', authorize('super_admin'), plansController.getPlans);
router.get('/plans/:id', authorize('super_admin'), plansController.getPlan);
router.post('/plans', authorize('super_admin'), plansController.createPlan);
router.put('/plans/:id', authorize('super_admin'), plansController.updatePlan);
router.delete('/plans/:id', authorize('super_admin'), plansController.deletePlan);

// --- SHARED ADMIN/MANAGER ROUTES ---

// Dashboard routes removed — /admin page redirects to /admin/modules (see Issue 3 in CONTEXT.md)

// Users (Enhanced)
router.get('/users', authorizeManager, usersController.getUsers); // Supports ?type=customer|staff|...
router.post('/users', authorizeManager, usersController.createUser);
router.get('/users/:id', authorizeManager, usersController.getUserDetails); // Enhanced details
router.put('/users/:id', authorizeManager, usersController.updateUser);
router.put('/users/:id/roles', authorize('admin', 'super_admin', 'tenant_owner'), usersController.assignUserRoles); // Role assignment is sensitive
router.delete('/users/:id', authorize('super_admin', 'tenant_owner'), usersController.deleteUser);
router.put('/users/:id/permissions', authorize('super_admin', 'tenant_owner'), permissionsController.updateUserPermissions); // User Override
router.post('/users/:id/revoke-sessions', authorize('admin', 'super_admin', 'tenant_owner'), usersController.revokeUserSessions); // Force logout a compromised account

// Roles & Permissions (using refactored controller) - TENANT OWNER (or platform super_admin)
// tenant_owner is scoped to this tenant's own roles table (tenant_id FK) — not platform-global.
router.get('/roles', authorize('super_admin', 'tenant_owner'), rolesController.getRoles);
router.post('/roles', authorize('super_admin', 'tenant_owner'), rolesController.createRole);
router.put('/roles/:id', authorize('super_admin', 'tenant_owner'), rolesController.updateRole);
router.delete('/roles/:id', authorize('super_admin', 'tenant_owner'), rolesController.deleteRole);
router.get('/roles/:id/permissions', authorize('super_admin', 'tenant_owner'), permissionsController.getRolePermissions);
router.put('/roles/:id/permissions', authorize('super_admin', 'tenant_owner'), permissionsController.updateRolePermissions);
router.get('/permissions', authorize('super_admin', 'tenant_owner'), permissionsController.getAllPermissions);

// Settings (using refactored controller) - ADMIN and SUPER ADMIN
router.get('/settings', authorize('admin'), settingsController.getSettings);
router.put('/settings', authorize('admin'), settingsController.updateSettings);

// FIX: Iteration 26 - Dedicated homepage settings endpoint (frontend calls /admin/settings/homepage which 404'd)
router.get('/settings/homepage', authorize('admin'), settingsController.getHomepageSettings);
router.put('/settings/homepage', authorize('admin'), settingsController.updateHomepageSettings);

// Tax settings
router.get('/settings/tax', authorize('admin'), settingsController.getTaxSettings);
router.put('/settings/tax', authorize('admin'), settingsController.updateTaxSettings);

// File Uploads - MANAGER
router.get('/uploads', authorizeManager, uploadController.listFiles);
router.post('/uploads', authorizeManager, rateLimits.expensive, uploadController.uploadFile);
router.delete('/uploads/:path(*)', authorizeManager, uploadController.deleteFile);

// Branding — section-based PATCH with JSONB merge (property-scoped)
import brandingRoutes from './branding.controller.js';
router.use('/branding', brandingRoutes);

// Audit logs (using refactored controller) - ADMIN + SUPER ADMIN
router.get('/audit-logs', authorize('admin', 'super_admin'), auditController.getAuditLogs);
router.get('/audit-logs/:resource', authorize('admin', 'super_admin'), auditController.getAuditLogsByResource);
router.get('/audit-logs/:resource/:resourceId', authorize('admin', 'super_admin'), auditController.getAuditLogsByResource);

// Backups (rate limited - expensive operations) - PLATFORM OPERATOR ONLY.
// backups.controller.ts / BackupService have NO tenant scoping whatsoever —
// this is a whole-database backup/restore. 'tenant_owner' must never be
// added here; a tenant owner restoring an arbitrary backup would overwrite
// every other tenant's data.
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

// Translation Management - Languages - PLATFORM OPERATOR ONLY (supported
// locales are a platform-wide list, not per-tenant; do NOT add tenant_owner)
router.get('/translations/languages', authorize('super_admin'), translationsController.getSupportedLanguages);
router.post('/translations/languages', authorize('super_admin'), translationsController.addLanguage);
router.put('/translations/languages/:code', authorize('super_admin'), translationsController.updateLanguage);
router.delete('/translations/languages/:code', authorize('super_admin'), translationsController.deleteLanguage);

// Frontend Translation Files Comparison - PLATFORM OPERATOR ONLY (reads/writes
// files on the server's filesystem; do NOT add tenant_owner)
// SECURITY: Rate-limited — these endpoints perform file system operations
const frontendTranslationRateLimit = userRateLimit({ windowMs: 60 * 1000, maxRequests: 20, keyPrefix: 'translation-fs:', message: 'Too many translation file requests. Please wait.' });
router.get('/translations/frontend/compare', authorize('super_admin'), frontendTranslationRateLimit, translationsController.compareFrontendTranslations);
router.post('/translations/frontend/update', authorize('super_admin'), frontendTranslationRateLimit, translationsController.updateFrontendTranslation);

// UI Translations (Database Backed) - Phase 2
router.get('/translations/ui', authorizeManager, translationsController.getUiTranslations);
router.post('/translations/ui', authorizeManager, translationsController.upsertUiTranslation);
router.post('/translations/ui/publish', authorize('super_admin'), translationsController.publishTranslations); // TODO(Xandar): confirm whether this is tenant-scoped or platform-wide — left super_admin-only pending your call, see chat

// Delete Preview - Impact Analysis - MANAGER
router.get('/delete-preview/:entityType/:entityId', authorizeManager, deletePreviewController.getDeletePreview);

// Pricing Management - SUPER ADMIN
router.use('/pricing', pricingRoutes);

// Soft Delete Management
router.get('/deleted/:entityType', authorizeManager, softDeleteController.getDeletedRecords);
router.post('/deleted/:entityType/:entityId/restore', authorizeManager, softDeleteController.restoreRecord);
router.delete('/deleted/:entityType/:entityId/permanent', authorize('super_admin', 'tenant_owner'), softDeleteController.permanentDelete);
router.post('/soft-delete/:entityType/:entityId', authorizeManager, softDeleteController.softDelete);

// Onboarding Wizard Setup
router.get('/onboarding', authorize('admin'), onboardingController.getOnboardingState);
router.put('/onboarding', authorize('admin'), onboardingController.updateOnboardingState);
router.post('/onboarding/verify-stripe', authorize('admin'), onboardingController.verifyStripe);
router.post('/onboarding/test-email', authorize('admin'), onboardingController.testEmail);
router.post('/onboarding/finalize', authorize('admin'), onboardingController.finalizeOnboarding); // super_admin is created by install; admin is the minimum valid role
router.get('/onboarding/manual', authorize('admin'), onboardingController.getOperationsManual);

// CSV Bulk Imports
router.post('/import/catalog-items', authorizeManager, importController.importCatalogItems);
router.post('/import/units', authorizeManager, importController.importUnits);
router.post('/import/inventory', authorizeManager, importController.importInventory);

export default router;
