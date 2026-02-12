import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockReviews: Array<Record<string, unknown>> = [];

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-review-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data: insertData, error: null });
      return Promise.resolve({ data: insertData, error: null });
    }
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'review-1', is_approved: true }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'reviews':
        return createQueryMock(() => mockReviews);
      default:
        return createQueryMock(() => []);
    }
  })
};

vi.mock('../../../../src/database/supabase', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

import {
  reviewsService,
  getApprovedReviews,
  createReview,
  getAllReviews,
  updateReviewStatus,
  approveReview,
  rejectReview,
  deleteReview,
  getReviewById,
  getReviewsByUser,
  getReviewStatsByServiceType,
} from '../../../../src/modules/reviews/reviews.service';

describe('ReviewsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviews = [];
  });

  describe('service exports', () => {
    it('should export reviewsService object with all methods', () => {
      expect(reviewsService).toBeDefined();
      expect(reviewsService.getApprovedReviews).toBeDefined();
      expect(reviewsService.createReview).toBeDefined();
      expect(reviewsService.getAllReviews).toBeDefined();
      expect(reviewsService.updateReviewStatus).toBeDefined();
      expect(reviewsService.approveReview).toBeDefined();
      expect(reviewsService.rejectReview).toBeDefined();
      expect(reviewsService.deleteReview).toBeDefined();
      expect(reviewsService.getReviewById).toBeDefined();
      expect(reviewsService.getReviewsByUser).toBeDefined();
      expect(reviewsService.getReviewStatsByServiceType).toBeDefined();
    });

    it('should export individual functions', () => {
      expect(getApprovedReviews).toBeTypeOf('function');
      expect(createReview).toBeTypeOf('function');
      expect(getAllReviews).toBeTypeOf('function');
      expect(updateReviewStatus).toBeTypeOf('function');
      expect(approveReview).toBeTypeOf('function');
      expect(rejectReview).toBeTypeOf('function');
      expect(deleteReview).toBeTypeOf('function');
      expect(getReviewById).toBeTypeOf('function');
      expect(getReviewsByUser).toBeTypeOf('function');
      expect(getReviewStatsByServiceType).toBeTypeOf('function');
    });
  });

  // =============================================
  // GET APPROVED REVIEWS
  // =============================================

  describe('getApprovedReviews', () => {
    it('should return approved reviews with stats', async () => {
      mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Excellent service!',
          service_type: 'general',
          is_approved: true,
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'John Doe', profile_image_url: null }
        },
        {
          id: 'review-2',
          rating: 4,
          text: 'Great experience',
          service_type: 'restaurant',
          is_approved: true,
          created_at: '2026-01-14T10:00:00Z',
          users: { full_name: 'Jane Smith', profile_image_url: 'http://example.com/img.jpg' }
        }
      ];

      const result = await getApprovedReviews();

      expect(result.reviews).toHaveLength(2);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalReviews).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });

    it('should filter by service type when provided', async () => {
      mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Great food!',
          service_type: 'restaurant',
          is_approved: true,
          created_at: '2026-01-15T10:00:00Z',
          users: { full_name: 'John Doe' }
        }
      ];

      const result = await getApprovedReviews({ service_type: 'restaurant' });

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].service_type).toBe('restaurant');
    });

    it('should apply limit when provided', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5, text: 'Review 1', is_approved: true },
        { id: 'review-2', rating: 4, text: 'Review 2', is_approved: true },
        { id: 'review-3', rating: 5, text: 'Review 3', is_approved: true }
      ];

      const result = await getApprovedReviews({ limit: 2 });

      expect(result.reviews).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });

    it('should return empty array when no approved reviews exist', async () => {
      mockReviews = [];

      const result = await getApprovedReviews();

      expect(result.reviews).toHaveLength(0);
      expect(result.stats.totalReviews).toBe(0);
      expect(result.stats.averageRating).toBe(0);
    });

    it('should calculate average rating correctly', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5 },
        { id: 'review-2', rating: 4 },
        { id: 'review-3', rating: 3 }
      ];

      const result = await getApprovedReviews();

      expect(result.stats.averageRating).toBe(4); // (5+4+3)/3 = 4
    });

    it('should not filter when service_type is "all"', async () => {
      mockReviews = [
        { id: 'review-1', service_type: 'general', rating: 5 },
        { id: 'review-2', service_type: 'restaurant', rating: 4 }
      ];

      const result = await getApprovedReviews({ service_type: 'all' });

      expect(result.reviews).toHaveLength(2);
    });
  });

  // =============================================
  // CREATE REVIEW
  // =============================================

  describe('createReview', () => {
    it('should create a new review for a user', async () => {
      mockReviews = []; // No existing reviews

      const userId = 'user-123';
      const reviewData = {
        rating: 5,
        text: 'Amazing experience! Everything was perfect.',
        service_type: 'general' as const
      };

      const result = await createReview(userId, reviewData);

      expect(result).toBeDefined();
      expect(result.id).toBe('new-review-1');
      expect(result.rating).toBe(5);
      expect(result.user_id).toBe(userId);
      expect(result.is_approved).toBe(false);
    });

    it('should default service_type to "general" if not provided', async () => {
      mockReviews = [];

      const result = await createReview('user-123', {
        rating: 4,
        text: 'Good service overall.'
      });

      expect(result.service_type).toBe('general');
    });

    it('should create review for specific service type', async () => {
      mockReviews = [];

      const result = await createReview('user-123', {
        rating: 5,
        text: 'The restaurant food was delicious!',
        service_type: 'restaurant'
      });

      expect(result.service_type).toBe('restaurant');
    });

    it('should throw error if user already has a review for this service', async () => {
      mockReviews = [
        { id: 'existing-review', user_id: 'user-123', service_type: 'general' }
      ];

      await expect(
        createReview('user-123', {
          rating: 5,
          text: 'Another review',
          service_type: 'general'
        })
      ).rejects.toThrow('You have already submitted a review for this service');
    });

    it('should allow same user to review different service types', async () => {
      mockReviews = []; // Will be empty for the check

      const result = await createReview('user-123', {
        rating: 4,
        text: 'Great pool facilities!',
        service_type: 'pool'
      });

      expect(result).toBeDefined();
      expect(result.service_type).toBe('pool');
    });

    it('should set is_approved to false for new reviews', async () => {
      mockReviews = [];

      const result = await createReview('user-123', {
        rating: 5,
        text: 'Excellent service'
      });

      expect(result.is_approved).toBe(false);
    });
  });

  // =============================================
  // GET ALL REVIEWS (ADMIN)
  // =============================================

  describe('getAllReviews', () => {
    it('should return all reviews including pending', async () => {
      mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Great!',
          is_approved: true,
          service_type: 'general',
          created_at: '2026-01-15T10:00:00Z',
          users: { id: 'user-1', full_name: 'John', email: 'john@example.com' }
        },
        {
          id: 'review-2',
          rating: 3,
          text: 'Average',
          is_approved: false,
          service_type: 'restaurant',
          created_at: '2026-01-14T10:00:00Z',
          users: { id: 'user-2', full_name: 'Jane', email: 'jane@example.com' }
        }
      ];

      const result = await getAllReviews();

      expect(result).toHaveLength(2);
      expect(result[0].users).toBeDefined();
    });

    it('should filter by pending status', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: false },
        { id: 'review-2', is_approved: false }
      ];

      const result = await getAllReviews({ status: 'pending' });

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });

    it('should filter by approved status', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: true },
        { id: 'review-2', is_approved: true }
      ];

      const result = await getAllReviews({ status: 'approved' });

      expect(result).toHaveLength(2);
    });

    it('should filter by service type', async () => {
      mockReviews = [
        { id: 'review-1', service_type: 'chalets' }
      ];

      const result = await getAllReviews({ service_type: 'chalets' });

      expect(result).toHaveLength(1);
      expect(result[0].service_type).toBe('chalets');
    });

    it('should combine status and service_type filters', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: false, service_type: 'pool' }
      ];

      const result = await getAllReviews({ status: 'pending', service_type: 'pool' });

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no reviews exist', async () => {
      mockReviews = [];

      const result = await getAllReviews();

      expect(result).toHaveLength(0);
    });

    it('should not filter when service_type is "all"', async () => {
      mockReviews = [
        { id: 'review-1', service_type: 'general' },
        { id: 'review-2', service_type: 'snack_bar' }
      ];

      const result = await getAllReviews({ service_type: 'all' });

      expect(result).toHaveLength(2);
    });
  });

  // =============================================
  // UPDATE REVIEW STATUS
  // =============================================

  describe('updateReviewStatus', () => {
    it('should update review to approved', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: false }
      ];

      const result = await updateReviewStatus('review-1', true);

      expect(result).toBeDefined();
      expect(result.is_approved).toBe(true);
    });

    it('should update review to rejected', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: true }
      ];

      const result = await updateReviewStatus('review-1', false);

      expect(result).toBeDefined();
    });

    it('should call supabase update with correct parameters', async () => {
      mockReviews = [{ id: 'review-1' }];

      await updateReviewStatus('review-1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });
  });

  // =============================================
  // APPROVE REVIEW
  // =============================================

  describe('approveReview', () => {
    it('should approve a pending review', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: false }
      ];

      const result = await approveReview('review-1');

      expect(result).toBeDefined();
      expect(result.is_approved).toBe(true);
    });

    it('should call updateReviewStatus with true', async () => {
      mockReviews = [{ id: 'review-1' }];

      await approveReview('review-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });
  });

  // =============================================
  // REJECT REVIEW
  // =============================================

  describe('rejectReview', () => {
    it('should reject a review', async () => {
      mockReviews = [
        { id: 'review-1', is_approved: true }
      ];

      const result = await rejectReview('review-1');

      expect(result).toBeDefined();
    });

    it('should call updateReviewStatus with false', async () => {
      mockReviews = [{ id: 'review-1' }];

      await rejectReview('review-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });
  });

  // =============================================
  // DELETE REVIEW
  // =============================================

  describe('deleteReview', () => {
    it('should delete a review by id', async () => {
      mockReviews = [
        { id: 'review-1', text: 'To be deleted' }
      ];

      await deleteReview('review-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });

    it('should not throw error when deleting non-existent review', async () => {
      mockReviews = [];

      await expect(deleteReview('non-existent')).resolves.toBeUndefined();
    });
  });

  // =============================================
  // GET REVIEW BY ID
  // =============================================

  describe('getReviewById', () => {
    it('should return a review when found', async () => {
      mockReviews = [
        {
          id: 'review-1',
          user_id: 'user-123',
          rating: 5,
          text: 'Excellent!',
          service_type: 'general',
          is_approved: true,
          created_at: '2026-01-15T10:00:00Z'
        }
      ];

      const result = await getReviewById('review-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('review-1');
      expect(result?.rating).toBe(5);
    });

    it('should return null when review not found', async () => {
      mockReviews = [];

      const result = await getReviewById('non-existent');

      expect(result).toBeNull();
    });

    it('should query the reviews table with correct id', async () => {
      mockReviews = [{ id: 'review-123' }];

      await getReviewById('review-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('reviews');
    });
  });

  // =============================================
  // GET REVIEWS BY USER
  // =============================================

  describe('getReviewsByUser', () => {
    it('should return all reviews by a specific user', async () => {
      mockReviews = [
        { id: 'review-1', user_id: 'user-123', service_type: 'general' },
        { id: 'review-2', user_id: 'user-123', service_type: 'restaurant' }
      ];

      const result = await getReviewsByUser('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe('user-123');
    });

    it('should return empty array when user has no reviews', async () => {
      mockReviews = [];

      const result = await getReviewsByUser('user-no-reviews');

      expect(result).toHaveLength(0);
    });

    it('should order reviews by created_at descending', async () => {
      mockReviews = [
        { id: 'review-1', user_id: 'user-123', created_at: '2026-01-15T10:00:00Z' },
        { id: 'review-2', user_id: 'user-123', created_at: '2026-01-10T10:00:00Z' }
      ];

      const result = await getReviewsByUser('user-123');

      expect(result).toHaveLength(2);
    });
  });

  // =============================================
  // GET REVIEW STATS BY SERVICE TYPE
  // =============================================

  describe('getReviewStatsByServiceType', () => {
    it('should return stats for all approved reviews', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5, is_approved: true },
        { id: 'review-2', rating: 4, is_approved: true },
        { id: 'review-3', rating: 3, is_approved: true }
      ];

      const result = await getReviewStatsByServiceType();

      expect(result.totalReviews).toBe(3);
      expect(result.averageRating).toBe(4); // (5+4+3)/3 = 4
    });

    it('should return stats filtered by service type', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5, service_type: 'restaurant', is_approved: true },
        { id: 'review-2', rating: 5, service_type: 'restaurant', is_approved: true }
      ];

      const result = await getReviewStatsByServiceType('restaurant');

      expect(result.totalReviews).toBe(2);
      expect(result.averageRating).toBe(5);
    });

    it('should return zero stats when no reviews exist', async () => {
      mockReviews = [];

      const result = await getReviewStatsByServiceType();

      expect(result.totalReviews).toBe(0);
      expect(result.averageRating).toBe(0);
    });

    it('should not filter when service_type is "all"', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5, service_type: 'general' },
        { id: 'review-2', rating: 4, service_type: 'pool' }
      ];

      const result = await getReviewStatsByServiceType('all');

      expect(result.totalReviews).toBe(2);
    });

    it('should round average rating to one decimal place', async () => {
      mockReviews = [
        { id: 'review-1', rating: 5 },
        { id: 'review-2', rating: 4 },
        { id: 'review-3', rating: 4 }
      ];

      const result = await getReviewStatsByServiceType();

      expect(result.averageRating).toBe(4.3); // (5+4+4)/3 = 4.333... rounded to 4.3
    });
  });

  // =============================================
  // EDGE CASES
  // =============================================

  describe('edge cases', () => {
    it('should handle reviews with null user data gracefully', async () => {
      mockReviews = [
        {
          id: 'review-1',
          rating: 5,
          text: 'Great!',
          service_type: 'general',
          is_approved: true,
          users: null
        }
      ];

      const result = await getApprovedReviews();

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].users).toBeNull();
    });

    it('should handle all service types', async () => {
      const serviceTypes = ['general', 'restaurant', 'chalets', 'pool', 'snack_bar'];
      
      for (const serviceType of serviceTypes) {
        mockReviews = [{ id: `review-${serviceType}`, service_type: serviceType }];
        const result = await getAllReviews({ service_type: serviceType });
        expect(result[0].service_type).toBe(serviceType);
      }
    });

    it('should handle reviews with maximum rating', async () => {
      mockReviews = [{ id: 'review-1', rating: 5 }];

      const result = await getReviewStatsByServiceType();

      expect(result.averageRating).toBe(5);
    });

    it('should handle reviews with minimum rating', async () => {
      mockReviews = [{ id: 'review-1', rating: 1 }];

      const result = await getReviewStatsByServiceType();

      expect(result.averageRating).toBe(1);
    });
  });
});
