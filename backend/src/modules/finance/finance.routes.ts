import { Router } from 'express';
import { cashController } from './cash.controller.js';
import { createExpense, getExpenses, deleteExpense, getDirectionalProfit } from './expenses.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
const financeRoles = ['admin', 'super_admin', 'manager', 'accountant'];

// Cash drawer routes
router.post('/open', authenticate, cashController.openDrawer);
router.post('/close', authenticate, cashController.closeDrawer);
router.post('/transaction', authenticate, cashController.recordTransaction);
router.get('/', authenticate, authorize(...financeRoles), cashController.getDrawers);

// Directional Financials routes (Phase 5a)
router.post('/expenses', authenticate, authorize(...financeRoles), createExpense);
router.get('/expenses', authenticate, authorize(...financeRoles), getExpenses);
router.delete('/expenses/:id', authenticate, authorize(...financeRoles), deleteExpense);
router.get('/directional-profit', authenticate, authorize(...financeRoles), getDirectionalProfit);

export default router;
