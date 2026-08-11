/**
 * Reviews Controller Unit Tests
 * 
 * Comprehensive tests for reviews.controller.ts HTTP handlers.
 * Tests all review endpoints: getApprovedReviews, createReview, 
 * getAllReviews (admin), updateReviewStatus, deleteReview.
 */

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
      // Mock data uses module_id (DB column), controller maps to service_type
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          content: 'Excellent service!',
          module_id: 'general',
          created_at: '2024-01-01T00:00:00Z',
          customer_id: 'cust-1',
          customer_name: 'John Doe',
        },
        {
          id: 'review-2',
          rating: 4,
          content: 'Great experience',
          module_id: 'menu_service',
          created_at: '2024-01-02T00:00:00Z',
          customer_id: 'cust-2',
          customer_name: 'Jane Smith',
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
          reviews: mockReviews.map(r => ({
            ...r,
            text: r.content,
            service_type: r.module_id,
            author: { full_name: r.customer_name, profile_image_url: null },
          })),
          stats: {
            totalReviews: 3,
            averageRating: 4.7,
          },
        },
      });
    });

    it('should filter reviews by service type', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          comment: 'Great menu service!',
          module_id: 'menu_service',
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
        query: { service_type: 'menu_service', limit: '5' },
      });

      await getApprovedReviews(req, res, next);

      // Iteration 5: service_type maps to module_id column
      expect(reviewsQueryMock.eq).toHaveBeenCalledWith('module_id', 'menu_service');
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

      // Iteration 5: graceful fallback returns empty data instead of calling next(error)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          reviews: [],
          stats: { totalReviews: 0, averageRating: 0 },
        },
      });
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
        comment: 'Amazing experience!',
        module_id: 'general',
        status: 'pending',
      };

      const insertQueryMock = createChainableMock(mockReview);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertQueryMock),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 5,
          text: 'Amazing experience!',
          service_type: 'general',
        },
      });
      req.user = { id: 'user-123', role: 'customer' };

      await createReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReview,
        message: 'Review submitted and pending approval',
      });
    });

    it('should handle database error on insert', async () => {
      const insertError = new Error('Insert failed');
      const insertQueryMock = createChainableMock(null, insertError);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertQueryMock),
      } as any);

      const { createReview } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        body: {
          rating: 5,
          text: 'Test review text here',
          service_type: 'capacity',
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

      const insertQueryMock = createChainableMock(mockReview);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(insertQueryMock),
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
      // Mock reviews data uses DB column names (module_id, status)
      const mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          content: 'Great!',
          module_id: 'general',
          status: 'approved',
          customer_id: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'review-2',
          rating: 3,
          content: 'Okay',
          module_id: 'menu_service',
          status: 'pending',
          customer_id: 'user-2',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockUsers = [
        { id: 'user-1', full_name: 'John', email: 'john@test.com', profile_image_url: null },
        { id: 'user-2', full_name: 'Jane', email: 'jane@test.com', profile_image_url: null },
      ];

      const reviewsQueryMock = createChainableMock(mockReviews);
      const usersQueryMock = createChainableMock(mockUsers);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          return table === 'users' ? usersQueryMock : reviewsQueryMock;
        }),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        propertyId: 'property-1',
        query: {},
      });

      await getAllReviews(req, res, next);

      // Controller maps DB columns to frontend names
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...mockReviews[0],
            text: mockReviews[0].content,
            service_type: 'general',
            is_approved: true,
            users: { id: 'user-1', full_name: 'John', email: 'john@test.com', profile_image_url: null },
          },
          {
            ...mockReviews[1],
            text: mockReviews[1].content,
            service_type: 'menu_service',
            is_approved: false,
            users: { id: 'user-2', full_name: 'Jane', email: 'jane@test.com', profile_image_url: null },
          },
        ],
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
        propertyId: 'property-1',
        query: { status: 'pending' },
      });

      await getAllReviews(req, res, next);

      // Iteration 5: status column instead of is_approved boolean
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should filter by approved status', async () => {
      const approvedReviews = [
        { id: 'review-1', rating: 5, status: 'approved' },
      ];

      const queryMock = createChainableMock(approvedReviews);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        propertyId: 'property-1',
        query: { status: 'approved' },
      });

      await getAllReviews(req, res, next);

      // Iteration 5: status column instead of is_approved boolean
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('should filter by service type', async () => {
      const queryMock = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        propertyId: 'property-1',
        query: { service_type: 'accommodation_units' },
      });

      await getAllReviews(req, res, next);

      // Iteration 5: service_type maps to module_id column
      expect(queryMock.eq).toHaveBeenCalledWith('module_id', 'accommodation_units');
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { getAllReviews } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({ propertyId: 'property-1' });

      await getAllReviews(req, res, next);

      // Iteration 5: graceful fallback returns empty data instead of calling next(error)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });
  });

  // ============================================
  // UPDATE REVIEW STATUS TESTS
  // ============================================

  describe('updateReviewStatus', () => {
    it('should approve a review', async () => {
      const updatedReview = {
        id: 'review-1',
        status: 'approved',
      };

      const queryMock = createChainableMock(updatedReview);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const { updateReviewStatus } = await import('../../src/modules/reviews/reviews.controller.js');
      const { req, res, next } = createMockReqRes({
        propertyId: 'property-1',
        params: { id: 'review-1' },
        body: { status: 'approved' },
      });

      await updateReviewStatus(req, res, next);

      // Iteration 5: uses status column instead of is_approved
      expect(queryMock.update).toHaveBeenCalledWith({ status: 'approved' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { ...updatedReview, is_approved: true }, // backward-compat mapping
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
        propertyId: 'property-1',
        params: { id: 'review-1' },
        body: { status: 'rejected' },
      });

      await updateReviewStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { ...updatedReview, is_approved: false },
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
        propertyId: 'property-1',
        params: { id: 'nonexistent-review' },
        body: { status: 'approved' },
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
        propertyId: 'property-1',
        params: { id: 'review-1' },
        body: { status: 'approved' },
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
        propertyId: 'property-1',
        params: { id: 'review-1' },
      });

      await deleteReview(req, res, next);

      expect(queryMock.update).toHaveBeenCalledWith(expect.objectContaining({
        deleted_at: expect.any(String)
      }));
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
        propertyId: 'property-1',
        params: { id: 'review-1' },
      });

      await deleteReview(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
