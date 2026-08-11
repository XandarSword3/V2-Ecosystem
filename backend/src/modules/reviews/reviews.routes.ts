import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validatePropertyAccess, requirePropertyId } from '../../middleware/propertyAccess.middleware.js';
import * as reviewsController from './reviews.controller';

const router = Router();

// Public routes
router.get('/', reviewsController.getApprovedReviews);

// Authenticated routes
router.post('/', authenticate, reviewsController.createReview);

// Admin routes
//
// validatePropertyAccess + requirePropertyId: updateReviewStatus/deleteReview
// used to filter by property_id only when the header happened to be present,
// so a tenant admin could moderate or soft-delete another tenant's reviews by
// ID. See CONTEXT.md cross-tenant sweep.
router.get('/admin', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, reviewsController.getAllReviews);
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, reviewsController.updateReviewStatus);
router.put('/:id/approve', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, (req, res, next) => {
  req.body.status = 'approved';
  reviewsController.updateReviewStatus(req, res, next);
});
router.put('/:id/reject', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, (req, res, next) => {
  req.body.status = 'rejected';
  reviewsController.updateReviewStatus(req, res, next);
});
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), validatePropertyAccess, requirePropertyId, reviewsController.deleteReview);

export default router;
