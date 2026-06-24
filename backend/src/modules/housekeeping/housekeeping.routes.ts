import { Router } from 'express';
import { housekeepingController } from './housekeeping.controller.js';
import { housekeepingAdvancedController } from './housekeeping-advanced.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import housekeepingImportRoutes from './housekeeping-import.routes.js';

const router = Router();

const staffAuth = [authenticate, authorize('staff', 'housekeeping_staff', 'admin', 'super_admin')] as const;
const adminAuth = [authenticate, authorize('admin', 'super_admin')] as const;

// Task types (staff can view)
router.get('/task-types', authenticate, housekeepingController.getTaskTypes.bind(housekeepingController));

// Staff routes
router.get('/my-tasks', authenticate, authorize('staff', 'housekeeping_staff', 'admin', 'super_admin'), housekeepingController.getMyTasks.bind(housekeepingController));
router.post('/tasks/:id/start', authenticate, authorize('staff', 'housekeeping_staff', 'admin', 'super_admin'), housekeepingController.startTask.bind(housekeepingController));
router.post('/tasks/:id/complete', authenticate, authorize('staff', 'housekeeping_staff', 'admin', 'super_admin'), housekeepingController.completeTask.bind(housekeepingController));
router.post('/tasks/:id/issue', authenticate, authorize('staff', 'housekeeping_staff', 'admin', 'super_admin'), housekeepingController.reportIssue.bind(housekeepingController));

// Admin routes - Tasks
router.get('/tasks', authenticate, authorize('admin', 'super_admin'), housekeepingController.getTasks.bind(housekeepingController));
router.get('/tasks/:id', authenticate, authorize('admin', 'super_admin', 'staff', 'housekeeping_staff'), housekeepingController.getTask.bind(housekeepingController));
router.post('/tasks', authenticate, authorize('admin', 'super_admin'), housekeepingController.createTask.bind(housekeepingController));
router.put('/tasks/:id', authenticate, authorize('admin', 'super_admin'), housekeepingController.updateTask.bind(housekeepingController));
router.post('/tasks/:id/assign', authenticate, authorize('admin', 'super_admin'), housekeepingController.assignTask.bind(housekeepingController));

// Admin routes - Schedules
router.get('/schedules', authenticate, authorize('admin', 'super_admin'), housekeepingController.getSchedules.bind(housekeepingController));
router.post('/schedules', authenticate, authorize('admin', 'super_admin'), housekeepingController.createSchedule.bind(housekeepingController));
router.put('/schedules/:id', authenticate, authorize('admin', 'super_admin'), housekeepingController.updateSchedule.bind(housekeepingController));
router.delete('/schedules/:id', authenticate, authorize('admin', 'super_admin'), housekeepingController.deleteSchedule.bind(housekeepingController));

// Admin routes - Staff & Stats
router.get('/staff', authenticate, authorize('admin', 'super_admin'), housekeepingController.getAvailableStaff.bind(housekeepingController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), housekeepingController.getStats.bind(housekeepingController));

// Cron endpoint (should be protected by secret key in production)
router.post('/generate-scheduled', authenticate, authorize('admin', 'super_admin'), housekeepingController.generateScheduledTasks.bind(housekeepingController));

// ── Advanced: SLA Configuration ──
router.get('/sla-config', ...adminAuth, housekeepingAdvancedController.getSLAConfig.bind(housekeepingAdvancedController));
router.put('/sla-config', ...adminAuth, housekeepingAdvancedController.updateSLAConfig.bind(housekeepingAdvancedController));

// ── Advanced: Inspections ──
router.post('/tasks/:id/inspect', ...adminAuth, housekeepingAdvancedController.submitInspection.bind(housekeepingAdvancedController));
router.post('/inspections/:id/override', ...adminAuth, housekeepingAdvancedController.overrideInspection.bind(housekeepingAdvancedController));

// ── Advanced: Unit Management ──
router.get('/check-in/:unitId', ...staffAuth, housekeepingAdvancedController.canCheckIn.bind(housekeepingAdvancedController));
router.post('/units/:unitId/block', ...adminAuth, housekeepingAdvancedController.blockUnit.bind(housekeepingAdvancedController));
router.post('/units/:unitId/unblock', ...adminAuth, housekeepingAdvancedController.unblockUnit.bind(housekeepingAdvancedController));

// ── Advanced: Reports & Room States ──
router.get('/sla-report', ...adminAuth, housekeepingAdvancedController.getSLAReport.bind(housekeepingAdvancedController));
router.get('/room-states', ...staffAuth, housekeepingAdvancedController.getRoomStates.bind(housekeepingAdvancedController));

// ── Advanced: Checkout & Supplies ──
router.post('/units/:unitId/checkout-clean', ...adminAuth, housekeepingAdvancedController.triggerCheckoutClean.bind(housekeepingAdvancedController));
router.get('/tasks/:taskId/supplies', ...staffAuth, housekeepingAdvancedController.getTaskSupplies.bind(housekeepingAdvancedController));
router.put('/tasks/:taskId/supplies', ...adminAuth, housekeepingAdvancedController.configureTaskSupplies.bind(housekeepingAdvancedController));

// ── Advanced: Dashboard & Workload ──
router.get('/room-readiness', ...adminAuth, housekeepingAdvancedController.getRoomReadinessDashboard.bind(housekeepingAdvancedController));
router.get('/staff-workload', ...adminAuth, housekeepingAdvancedController.getStaffWorkload.bind(housekeepingAdvancedController));
router.post('/auto-assign', ...adminAuth, housekeepingAdvancedController.autoAssignTasks.bind(housekeepingAdvancedController));

// Import routes
router.use('/import', housekeepingImportRoutes);

export default router;
