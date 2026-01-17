/**
 * Review Service
 * 
 * Business logic for review management with dependency injection.
 * Handles review submission, approval workflow, and statistics.
 */

import type {
  ReviewRepository,
  Review,
  ReviewWithUser,
  ReviewFilters,
  ReviewStats,
  ServiceType,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
} from '../container/types.js';

// ============================================
// ERROR TYPES
// ============================================

export class ReviewServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ReviewServiceError';
  }
}

// ============================================
// SERVICE TYPES
// ============================================

export interface CreateReviewInput {
  rating: number;
  text: string;
  serviceType?: ServiceType;
}

export interface ReviewServiceDeps {
  reviewRepository: ReviewRepository;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
}

export interface ReviewService {
  // Public operations
  getApprovedReviews(serviceType?: ServiceType, limit?: number): Promise<{
    reviews: ReviewWithUser[];
    stats: ReviewStats;
  }>;
  
  // User operations
  createReview(input: CreateReviewInput, userId: string): Promise<Review>;
  getUserReviews(userId: string): Promise<ReviewWithUser[]>;
  
  // Admin operations
  getAllReviews(filters?: ReviewFilters): Promise<ReviewWithUser[]>;
  approveReview(id: string, adminUserId?: string): Promise<Review>;
  rejectReview(id: string, adminUserId?: string): Promise<Review>;
  deleteReview(id: string, adminUserId?: string): Promise<void>;
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createReviewService(deps: ReviewServiceDeps): ReviewService {
  const { reviewRepository, logger, activityLogger, socketEmitter } = deps;

  return {
    // ============================================
    // PUBLIC OPERATIONS
    // ============================================

    async getApprovedReviews(serviceType, limit = 10) {
      const [reviews, stats] = await Promise.all([
        reviewRepository.getApprovedReviews(serviceType, limit),
        reviewRepository.getReviewStats(),
      ]);

      return { reviews, stats };
    },

    // ============================================
    // USER OPERATIONS
    // ============================================

    async createReview(input, userId) {
      // Validate rating
      if (input.rating < 1 || input.rating > 5) {
        throw new ReviewServiceError(
          'Rating must be between 1 and 5',
          'INVALID_RATING',
          400
        );
      }

      // Validate text length
      if (!input.text || input.text.length < 10) {
        throw new ReviewServiceError(
          'Review text must be at least 10 characters',
          'TEXT_TOO_SHORT',
          400
        );
      }

      if (input.text.length > 1000) {
        throw new ReviewServiceError(
          'Review text cannot exceed 1000 characters',
          'TEXT_TOO_LONG',
          400
        );
      }

      const serviceType = input.serviceType || 'general';

      // Check for existing review
      const existingReview = await reviewRepository.getReviewByUserAndService(
        userId,
        serviceType
      );

      if (existingReview) {
        throw new ReviewServiceError(
          'You have already submitted a review for this service',
          'DUPLICATE_REVIEW',
          400
        );
      }

      const review = await reviewRepository.createReview({
        user_id: userId,
        rating: input.rating,
        text: input.text,
        service_type: serviceType,
        is_approved: false, // Needs admin approval
      });

      await activityLogger.log('CREATE_REVIEW', {
        reviewId: review.id,
        rating: review.rating,
        serviceType: review.service_type,
      }, userId);

      socketEmitter.emitToUnit('admin', 'review:created', {
        id: review.id,
        rating: review.rating,
        serviceType: review.service_type,
      });

      logger.info('Review created', { reviewId: review.id, userId, serviceType });

      return review;
    },

    async getUserReviews(userId) {
      return reviewRepository.getAllReviews({ userId });
    },

    // ============================================
    // ADMIN OPERATIONS
    // ============================================

    async getAllReviews(filters) {
      return reviewRepository.getAllReviews(filters);
    },

    async approveReview(id, adminUserId) {
      const existing = await reviewRepository.getReviewById(id);
      if (!existing) {
        throw new ReviewServiceError('Review not found', 'REVIEW_NOT_FOUND', 404);
      }

      if (existing.is_approved) {
        throw new ReviewServiceError(
          'Review is already approved',
          'ALREADY_APPROVED',
          400
        );
      }

      const review = await reviewRepository.updateReviewStatus(id, true);

      await activityLogger.log('APPROVE_REVIEW', {
        reviewId: id,
        userId: existing.user_id,
      }, adminUserId);

      socketEmitter.emitToUnit('admin', 'review:approved', { id });
      socketEmitter.emitToUser(existing.user_id, 'review:statusChanged', {
        id,
        isApproved: true,
      });

      logger.info('Review approved', { reviewId: id, adminUserId });

      return review;
    },

    async rejectReview(id, adminUserId) {
      const existing = await reviewRepository.getReviewById(id);
      if (!existing) {
        throw new ReviewServiceError('Review not found', 'REVIEW_NOT_FOUND', 404);
      }

      const review = await reviewRepository.updateReviewStatus(id, false);

      await activityLogger.log('REJECT_REVIEW', {
        reviewId: id,
        userId: existing.user_id,
      }, adminUserId);

      socketEmitter.emitToUnit('admin', 'review:rejected', { id });
      socketEmitter.emitToUser(existing.user_id, 'review:statusChanged', {
        id,
        isApproved: false,
      });

      logger.info('Review rejected', { reviewId: id, adminUserId });

      return review;
    },

    async deleteReview(id, adminUserId) {
      const existing = await reviewRepository.getReviewById(id);
      if (!existing) {
        throw new ReviewServiceError('Review not found', 'REVIEW_NOT_FOUND', 404);
      }

      await reviewRepository.deleteReview(id);

      await activityLogger.log('DELETE_REVIEW', {
        reviewId: id,
        userId: existing.user_id,
        rating: existing.rating,
      }, adminUserId);

      socketEmitter.emitToUnit('admin', 'review:deleted', { id });

      logger.info('Review deleted', { reviewId: id, adminUserId });
    },
  };
}
