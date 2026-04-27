import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as moduleStaffController from './module-staff.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Staff roles that can access module operations
const staffRoles = ['admin', 'super_admin', 'manager', 'hotel_staff', 'restaurant_staff', 'pool_staff', 'housekeeping'];

// Unified scanner + staff customer lookup
router.post('/scan', authorize(...staffRoles), moduleStaffController.scanCode);
router.get('/customers/search', authorize(...staffRoles), moduleStaffController.searchCustomers);

// ============================================
// Menu Service Orders (restaurant, snack-bar, etc.)
// ============================================

// Get orders for a module (active/live orders)
router.get('/modules/:slug/orders', authorize(...staffRoles), moduleStaffController.getModuleOrders);

// Get live orders (alias for real-time order view)
router.get('/modules/:slug/orders/live', authorize(...staffRoles), moduleStaffController.getModuleOrders);
router.post('/modules/:slug/tables/:tableId/split', authorize(...staffRoles), moduleStaffController.splitModuleTable);
router.post('/modules/:slug/tables/:tableId/merge', authorize(...staffRoles), moduleStaffController.mergeModuleTables);

// Update order status
router.put('/modules/:slug/orders/:orderId/status', authorize(...staffRoles), moduleStaffController.updateModuleOrderStatus);
router.patch('/modules/:slug/orders/:orderId/status', authorize(...staffRoles), moduleStaffController.updateModuleOrderStatus);

// ============================================
// Multi-Day Booking Operations (chalets, villas, etc.)
// ============================================

// Get bookings for a module
router.get('/modules/:slug/bookings', authorize(...staffRoles), moduleStaffController.getModuleBookings);

// Update booking status (check-in, check-out, etc.)
router.put('/modules/:slug/bookings/:bookingId/status', authorize(...staffRoles), moduleStaffController.updateModuleBookingStatus);
router.patch('/modules/:slug/bookings/:bookingId/status', authorize(...staffRoles), moduleStaffController.updateModuleBookingStatus);

// ============================================
// Session Access Operations (pool, spa, etc.)
// ============================================

// Get sessions for a module
router.get('/modules/:slug/sessions', authorize(...staffRoles), moduleStaffController.getModuleSessions);

// Validate a ticket
router.post('/modules/:slug/validate-ticket', authorize(...staffRoles), moduleStaffController.validateModuleTicket);

// Record entry for a ticket holder
router.post('/modules/:slug/entry', authorize(...staffRoles), moduleStaffController.recordEntry);

// Record exit for a ticket holder
router.post('/modules/:slug/exit', authorize(...staffRoles), moduleStaffController.recordExit);

// Get capacity/occupancy stats
router.get('/modules/:slug/capacity', authorize(...staffRoles), moduleStaffController.getModuleCapacity);

// Get today's tickets
router.get('/modules/:slug/today-tickets', authorize(...staffRoles), moduleStaffController.getTodaysTickets);

// ============================================
// Maintenance Logs (for session_access modules)
// ============================================

// Get maintenance logs for a module
router.get('/modules/:slug/maintenance', authorize(...staffRoles), moduleStaffController.getModuleMaintenanceLogs);

// Create a maintenance log entry
router.post('/modules/:slug/maintenance', authorize(...staffRoles), moduleStaffController.createModuleMaintenanceLog);

export default router;
