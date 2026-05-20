/**
 * Admin Controller (Legacy Monolith Redirect)
 * 
 * Redirects all legacy routes and tests to the new, modular, tenant-isolated
 * controller implementations to ensure strict property_id isolation.
 */

import * as dashboardController from './controllers/dashboard.controller.js';
import * as rolesController from './controllers/roles.controller.js';
import * as settingsController from './controllers/settings.controller.js';
import * as auditController from './controllers/audit.controller.js';
import * as notificationsController from './controllers/notifications.controller.js';
import * as reportsController from './controllers/reports.controller.js';
import * as usersController from './users.controller.js';

// Dashboard & Stats
export const getDashboard = dashboardController.getDashboard;
export const getRevenueStats = dashboardController.getRevenueStats;

// User Management
export const getUsers = usersController.getUsers;
export const createUser = usersController.createUser;
export const getUser = usersController.getUserDetails;
export const updateUser = usersController.updateUser;
export const updateUserRoles = usersController.updateUserRoles;
export const deleteUser = usersController.deleteUser;

// Role Management
export const getRoles = rolesController.getRoles;
export const createRole = rolesController.createRole;
export const updateRole = rolesController.updateRole;
export const deleteRole = rolesController.deleteRole;

// Settings
export const getSettings = settingsController.getSettings;
export const updateSettings = settingsController.updateSettings;

// Audit Logs
export const getAuditLogs = auditController.getAuditLogs;

// Reports
export const getOverviewReport = reportsController.getOverviewReport;
export const getOccupancyReport = reportsController.getOccupancyReport;
export const getCustomerAnalytics = reportsController.getCustomersReport;
export const exportReport = reportsController.exportReport;

// Notifications
export const getNotifications = notificationsController.getNotifications;
