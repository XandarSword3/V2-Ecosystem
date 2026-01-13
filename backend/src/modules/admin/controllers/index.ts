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

// Reports & Analytics
export { getOverviewReport, exportReport, getOccupancyReport, getCustomerAnalytics } from './reports.controller.js';

// Notifications
export { getNotifications, markNotificationRead, markAllNotificationsRead } from './notifications.controller.js';

// File Uploads
export { uploadFile, deleteFile, listFiles, getBranding } from './upload.controller.js';

// Scheduled Reports
export { 
  getScheduledReports, 
  createScheduledReport, 
  updateScheduledReport, 
  deleteScheduledReport, 
  sendReportNow,
  previewReport 
} from './scheduled-reports.controller.js';
