import { Router } from 'express';
import { couponController } from './coupon.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.get('/active', couponController.getActiveCoupons.bind(couponController));
router.post('/validate', couponController.validateCoupon.bind(couponController));

// Customer routes (authenticated)
router.post('/apply', authenticate, couponController.applyCoupon.bind(couponController));

// Admin routes
router.get('/', authenticate, authorize('admin', 'super_admin'), couponController.getAllCoupons.bind(couponController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), couponController.getStats.bind(couponController));
router.get('/generate-code', authenticate, authorize('admin', 'super_admin'), couponController.generateCode.bind(couponController));
router.get('/:id', authenticate, authorize('admin', 'super_admin'), couponController.getCoupon.bind(couponController));
router.post('/', authenticate, authorize('admin', 'super_admin'), couponController.createCoupon.bind(couponController));
router.put('/:id', authenticate, authorize('admin', 'super_admin'), couponController.updateCoupon.bind(couponController));
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), couponController.deleteCoupon.bind(couponController));

export default router;
