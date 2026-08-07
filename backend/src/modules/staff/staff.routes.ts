import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as staffController from './staff.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Staff roles
const adminRoles = ['admin', 'super_admin'];
const managerRoles = ['admin', 'super_admin', 'manager'];
const staffRoles = ['admin', 'super_admin', 'manager', 'staff'];

// ============================================
// Staff Shifts Management
// ============================================

// Get my shifts (any staff)
router.get('/shifts/me', staffController.getMyShifts);

// Current shift for the calling staff member (ported from /manager/shifts/current)
router.get('/shifts/me/current', staffController.getCurrentShift);

// Today's schedule + summary, manager-only (ported from /manager/shifts/today)
router.get('/shifts/today', authorize(...managerRoles), staffController.getTodaySchedule);

// Cash-drawer close and pay-in/pay-out (StaffPOSTemplate shift/drawer tab)
router.post('/shifts/:id/close', authorize(...staffRoles), staffController.closeShift);
router.post('/shifts/:id/cash', authorize(...staffRoles), staffController.recordCashMovement);

// Get all shifts (managers/admins)
router.get('/shifts', authorize(...managerRoles), staffController.getAllShifts);

// Get shifts by staff member
router.get('/shifts/staff/:staffId', authorize(...managerRoles), staffController.getStaffShifts);

// Create a shift (managers/admins)
router.post('/shifts', authorize(...managerRoles), staffController.createShift);

// Update a shift
router.put('/shifts/:id', authorize(...managerRoles), staffController.updateShift);

// Delete a shift
router.delete('/shifts/:id', authorize(...managerRoles), staffController.deleteShift);

// Clock in/out
router.post('/shifts/:id/clock-in', authorize(...staffRoles), staffController.clockIn);
router.post('/shifts/:id/clock-out', authorize(...staffRoles), staffController.clockOut);

// ============================================
// Staff Assignments
// ============================================

// Get staff assignments for a department/area
router.get('/assignments', authorize(...managerRoles), staffController.getAssignments);

// Get my current assignment
router.get('/assignments/me', staffController.getMyAssignment);

// Assign staff to area/task (managers/admins)
router.put('/staff/:staffId/assignments', authorize(...managerRoles), staffController.updateStaffAssignments);

// Bulk assign staff
router.post('/assignments/bulk', authorize(...managerRoles), staffController.bulkAssignStaff);

// ============================================
// Shift Swap Workflow
// ============================================

// Request shift swap (any staff)
router.post('/shifts/swap', authorize(...staffRoles), staffController.requestShiftSwap);

// Get my swap requests
router.get('/shifts/swap/me', staffController.getMySwapRequests);

// Get all swap requests (managers)
router.get('/shifts/swap', authorize(...managerRoles), staffController.getAllSwapRequests);

// Accept/decline a swap request (targeted staff)
router.put('/shifts/swap/:id/respond', authorize(...staffRoles), staffController.respondToSwapRequest);

// Approve/reject a swap request (managers only)
router.put('/shifts/swap/:id/approve', authorize(...managerRoles), staffController.approveSwapRequest);

// Cancel a swap request (requester only)
router.delete('/shifts/swap/:id', authorize(...staffRoles), staffController.cancelSwapRequest);

// ============================================
// Time Tracking & Reports
// ============================================

// Unified staff scanner endpoint
router.post('/scan', authorize(...staffRoles), staffController.scanCode);
router.get('/customers/search', authorize(...staffRoles), staffController.searchCustomers);

// Live transactions endpoint for staff dashboard
router.get('/transactions/live', authorize(...staffRoles), staffController.getLiveTransactions);

// Get time tracking report
router.get('/time-tracking', authorize(...managerRoles), staffController.getTimeTrackingReport);

// Add time adjustment
router.post('/shifts/:shiftId/adjustments', authorize(...managerRoles), staffController.addTimeAdjustment);

export default router;
