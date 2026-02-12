import { Router } from 'express';
import { promotionsController } from './promotions.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

const staffAuth = [authenticate, authorize('staff', 'admin', 'super_admin')];
const adminAuth = [authenticate, authorize('admin', 'super_admin')];

// ============================================
// Coupons
// ============================================
router.post('/coupons/apply', authenticate, promotionsController.applyCoupon.bind(promotionsController));
router.post('/coupons', ...adminAuth, promotionsController.createCoupon.bind(promotionsController));
router.get('/coupons/abuse-report', ...adminAuth, promotionsController.getAbuseReport.bind(promotionsController));

// ============================================
// Gift Cards
// ============================================
router.post('/gift-cards', authenticate, promotionsController.issueGiftCard.bind(promotionsController));
router.get('/gift-cards/:code/balance', authenticate, promotionsController.checkGiftCardBalance.bind(promotionsController));
router.post('/gift-cards/redeem', authenticate, promotionsController.redeemGiftCard.bind(promotionsController));
router.get('/gift-cards/liability-report', ...adminAuth, promotionsController.getGiftCardLiabilityReport.bind(promotionsController));

// ============================================
// Loyalty
// ============================================
router.post('/loyalty/award', ...staffAuth, promotionsController.awardPoints.bind(promotionsController));
router.post('/loyalty/redeem', authenticate, promotionsController.redeemPoints.bind(promotionsController));
router.get('/loyalty/users/:userId/status', authenticate, promotionsController.getUserLoyaltyStatus.bind(promotionsController));
router.post('/loyalty/users/:userId/flag-fraud', ...adminAuth, promotionsController.flagUserFraud.bind(promotionsController));
router.post('/loyalty/expire-points', ...adminAuth, promotionsController.expirePoints.bind(promotionsController));

export default router;
