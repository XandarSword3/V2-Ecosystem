/**
 * Pool Controllers Index
 * Re-exports all pool controller functions for clean imports
 * 
 * Organized structure:
 * - sessions.controller.ts: Session CRUD and availability
 * - tickets.controller.ts: Ticket purchase, validation, cancellation
 * - admin.controller.ts: Capacity, reports, settings, maintenance
 * - bracelets.controller.ts: Bracelet assignment and tracking
 */

// Session management
export {
  getSessions,
  getSession,
  getAvailability,
  createSession,
  updateSession,
  deleteSession,
} from './sessions.controller.js';

// Ticket management
export {
  purchaseTicket,
  getTicket,
  getMyTickets,
  cancelTicket,
  validateTicket,
  recordEntry,
  recordExit,
  getTodayTickets,
} from './tickets.controller.js';

// Admin operations
export {
  getCurrentCapacity,
  getDailyReport,
  getPoolSettings,
  updatePoolSettings,
  resetOccupancy,
  getMaintenanceLogs,
  createMaintenanceLog,
} from './admin.controller.js';

// Bracelet management
export {
  assignBracelet,
  returnBracelet,
  getActiveBracelets,
  searchByBracelet,
} from './bracelets.controller.js';
