import { Router } from 'express';
import { housekeepingController } from './housekeeping.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Task types (staff can view)
router.get('/task-types', authenticate, housekeepingController.getTaskTypes.bind(housekeepingController));

// Staff routes
router.get('/my-tasks', authenticate, authorize('staff', 'admin', 'super_admin'), housekeepingController.getMyTasks.bind(housekeepingController));
router.post('/tasks/:id/start', authenticate, authorize('staff', 'admin', 'super_admin'), housekeepingController.startTask.bind(housekeepingController));
router.post('/tasks/:id/complete', authenticate, authorize('staff', 'admin', 'super_admin'), housekeepingController.completeTask.bind(housekeepingController));
router.post('/tasks/:id/issue', authenticate, authorize('staff', 'admin', 'super_admin'), housekeepingController.reportIssue.bind(housekeepingController));

// Admin routes - Tasks
router.get('/tasks', authenticate, authorize('admin', 'super_admin'), housekeepingController.getTasks.bind(housekeepingController));
router.get('/tasks/:id', authenticate, authorize('admin', 'super_admin', 'staff'), housekeepingController.getTask.bind(housekeepingController));
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

export default router;
