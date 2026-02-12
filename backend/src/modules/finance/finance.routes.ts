import { Router } from 'express';
import { cashController } from './cash.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
const financeRoles = ['admin', 'super_admin', 'manager', 'accountant'];

router.post('/open', authenticate, cashController.openDrawer);
router.post('/close', authenticate, cashController.closeDrawer);
router.post('/transaction', authenticate, cashController.recordTransaction);
router.get('/', authenticate, authorize(...financeRoles), cashController.getDrawers);

export default router;
