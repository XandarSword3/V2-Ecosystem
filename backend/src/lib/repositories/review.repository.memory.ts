/**
 * In-Memory Review Repository
 * Test double for ReviewRepository using in-memory data structures.
 */

import type {
  ReviewRepository,
  Review,
  ReviewWithUser,
  ReviewFilters,
  ReviewStats,
  ServiceType,
} from '../container/types.js';

export interface InMemoryReviewRepo extends ReviewRepository {
  addReview(review: Partial<Review> & { id: string; user_id: string; rating: number; text: string; service_type: ServiceType; is_approved: boolean; created_at: string }): void;
  setUser(userId: string, user: { id?: string; full_name?: string; email?: string; profile_image_url?: string }): void;
  getAllReviewsRaw(): Review[];
  reset(): void;
}

export function createInMemoryReviewRepository(): InMemoryReviewRepo {
  const reviews = new Map<string, Review>();
  const users = new Map<string, { id?: string; full_name?: string; email?: string; profile_image_url?: string }>();

  function enrichWithUser(review: Review): ReviewWithUser {
    const user = users.get(review.user_id);
    return user ? { ...review, user } : { ...review };
  }

  return {
    addReview(review) {
      reviews.set(review.id, review as Review);
    },
    setUser(userId, user) {
      users.set(userId, user);
    },
    getAllReviewsRaw() {
      return [...reviews.values()];
    },
    reset() {
      reviews.clear();
      users.clear();
    },

    // ReviewRepository interface
    async getApprovedReviews(serviceType?, limit?) {
      let result = [...reviews.values()].filter(r => r.is_approved);
      if (serviceType) result = result.filter(r => r.service_type === serviceType);
      if (limit) result = result.slice(0, limit);
      return result.map(enrichWithUser);
    },

    async getReviewStats() {
      const approved = [...reviews.values()].filter(r => r.is_approved);
      const totalReviews = approved.length;
      const averageRating = totalReviews > 0
        ? approved.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;
      return { totalReviews, averageRating };
    },

    async getReviewById(id) {
      return reviews.get(id) ?? null;
    },

    async getReviewByUserAndService(userId, serviceType) {
      for (const r of reviews.values()) {
        if (r.user_id === userId && r.service_type === serviceType) return r;
      }
      return null;
    },

    async getAllReviews(filters?: ReviewFilters) {
      let result = [...reviews.values()];
      if (filters?.status === 'approved') result = result.filter(r => r.is_approved);
      if (filters?.status === 'pending') result = result.filter(r => !r.is_approved);
      if (filters?.serviceType) result = result.filter(r => r.service_type === filters.serviceType);
      if (filters?.userId) result = result.filter(r => r.user_id === filters.userId);
      return result.map(enrichWithUser);
    },

    async createReview(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const review: Review = { ...data, id, created_at: now, updated_at: now };
      reviews.set(id, review);
      return review;
    },

    async updateReviewStatus(id, isApproved) {
      const existing = reviews.get(id);
      if (!existing) throw new Error(`Review ${id} not found`);
      const updated = { ...existing, is_approved: isApproved, updated_at: new Date().toISOString() };
      reviews.set(id, updated);
      return updated;
    },

    async deleteReview(id) {
      reviews.delete(id);
    },
  };
}
