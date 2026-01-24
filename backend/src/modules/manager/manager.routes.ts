import { Router } from 'express';
import { approvalsController } from './approvals.controller.js';
import { shiftsController } from './shifts.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============== APPROVALS ==============
// Staff can create approval requests
router.post('/approvals', approvalsController.createApproval.bind(approvalsController));

// Managers can view and review approvals
router.get(
  '/approvals/pending',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  approvalsController.getPendingApprovals.bind(approvalsController)
);

router.get(
  '/approvals',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  approvalsController.getApprovals.bind(approvalsController)
);

router.get(
  '/approvals/stats',
  authorize('admin', 'super_admin', 'manager'),
  approvalsController.getApprovalStats.bind(approvalsController)
);

router.put(
  '/approvals/:id/review',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  approvalsController.reviewApproval.bind(approvalsController)
);

// ============== SHIFTS ==============
// Staff can view their own shifts and clock in/out
router.get('/shifts/my', shiftsController.getMyShifts.bind(shiftsController));
router.get('/shifts/current', shiftsController.getCurrentShift.bind(shiftsController));
router.post('/shifts/:id/clock-in', shiftsController.clockIn.bind(shiftsController));
router.post('/shifts/:id/clock-out', shiftsController.clockOut.bind(shiftsController));

// Managers can manage all shifts
router.get(
  '/shifts',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  shiftsController.getShifts.bind(shiftsController)
);

router.get(
  '/shifts/today',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  shiftsController.getTodaySchedule.bind(shiftsController)
);

router.post(
  '/shifts',
  authorize('admin', 'super_admin', 'manager'),
  shiftsController.createShift.bind(shiftsController)
);

router.put(
  '/shifts/:id',
  authorize('admin', 'super_admin', 'manager'),
  shiftsController.updateShift.bind(shiftsController)
);

router.delete(
  '/shifts/:id',
  authorize('admin', 'super_admin', 'manager'),
  shiftsController.deleteShift.bind(shiftsController)
);

export default router;
