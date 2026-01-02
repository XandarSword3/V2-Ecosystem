import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import * as reviewsController from './reviews.controller';

const router = Router();

// Public routes
router.get('/', reviewsController.getApprovedReviews);

// Authenticated routes
router.post('/', authenticate, reviewsController.createReview);

// Admin routes
router.get('/admin', authenticate, authorize('admin', 'super_admin'), reviewsController.getAllReviews);
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), reviewsController.updateReviewStatus);
router.put('/:id/approve', authenticate, authorize('admin', 'super_admin'), (req, res, next) => {
  req.body.is_approved = true;
  reviewsController.updateReviewStatus(req, res, next);
});
router.put('/:id/reject', authenticate, authorize('admin', 'super_admin'), (req, res, next) => {
  req.body.is_approved = false;
  reviewsController.updateReviewStatus(req, res, next);
});
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), reviewsController.deleteReview);

export default router;
