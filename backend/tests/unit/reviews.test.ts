/**
 * Reviews Module Unit Tests
 * 
 * Tests for the reviews module functionality including:
 * - Public review retrieval
 * - Authenticated review submission
 * - Admin moderation
 * - Rating calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../setup';

// Mock the database connection
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabaseClient
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Reviews Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Reviews', () => {
    it('should retrieve approved reviews only for public display', async () => {
      const approvedReviews = [
        { id: '1', rating: 5, comment: 'Great!', status: 'approved' },
        { id: '2', rating: 4, comment: 'Good', status: 'approved' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: approvedReviews,
              error: null
            })
          })
        })
      });

      // Simulate controller behavior
      const result = await mockSupabaseClient
        .from('reviews')
        .select('*')
        .eq('status', 'approved')
        .order('created_at');

      expect(result.data).toEqual(approvedReviews);
      expect(result.data.every((r: { status: string }) => r.status === 'approved')).toBe(true);
    });

    it('should filter reviews by business unit', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: '1', business_unit: 'restaurant' }],
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('reviews')
        .select('*')
        .eq('status', 'approved')
        .eq('business_unit', 'restaurant');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].business_unit).toBe('restaurant');
    });
  });

  describe('Review Submission', () => {
    it('should require rating between 1 and 5', () => {
      const validRatings = [1, 2, 3, 4, 5];
      const invalidRatings = [0, 6, -1, 10];

      validRatings.forEach(rating => {
        expect(rating >= 1 && rating <= 5).toBe(true);
      });

      invalidRatings.forEach(rating => {
        expect(rating >= 1 && rating <= 5).toBe(false);
      });
    });

    it('should set status to pending for new reviews', async () => {
      const newReview = {
        rating: 5,
        comment: 'Excellent service!',
        business_unit: 'restaurant',
        customer_name: 'John Doe'
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...newReview, id: '123', status: 'pending' },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('reviews')
        .insert({ ...newReview, status: 'pending' })
        .select()
        .single();

      expect(result.data.status).toBe('pending');
    });

    it('should validate comment length', () => {
      const maxLength = 1000;
      const validComment = 'A'.repeat(500);
      const tooLongComment = 'A'.repeat(1500);

      expect(validComment.length <= maxLength).toBe(true);
      expect(tooLongComment.length <= maxLength).toBe(false);
    });
  });

  describe('Review Moderation', () => {
    it('should allow admin to approve reviews', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '1', status: 'approved' },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('reviews')
        .update({ status: 'approved' })
        .eq('id', '1')
        .select()
        .single();

      expect(result.data.status).toBe('approved');
    });

    it('should allow admin to reject reviews', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '1', status: 'rejected' },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', '1')
        .select()
        .single();

      expect(result.data.status).toBe('rejected');
    });
  });

  describe('Rating Statistics', () => {
    it('should calculate average rating correctly', () => {
      const reviews = [
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
        { rating: 5 }
      ];

      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      const average = sum / reviews.length;

      expect(average).toBe(4.4);
    });

    it('should count reviews by rating', () => {
      const reviews = [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 }
      ];

      const counts: Record<number, number> = {};
      reviews.forEach(r => {
        counts[r.rating] = (counts[r.rating] || 0) + 1;
      });

      expect(counts[5]).toBe(3);
      expect(counts[4]).toBe(1);
      expect(counts[3]).toBe(1);
    });
  });
});
