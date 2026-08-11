import { Router } from 'express';
import { couponController } from './coupon.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validatePropertyAccess, requirePropertyId } from '../../middleware/propertyAccess.middleware.js';
import couponImportRoutes from './coupon-import.routes.js';

const router = Router();

// Public routes
router.get('/active', couponController.getActiveCoupons.bind(couponController));
router.post('/validate', couponController.validateCoupon.bind(couponController));

// /apply route removed — see coupon.controller.ts's removal note on
// applyCoupon(). Coupon consumption now happens server-side at order
// creation, not via a separate customer-invoked endpoint.

// Admin routes
//
// validatePropertyAccess + requirePropertyId: getAllCoupons/createCoupon used
// to hand-roll their own "400 if propertyId missing" check but never
// validated OWNERSHIP of a supplied property_id — a tenant_owner could pass
// another tenant's property UUID straight through. getCoupon/updateCoupon/
// deleteCoupon didn't even have the presence check. validatePropertyAccess
// verifies the property belongs to req.tenant.id before requirePropertyId
// enforces it can't be skipped. See CONTEXT.md cross-tenant sweep.
router.get('/', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.getAllCoupons.bind(couponController));
router.get('/stats', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.getStats.bind(couponController));
router.get('/generate-code', authenticate, authorize('admin', 'super_admin'), couponController.generateCode.bind(couponController));
router.get('/:id', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.getCoupon.bind(couponController));
router.post('/', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.createCoupon.bind(couponController));
router.put('/:id', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.updateCoupon.bind(couponController));
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, couponController.deleteCoupon.bind(couponController));

// Import routes
router.use('/import', couponImportRoutes);

export default router;
