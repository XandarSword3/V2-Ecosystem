import { Router } from 'express';
import { giftCardController } from './giftcard.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.get('/templates', giftCardController.getTemplates.bind(giftCardController));
router.get('/check/:code', giftCardController.checkBalance.bind(giftCardController));

// Customer routes
router.post('/purchase', authenticate, giftCardController.purchaseGiftCard.bind(giftCardController));
router.get('/my', authenticate, giftCardController.getMyGiftCards.bind(giftCardController));

// Checkout integration (requires auth for tracking)
router.post('/redeem', authenticate, giftCardController.redeemGiftCard.bind(giftCardController));

// Admin routes - both with and without /admin prefix for frontend compatibility
router.get('/', authenticate, authorize('admin', 'super_admin'), giftCardController.getAllGiftCards.bind(giftCardController));
router.get('/admin', authenticate, authorize('admin', 'super_admin'), giftCardController.getAllGiftCards.bind(giftCardController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), giftCardController.getStats.bind(giftCardController));
router.get('/admin/stats', authenticate, authorize('admin', 'super_admin'), giftCardController.getStats.bind(giftCardController));
router.get('/:id', authenticate, authorize('admin', 'super_admin'), giftCardController.getGiftCard.bind(giftCardController));
router.post('/', authenticate, authorize('admin', 'super_admin'), giftCardController.createGiftCard.bind(giftCardController));
router.post('/admin', authenticate, authorize('admin', 'super_admin'), giftCardController.createGiftCard.bind(giftCardController));
router.put('/:id/disable', authenticate, authorize('admin', 'super_admin'), giftCardController.disableGiftCard.bind(giftCardController));
router.put('/admin/:id/disable', authenticate, authorize('admin', 'super_admin'), giftCardController.disableGiftCard.bind(giftCardController));

// Template management (admin)
router.post('/templates', authenticate, authorize('admin', 'super_admin'), giftCardController.createTemplate.bind(giftCardController));
router.put('/templates/:id', authenticate, authorize('admin', 'super_admin'), giftCardController.updateTemplate.bind(giftCardController));

export default router;
