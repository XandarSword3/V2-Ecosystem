import { Router } from 'express';
import { approvalsController } from './approvals.controller.js';
import { getManagerSummary } from './manager-summary.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess } from '../../middleware/propertyAccess.middleware.js';

const router = Router();

// All routes require authentication and property validation
router.use(authenticate);
router.use(validatePropertyAccess);

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

// ============== SUMMARY ==============
// Cross-module today's-activity summary for the manager dashboard.
// NOTE: /shifts/* routes formerly lived here (shifts.controller.ts) and were
// removed 2026-08-07 -- /staff/shifts/* is now the single canonical shift
// system (it already had the richer swap-request + adjustments workflow).
// The old controller is archived at modules/manager/_archived/shifts.controller.ts.
router.get(
  '/summary',
  authorize('admin', 'super_admin', 'manager', 'restaurant_manager', 'chalet_manager', 'pool_manager'),
  getManagerSummary
);

export default router;
