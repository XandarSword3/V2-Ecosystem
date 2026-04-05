/**
 * Admin Controllers Index
 * 
 * Re-exports all admin controller functions from their respective modules.
 * This allows for a clean import pattern while keeping the codebase modular.
 */

// Dashboard & Analytics
export { getDashboard, getRevenueStats } from './dashboard.controller.js';

// Roles Management
export { getRoles, createRole, updateRole, deleteRole } from './roles.controller.js';

// Settings Management
export { getSettings, updateSettings } from './settings.controller.js';

// Audit Logs
export { getAuditLogs, getAuditLogsByResource } from './audit.controller.js';

// Notifications
export { getNotifications, markNotificationRead, markAllNotificationsRead, getBroadcasts, getValidPriorities, broadcastNotification, deleteMultipleNotifications, processScheduledNotifications, deleteNotification, getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate, sendFromTemplate } from './notifications.controller.js';

// File Uploads
export { uploadFile, deleteFile, listFiles, getBranding } from './upload.controller.js';
