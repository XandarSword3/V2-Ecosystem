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
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), reviewsController.deleteReview);

export default router;
