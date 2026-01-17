/**
 * Reviews Controller Unit Tests
 * 
 * Comprehensive tests for reviews.controller.ts HTTP handlers.
 * Tests all review endpoints: getApprovedReviews, createReview, 
 * getAllReviews (admin), updateReviewStatus, deleteReview.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockReqRes, createChainableMock } from './utils.js';

// Mock Supabase before importing controller
vi.mock('../../src/database/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Reviews Controller', () => {
  let getSupabase: typeof import('../../src/database/supabase.js').getSupabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const supabaseModule = await import('../../src/database/supabase.js');
    getSupabase = supabaseModule.getSupabase;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // GET APPROVED REVIEWS TESTS
  // ============================================

  describe('getApprovedReviews', () => {
    it('should return approved reviews with stats', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Excellent service!',
          service_type: 'general',
          created_at: '2024-01-01T00:00:00Z',
          users: { full_name: 'John Doe', profile_image_url: null },
        },
        {
          id: 'review-2',
          rating: 4,
          text: 'Great experience',
          service_type: 'restaurant',
          created_at: '2024-01-02T00:00:00Z',
          users: { full_name: 'Jane Smith', profile_image_url: null },
        },
      ];

      const mockRatings = [{ rating: 5 }, { rating: 4 }, { rating: 5 }];

      // Create mock for main reviews query
      const reviewsQueryMock = createChainableMock(mockReviews);
      // Create mock for ratings query (average calculation)
      const ratingsQueryMock = createChainableMock(mockRatings);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          // First call is for reviews, second for ratings
          return callCount === 1 ? reviewsQueryMock : ratingsQueryMock;
        }),
      } as any);

      const { getApprovedReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { limit: '10' },
      });

      await getApprovedReviews(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          reviews: mockReviews,
          stats: {
            totalReviews: 3,
            averageRating: 4.7, // (5+4+5)/3 = 4.67 rounded
          },
        },
      });
    });

    it('should filter reviews by service type', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Great restaurant!',
          service_type: 'restaurant',
          created_at: '2024-01-01T00:00:00Z',
          users: { full_name: 'John Doe', profile_image_url: null },
        },
      ];

      const reviewsQueryMock = createChainableMock(mockReviews);
      const ratingsQueryMock = createChainableMock([{ rating: 5 }]);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? reviewsQueryMock : ratingsQueryMock;
        }),
      } as any);

      const { getApprovedReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { service_type: 'restaurant', limit: '5' },
      });

      await getApprovedReviews(req, res, next);

      expect(reviewsQueryMock.eq).toHaveBeenCalledWith('service_type', 'restaurant');
    });

    it('should not filter by service type when type is "all"', async () => {
      const mockReviews: any[] = [];
      const reviewsQueryMock = createChainableMock(mockReviews);
      const ratingsQueryMock = createChainableMock([]);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? reviewsQueryMock : ratingsQueryMock;
        }),
      } as any);

      const { getApprovedReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { service_type: 'all' },
      });

      await getApprovedReviews(req, res, next);

      // eq should only be called once for is_approved, not for service_type
      const eqCalls = reviewsQueryMock.eq.mock.calls;
      const serviceTypeCalls = eqCalls.filter((call: any[]) => call[0] === 'service_type');
      expect(serviceTypeCalls).toHaveLength(0);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      const errorQueryMock = createChainableMock(null, dbError);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(errorQueryMock),
      } as any);

      const { getApprovedReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes();

      await getApprovedReviews(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    it('should return zero average rating when no reviews exist', async () => {
      const reviewsQueryMock = createChainableMock([]);
      const ratingsQueryMock = createChainableMock([]);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? reviewsQueryMock : ratingsQueryMock;
        }),
      } as any);

      const { getApprovedReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes();

      await getApprovedReviews(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          reviews: [],
          stats: {
            totalReviews: 0,
            averageRating: 0,
          },
        },
      });
    });
  });

  // ============================================
  // CREATE REVIEW TESTS
  // ============================================

  describe('createReview', () => {
    it('should create a new review successfully', async () => {
      const mockReview = {
        id: 'review-new',
        user_id: 'user-123',
        rating: 5,
        text: 'Amazing experience!',
        service_type: 'general',
        is_approved: false,
      };

      // Mock: no existing review
      const existingQueryMock = createChainableMock(null);
      // Mock: insert new review
      const insertQueryMock = createChainableMock(mockReview);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? existingQueryMock : insertQueryMock;
        }),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 5,
          text: 'Amazing experience!',
          service_type: 'general',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await createReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReview,
        message: 'Review submitted and pending approval',
      });
    });

    it('should reject if user already has a review for this service', async () => {
      // Mock: existing review found
      const existingReview = { id: 'existing-review' };
      const existingQueryMock = createChainableMock(existingReview);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(existingQueryMock),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 4,
          text: 'Another review attempt',
          service_type: 'restaurant',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await createReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You have already submitted a review for this service',
      });
    });

    it('should handle database error on insert', async () => {
      const existingQueryMock = createChainableMock(null);
      const insertError = new Error('Insert failed');
      const insertQueryMock = createChainableMock(null, insertError);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? existingQueryMock : insertQueryMock;
        }),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 5,
          text: 'Test review text here',
          service_type: 'pool',
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await createReview(req, res, next);

      expect(next).toHaveBeenCalledWith(insertError);
    });

    it('should default service_type to general', async () => {
      const mockReview = {
        id: 'review-new',
        user_id: 'user-123',
        rating: 4,
        text: 'Good service overall',
        service_type: 'general',
        is_approved: false,
      };

      const existingQueryMock = createChainableMock(null);
      const insertQueryMock = createChainableMock(mockReview);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? existingQueryMock : insertQueryMock;
        }),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 4,
          text: 'Good service overall',
          // service_type not provided
        },
      });
      req.user = { userId: 'user-123', role: 'customer' };

      await createReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ============================================
  // GET ALL REVIEWS (ADMIN) TESTS
  // ============================================

  describe('getAllReviews', () => {
    it('should return all reviews for admin', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Great!',
          service_type: 'general',
          is_approved: true,
          created_at: '2024-01-01T00:00:00Z',
          users: { id: 'user-1', full_name: 'John', email: 'john@test.com', profile_image_url: null },
        },
        {
          id: 'review-2',
          rating: 3,
          text: 'Okay',
          service_type: 'restaurant',
          is_approved: false,
          created_at: '2024-01-02T00:00:00Z',
          users: { id: 'user-2', full_name: 'Jane', email: 'jane@test.com', profile_image_url: null },
        },
      ];

      const queryMock = createChainableMock(mockReviews);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await getAllReviews(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReviews,
      });
    });

    it('should filter by pending status', async () => {
      const pendingReviews = [
        { id: 'review-2', rating: 3, is_approved: false },
      ];

      const queryMock = createChainableMock(pendingReviews);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { status: 'pending' },
      });

      await getAllReviews(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('is_approved', false);
    });

    it('should filter by approved status', async () => {
      const approvedReviews = [
        { id: 'review-1', rating: 5, is_approved: true },
      ];

      const queryMock = createChainableMock(approvedReviews);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { status: 'approved' },
      });

      await getAllReviews(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('is_approved', true);
    });

    it('should filter by service type', async () => {
      const queryMock = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        query: { service_type: 'chalets' },
      });

      await getAllReviews(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('service_type', 'chalets');
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes();

      await getAllReviews(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ============================================
  // UPDATE REVIEW STATUS TESTS
  // ============================================

  describe('updateReviewStatus', () => {
    it('should approve a review', async () => {
      const updatedReview = {
        id: 'review-1',
        is_approved: true,
      };

      const queryMock = createChainableMock(updatedReview);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateReviewStatus } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'review-1' },
        body: { is_approved: true },
      });

      await updateReviewStatus(req, res, next);

      expect(queryMock.update).toHaveBeenCalledWith({ is_approved: true });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedReview,
        message: 'Review approved',
      });
    });

    it('should reject a review', async () => {
      const updatedReview = {
        id: 'review-1',
        is_approved: false,
      };

      const queryMock = createChainableMock(updatedReview);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateReviewStatus } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'review-1' },
        body: { is_approved: false },
      });

      await updateReviewStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedReview,
        message: 'Review rejected',
      });
    });

    it('should return 404 if review not found', async () => {
      const queryMock = createChainableMock(null);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateReviewStatus } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'nonexistent-review' },
        body: { is_approved: true },
      });

      await updateReviewStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Review not found',
      });
    });

    it('should handle database error', async () => {
      const dbError = new Error('Update failed');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateReviewStatus } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'review-1' },
        body: { is_approved: true },
      });

      await updateReviewStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ============================================
  // DELETE REVIEW TESTS
  // ============================================

  describe('deleteReview', () => {
    it('should delete a review successfully', async () => {
      const queryMock = createChainableMock(null);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { deleteReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'review-1' },
      });

      await deleteReview(req, res, next);

      expect(queryMock.delete).toHaveBeenCalled();
      expect(queryMock.eq).toHaveBeenCalledWith('id', 'review-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Review deleted',
      });
    });

    it('should handle database error on delete', async () => {
      const dbError = new Error('Delete failed');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { deleteReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        params: { id: 'review-1' },
      });

      await deleteReview(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
