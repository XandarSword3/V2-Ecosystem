/**
 * Review Service Unit Tests
 * 
 * Tests for review submission, approval workflow, and statistics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createReviewService,
  ReviewService,
  ReviewServiceError,
} from '../../src/lib/services/review.service.js';
import { createInMemoryReviewRepository } from '../../src/lib/repositories/review.repository.memory.js';
import type { LoggerService, ActivityLoggerService, SocketEmitter } from '../../src/lib/container/types.js';

// ============================================
// TEST FIXTURES
// ============================================

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    getActivityLogs: vi.fn().mockResolvedValue([]),
  };
}

function createMockSocketEmitter(): SocketEmitter {
  return {
    emitToUnit: vi.fn(),
    emitToUser: vi.fn(),
  };
}

// ============================================
// APPROVED REVIEWS (PUBLIC)
// ============================================

describe('ReviewService - Public Operations', () => {
  let service: ReviewService;
  let reviewRepository: ReturnType<typeof createInMemoryReviewRepository>;

  beforeEach(() => {
    reviewRepository = createInMemoryReviewRepository();
    
    service = createReviewService({
      reviewRepository,
      logger: createMockLogger(),
      activityLogger: createMockActivityLogger(),
      socketEmitter: createMockSocketEmitter(),
    });
  });

  describe('getApprovedReviews', () => {
    it('should return empty array when no reviews exist', async () => {
      const result = await service.getApprovedReviews();
      
      expect(result.reviews).toEqual([]);
      expect(result.stats.totalReviews).toBe(0);
      expect(result.stats.averageRating).toBe(0);
    });

    it('should return only approved reviews', async () => {
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'Great experience!',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-2',
        user_id: 'user-2',
        rating: 1,
        text: 'Pending review...',
        service_type: 'general',
        is_approved: false,
        created_at: new Date().toISOString(),
      });

      const result = await service.getApprovedReviews();
      
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].rating).toBe(5);
    });

    it('should filter by service type', async () => {
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'Great pool!',
        service_type: 'pool',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-2',
        user_id: 'user-2',
        rating: 4,
        text: 'Nice restaurant!',
        service_type: 'restaurant',
        is_approved: true,
        created_at: new Date().toISOString(),
      });

      const result = await service.getApprovedReviews('pool');
      
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].service_type).toBe('pool');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        reviewRepository.addReview({
          id: `review-${i}`,
          user_id: `user-${i}`,
          rating: 5,
          text: 'Great service!',
          service_type: 'general',
          is_approved: true,
          created_at: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const result = await service.getApprovedReviews(undefined, 3);
      
      expect(result.reviews).toHaveLength(3);
    });

    it('should calculate correct statistics', async () => {
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'Excellent!',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-2',
        user_id: 'user-2',
        rating: 4,
        text: 'Very good!',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-3',
        user_id: 'user-3',
        rating: 3,
        text: 'Average experience',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });

      const result = await service.getApprovedReviews();
      
      expect(result.stats.totalReviews).toBe(3);
      expect(result.stats.averageRating).toBe(4); // (5+4+3)/3 = 4
    });

    it('should include user information when available', async () => {
      reviewRepository.setUser('user-1', {
        id: 'user-1',
        full_name: 'John Doe',
        profile_image_url: 'https://example.com/avatar.jpg',
      });
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'Great experience!',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });

      const result = await service.getApprovedReviews();
      
      expect(result.reviews[0].user?.full_name).toBe('John Doe');
    });
  });
});

// ============================================
// CREATE REVIEW (USER)
// ============================================

describe('ReviewService - User Operations', () => {
  let service: ReviewService;
  let reviewRepository: ReturnType<typeof createInMemoryReviewRepository>;
  let mockActivityLogger: ActivityLoggerService;
  let mockSocketEmitter: SocketEmitter;

  beforeEach(() => {
    reviewRepository = createInMemoryReviewRepository();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();

    service = createReviewService({
      reviewRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: mockSocketEmitter,
    });
  });

  describe('createReview', () => {
    it('should create a new review', async () => {
      const result = await service.createReview({
        rating: 5,
        text: 'This is a great place!',
      }, 'user-1');

      expect(result.rating).toBe(5);
      expect(result.text).toBe('This is a great place!');
      expect(result.service_type).toBe('general');
      expect(result.is_approved).toBe(false); // Pending approval
      expect(result.user_id).toBe('user-1');
    });

    it('should create review with specific service type', async () => {
      const result = await service.createReview({
        rating: 4,
        text: 'Amazing pool experience!',
        serviceType: 'pool',
      }, 'user-1');

      expect(result.service_type).toBe('pool');
    });

    it('should throw error for invalid rating (too low)', async () => {
      await expect(
        service.createReview({
          rating: 0,
          text: 'Some review text here',
        }, 'user-1')
      ).rejects.toMatchObject({
        code: 'INVALID_RATING',
        statusCode: 400,
      });
    });

    it('should throw error for invalid rating (too high)', async () => {
      await expect(
        service.createReview({
          rating: 6,
          text: 'Some review text here',
        }, 'user-1')
      ).rejects.toMatchObject({
        code: 'INVALID_RATING',
        statusCode: 400,
      });
    });

    it('should throw error for text too short', async () => {
      await expect(
        service.createReview({
          rating: 5,
          text: 'Short',
        }, 'user-1')
      ).rejects.toMatchObject({
        code: 'TEXT_TOO_SHORT',
        statusCode: 400,
      });
    });

    it('should throw error for text too long', async () => {
      await expect(
        service.createReview({
          rating: 5,
          text: 'x'.repeat(1001),
        }, 'user-1')
      ).rejects.toMatchObject({
        code: 'TEXT_TOO_LONG',
        statusCode: 400,
      });
    });

    it('should throw error for duplicate review', async () => {
      // First review
      await service.createReview({
        rating: 5,
        text: 'Great experience overall!',
        serviceType: 'restaurant',
      }, 'user-1');

      // Duplicate review for same service
      await expect(
        service.createReview({
          rating: 4,
          text: 'Another review attempt!',
          serviceType: 'restaurant',
        }, 'user-1')
      ).rejects.toMatchObject({
        code: 'DUPLICATE_REVIEW',
        statusCode: 400,
      });
    });

    it('should allow reviews for different services', async () => {
      // Restaurant review
      await service.createReview({
        rating: 5,
        text: 'Great restaurant experience!',
        serviceType: 'restaurant',
      }, 'user-1');

      // Pool review (different service)
      const result = await service.createReview({
        rating: 4,
        text: 'Lovely pool facility!',
        serviceType: 'pool',
      }, 'user-1');

      expect(result.service_type).toBe('pool');
    });

    it('should log activity on review creation', async () => {
      await service.createReview({
        rating: 5,
        text: 'Great experience here!',
      }, 'user-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'CREATE_REVIEW',
        expect.objectContaining({
          rating: 5,
          serviceType: 'general',
        }),
        'user-123'
      );
    });

    it('should emit socket event to admin on creation', async () => {
      await service.createReview({
        rating: 4,
        text: 'Nice experience overall!',
      }, 'user-1');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'admin',
        'review:created',
        expect.objectContaining({
          rating: 4,
          serviceType: 'general',
        })
      );
    });
  });

  describe('getUserReviews', () => {
    it('should return empty array when user has no reviews', async () => {
      const result = await service.getUserReviews('user-1');
      expect(result).toEqual([]);
    });

    it('should return only user\'s reviews', async () => {
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'My review',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-2',
        user_id: 'user-2',
        rating: 4,
        text: 'Other user review',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });

      const result = await service.getUserReviews('user-1');
      
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('user-1');
    });
  });
});

// ============================================
// ADMIN OPERATIONS
// ============================================

describe('ReviewService - Admin Operations', () => {
  let service: ReviewService;
  let reviewRepository: ReturnType<typeof createInMemoryReviewRepository>;
  let mockActivityLogger: ActivityLoggerService;
  let mockSocketEmitter: SocketEmitter;

  beforeEach(() => {
    reviewRepository = createInMemoryReviewRepository();
    mockActivityLogger = createMockActivityLogger();
    mockSocketEmitter = createMockSocketEmitter();

    service = createReviewService({
      reviewRepository,
      logger: createMockLogger(),
      activityLogger: mockActivityLogger,
      socketEmitter: mockSocketEmitter,
    });
  });

  describe('getAllReviews', () => {
    beforeEach(() => {
      reviewRepository.addReview({
        id: 'review-1',
        user_id: 'user-1',
        rating: 5,
        text: 'Approved review',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
      reviewRepository.addReview({
        id: 'review-2',
        user_id: 'user-2',
        rating: 3,
        text: 'Pending review',
        service_type: 'restaurant',
        is_approved: false,
        created_at: new Date().toISOString(),
      });
    });

    it('should return all reviews', async () => {
      const result = await service.getAllReviews();
      expect(result).toHaveLength(2);
    });

    it('should filter by pending status', async () => {
      const result = await service.getAllReviews({ status: 'pending' });
      
      expect(result).toHaveLength(1);
      expect(result[0].is_approved).toBe(false);
    });

    it('should filter by approved status', async () => {
      const result = await service.getAllReviews({ status: 'approved' });
      
      expect(result).toHaveLength(1);
      expect(result[0].is_approved).toBe(true);
    });

    it('should filter by service type', async () => {
      const result = await service.getAllReviews({ serviceType: 'restaurant' });
      
      expect(result).toHaveLength(1);
      expect(result[0].service_type).toBe('restaurant');
    });

    it('should combine filters', async () => {
      const result = await service.getAllReviews({
        status: 'pending',
        serviceType: 'restaurant',
      });
      
      expect(result).toHaveLength(1);
    });
  });

  describe('approveReview', () => {
    beforeEach(() => {
      reviewRepository.addReview({
        id: 'review-pending',
        user_id: 'user-1',
        rating: 5,
        text: 'Pending approval review',
        service_type: 'general',
        is_approved: false,
        created_at: new Date().toISOString(),
      });
    });

    it('should approve a pending review', async () => {
      const result = await service.approveReview('review-pending', 'admin-1');

      expect(result.is_approved).toBe(true);
    });

    it('should throw error for non-existent review', async () => {
      await expect(
        service.approveReview('non-existent', 'admin-1')
      ).rejects.toMatchObject({
        code: 'REVIEW_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error if already approved', async () => {
      await service.approveReview('review-pending', 'admin-1');
      
      await expect(
        service.approveReview('review-pending', 'admin-1')
      ).rejects.toMatchObject({
        code: 'ALREADY_APPROVED',
        statusCode: 400,
      });
    });

    it('should log activity on approval', async () => {
      await service.approveReview('review-pending', 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'APPROVE_REVIEW',
        expect.objectContaining({
          reviewId: 'review-pending',
          userId: 'user-1',
        }),
        'admin-123'
      );
    });

    it('should emit socket events on approval', async () => {
      await service.approveReview('review-pending', 'admin-1');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'admin',
        'review:approved',
        { id: 'review-pending' }
      );

      expect(mockSocketEmitter.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'review:statusChanged',
        { id: 'review-pending', isApproved: true }
      );
    });
  });

  describe('rejectReview', () => {
    beforeEach(() => {
      reviewRepository.addReview({
        id: 'review-approved',
        user_id: 'user-1',
        rating: 5,
        text: 'Approved review',
        service_type: 'general',
        is_approved: true,
        created_at: new Date().toISOString(),
      });
    });

    it('should reject an approved review', async () => {
      const result = await service.rejectReview('review-approved', 'admin-1');

      expect(result.is_approved).toBe(false);
    });

    it('should throw error for non-existent review', async () => {
      await expect(
        service.rejectReview('non-existent', 'admin-1')
      ).rejects.toMatchObject({
        code: 'REVIEW_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity on rejection', async () => {
      await service.rejectReview('review-approved', 'admin-456');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'REJECT_REVIEW',
        expect.objectContaining({
          reviewId: 'review-approved',
          userId: 'user-1',
        }),
        'admin-456'
      );
    });

    it('should emit socket events on rejection', async () => {
      await service.rejectReview('review-approved', 'admin-1');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'admin',
        'review:rejected',
        { id: 'review-approved' }
      );

      expect(mockSocketEmitter.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'review:statusChanged',
        { id: 'review-approved', isApproved: false }
      );
    });
  });

  describe('deleteReview', () => {
    beforeEach(() => {
      reviewRepository.addReview({
        id: 'review-delete',
        user_id: 'user-1',
        rating: 2,
        text: 'Review to delete',
        service_type: 'general',
        is_approved: false,
        created_at: new Date().toISOString(),
      });
    });

    it('should delete a review', async () => {
      await service.deleteReview('review-delete', 'admin-1');

      // Verify deleted
      const allReviews = reviewRepository.getAllReviewsRaw();
      expect(allReviews.find(r => r.id === 'review-delete')).toBeUndefined();
    });

    it('should throw error for non-existent review', async () => {
      await expect(
        service.deleteReview('non-existent', 'admin-1')
      ).rejects.toMatchObject({
        code: 'REVIEW_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should log activity on deletion', async () => {
      await service.deleteReview('review-delete', 'admin-789');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'DELETE_REVIEW',
        expect.objectContaining({
          reviewId: 'review-delete',
          userId: 'user-1',
          rating: 2,
        }),
        'admin-789'
      );
    });

    it('should emit socket event on deletion', async () => {
      await service.deleteReview('review-delete', 'admin-1');

      expect(mockSocketEmitter.emitToUnit).toHaveBeenCalledWith(
        'admin',
        'review:deleted',
        { id: 'review-delete' }
      );
    });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('ReviewServiceError', () => {
  it('should create error with correct properties', () => {
    const error = new ReviewServiceError('Test message', 'TEST_CODE', 500);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ReviewServiceError');
  });

  it('should default to 400 status code', () => {
    const error = new ReviewServiceError('Test', 'TEST');

    expect(error.statusCode).toBe(400);
  });
});
