/**
 * Review Repository - In-Memory Test Implementation
 * 
 * Implements ReviewRepository interface using in-memory storage for testing.
 */

import type {
  Review,
  ReviewWithUser,
  ReviewRepository,
  ReviewFilters,
  ReviewStats,
  ServiceType,
} from '../container/types.js';

export interface InMemoryReviewRepository extends ReviewRepository {
  // Test helpers
  addReview(review: Review): void;
  setUser(userId: string, user: { id?: string; full_name?: string; email?: string; profile_image_url?: string }): void;
  clear(): void;
  getAllReviewsRaw(): Review[];
}

export function createInMemoryReviewRepository(): InMemoryReviewRepository {
  const reviews = new Map<string, Review>();
  const users = new Map<string, { id?: string; full_name?: string; email?: string; profile_image_url?: string }>();
  
  let nextId = 1;
  const generateId = () => `review-${nextId++}`;

  function attachUser(review: Review): ReviewWithUser {
    return {
      ...review,
      user: users.get(review.user_id) || undefined,
    };
  }

  return {
    async getApprovedReviews(serviceType?: ServiceType, limit = 10) {
      let result = Array.from(reviews.values())
        .filter(r => r.is_approved);

      if (serviceType && serviceType !== 'general') {
        result = result.filter(r => r.service_type === serviceType);
      }

      return result
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)
        .map(attachUser);
    },

    async getReviewStats() {
      const approved = Array.from(reviews.values()).filter(r => r.is_approved);
      const totalReviews = approved.length;
      const averageRating = totalReviews > 0
        ? Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

      return { totalReviews, averageRating };
    },

    async getReviewById(id: string) {
      return reviews.get(id) || null;
    },

    async getReviewByUserAndService(userId: string, serviceType: ServiceType) {
      return Array.from(reviews.values())
        .find(r => r.user_id === userId && r.service_type === serviceType) || null;
    },

    async getAllReviews(filters: ReviewFilters = {}) {
      let result = Array.from(reviews.values());

      if (filters.status === 'pending') {
        result = result.filter(r => !r.is_approved);
      } else if (filters.status === 'approved') {
        result = result.filter(r => r.is_approved);
      }

      if (filters.serviceType && filters.serviceType !== 'general') {
        result = result.filter(r => r.service_type === filters.serviceType);
      }

      if (filters.userId) {
        result = result.filter(r => r.user_id === filters.userId);
      }

      return result
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(attachUser);
    },

    async createReview(reviewData) {
      const now = new Date().toISOString();
      const review: Review = {
        ...reviewData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      reviews.set(review.id, review);
      return review;
    },

    async updateReviewStatus(id: string, isApproved: boolean) {
      const review = reviews.get(id);
      if (!review) throw new Error('Review not found');

      const updated: Review = {
        ...review,
        is_approved: isApproved,
        updated_at: new Date().toISOString(),
      };
      reviews.set(id, updated);
      return updated;
    },

    async deleteReview(id: string) {
      reviews.delete(id);
    },

    // Test helpers
    addReview(review: Review) {
      reviews.set(review.id, review);
    },

    setUser(userId: string, user) {
      users.set(userId, user);
    },

    clear() {
      reviews.clear();
      users.clear();
      nextId = 1;
    },

    getAllReviewsRaw() {
      return Array.from(reviews.values());
    },
  };
}
