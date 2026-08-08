import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { requireModulePropertyAccess } from '../../middleware/propertyAccess.middleware.js';
import * as moduleStaffController from './module-staff.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Staff roles that can access module operations
const staffRoles = ['admin', 'super_admin', 'manager', 'staff'];

// Middleware to verify dynamic property/module access for staff members
const verifyStaffModuleAccess = (req: any, res: any, next: any) => {
  const { slug } = req.params;
  if (!slug) {
    return next();
  }
  return requireModulePropertyAccess(slug)(req, res, next);
};

// Unified scanner + staff customer lookup
router.post('/scan', authorize(...staffRoles), moduleStaffController.scanCode);
router.get('/customers/search', authorize(...staffRoles), moduleStaffController.searchCustomers);

// ============================================
// Menu Service Orders (menu-service, kiosk, etc.)
// ============================================

// Get service_locations ("tables") for a module, with derived occupancy
router.get('/modules/:slug/tables', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleTables);

// Get orders for a module (active/live orders)
router.get('/modules/:slug/orders', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleOrders);

// Get live orders (alias for real-time order view)
router.get('/modules/:slug/orders/live', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleOrders);
router.post('/modules/:slug/tables/:tableId/split', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.splitModuleTable);
router.post('/modules/:slug/tables/:tableId/merge', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.mergeModuleTables);

// Service locations / floor map actions
router.post('/modules/:slug/walk-in', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.createWalkInSeating);
router.post('/service-locations/:id/free', authorize(...staffRoles), moduleStaffController.freeServiceLocation);

// Get catalog menu items for POS order entry
router.get('/modules/:slug/menu', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleMenu);

// Create order (POS staff order entry)
router.post('/modules/:slug/orders', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.createModuleOrder);

// Add items to existing order
router.post('/modules/:slug/orders/:orderId/items', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.addModuleOrderItem);

// Process payment for order
router.post('/modules/:slug/orders/:orderId/pay', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.payModuleOrder);

// Generate receipt / print job for order
router.post('/modules/:slug/orders/:orderId/print', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.printModuleOrderReceipt);

// Update order status
router.put('/modules/:slug/orders/:orderId/status', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.updateModuleOrderStatus);
router.patch('/modules/:slug/orders/:orderId/status', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.updateModuleOrderStatus);

// Update a single item's status (item-level KDS)
router.patch('/modules/:slug/orders/:orderId/items/:itemId/status', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.updateModuleOrderItemStatus);
router.post('/modules/:slug/orders/:orderId/split', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.splitModuleOrder);


// ============================================
// Multi-Day Booking Operations (accommodation, villas, etc.)
// ============================================

// Get bookings for a module
router.get('/modules/:slug/bookings', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleBookings);

// Create a staff booking (walk-in)
router.post('/modules/:slug/bookings', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.createStaffBooking);

// Update booking status (check-in, check-out, etc.)
router.put('/modules/:slug/bookings/:bookingId/status', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.updateModuleBookingStatus);
router.patch('/modules/:slug/bookings/:bookingId/status', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.updateModuleBookingStatus);

// ============================================
// Session Access Operations (pool, spa, etc.)
// ============================================

// Get sessions for a module
router.get('/modules/:slug/sessions', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleSessions);

// Validate a ticket
router.post('/modules/:slug/validate-ticket', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.validateModuleTicket);

// Record entry for a ticket holder
router.post('/modules/:slug/entry', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.recordEntry);

// Record exit for a ticket holder
router.post('/modules/:slug/exit', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.recordExit);

// Get capacity/occupancy stats
router.get('/modules/:slug/capacity', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleCapacity);

// Get today's tickets
router.get('/modules/:slug/today-tickets', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getTodaysTickets);

// ============================================
// Maintenance Logs (for session_access modules)
// ============================================

// Get maintenance logs for a module
router.get('/modules/:slug/maintenance', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.getModuleMaintenanceLogs);

// Create a maintenance log entry
router.post('/modules/:slug/maintenance', authorize(...staffRoles), verifyStaffModuleAccess, moduleStaffController.createModuleMaintenanceLog);

export default router;
