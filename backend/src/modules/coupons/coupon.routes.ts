import { Router } from 'express';
import { couponController } from './coupon.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import couponImportRoutes from './coupon-import.routes.js';

const router = Router();

// Public routes
router.get('/active', couponController.getActiveCoupons.bind(couponController));
router.post('/validate', couponController.validateCoupon.bind(couponController));

// /apply route removed — see coupon.controller.ts's removal note on
// applyCoupon(). Coupon consumption now happens server-side at order
// creation, not via a separate customer-invoked endpoint.

// Admin routes
router.get('/', authenticate, authorize('admin', 'super_admin'), couponController.getAllCoupons.bind(couponController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), couponController.getStats.bind(couponController));
router.get('/generate-code', authenticate, authorize('admin', 'super_admin'), couponController.generateCode.bind(couponController));
router.get('/:id', authenticate, authorize('admin', 'super_admin'), couponController.getCoupon.bind(couponController));
router.post('/', authenticate, authorize('admin', 'super_admin'), couponController.createCoupon.bind(couponController));
router.put('/:id', authenticate, authorize('admin', 'super_admin'), couponController.updateCoupon.bind(couponController));
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), couponController.deleteCoupon.bind(couponController));

// Import routes
router.use('/import', couponImportRoutes);

export default router;
