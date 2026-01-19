import { Router } from 'express';
import { loyaltyController } from './loyalty.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Public routes (for checkout integration)
router.post('/calculate', loyaltyController.calculatePoints.bind(loyaltyController));

// Customer routes (requires authentication)
router.get('/me', authenticate, loyaltyController.getMyAccount.bind(loyaltyController));
router.get('/me/transactions', authenticate, (req, res) => {
  req.params.userId = (req as any).user?.id;
  return loyaltyController.getTransactions(req, res);
});

// Settings and tiers (public read)
router.get('/settings', loyaltyController.getSettings.bind(loyaltyController));
router.get('/tiers', loyaltyController.getTiers.bind(loyaltyController));

// Admin routes
router.get('/accounts', authenticate, authorize('admin', 'super_admin'), loyaltyController.getAllAccounts.bind(loyaltyController));
router.get('/accounts/:userId', authenticate, authorize('admin', 'super_admin', 'staff'), loyaltyController.getAccount.bind(loyaltyController));
router.get('/accounts/:userId/transactions', authenticate, authorize('admin', 'super_admin', 'staff'), loyaltyController.getTransactions.bind(loyaltyController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), loyaltyController.getStats.bind(loyaltyController));

// Admin operations
router.post('/earn', authenticate, authorize('admin', 'super_admin', 'staff'), loyaltyController.earnPoints.bind(loyaltyController));
router.post('/redeem', authenticate, authorize('admin', 'super_admin', 'staff'), loyaltyController.redeemPoints.bind(loyaltyController));
router.post('/adjust', authenticate, authorize('admin', 'super_admin'), loyaltyController.adjustPoints.bind(loyaltyController));
// Route for adjusting points by account ID (matches frontend call)
router.post('/accounts/:accountId/adjust', authenticate, authorize('admin', 'super_admin'), loyaltyController.adjustPointsByAccountId.bind(loyaltyController));

// Admin settings management
router.put('/settings', authenticate, authorize('admin', 'super_admin'), loyaltyController.updateSettings.bind(loyaltyController));
router.put('/tiers/:tierId', authenticate, authorize('admin', 'super_admin'), loyaltyController.updateTier.bind(loyaltyController));

export default router;
