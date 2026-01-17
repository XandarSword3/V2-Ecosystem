/**
 * Review Repository - Supabase Implementation
 * 
 * Implements ReviewRepository interface using Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Review,
  ReviewWithUser,
  ReviewRepository,
  ReviewFilters,
  ReviewStats,
  ServiceType,
} from '../container/types.js';

export function createReviewRepository(supabase: SupabaseClient): ReviewRepository {
  return {
    async getApprovedReviews(serviceType?: ServiceType, limit = 10) {
      let query = supabase
        .from('reviews')
        .select(`
          id,
          user_id,
          rating,
          text,
          service_type,
          is_approved,
          created_at,
          users!reviews_user_id_fkey (
            full_name,
            profile_image_url
          )
        `)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (serviceType && serviceType !== 'general') {
        query = query.eq('service_type', serviceType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(row => ({
        ...row,
        user: row.users,
      })) as ReviewWithUser[];
    },

    async getReviewStats() {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('is_approved', true);

      if (error) throw error;

      const ratings = data || [];
      const totalReviews = ratings.length;
      const averageRating = totalReviews > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

      return { totalReviews, averageRating };
    },

    async getReviewById(id: string) {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Review | null;
    },

    async getReviewByUserAndService(userId: string, serviceType: ServiceType) {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('service_type', serviceType)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Review | null;
    },

    async getAllReviews(filters: ReviewFilters = {}) {
      let query = supabase
        .from('reviews')
        .select(`
          id,
          user_id,
          rating,
          text,
          service_type,
          is_approved,
          created_at,
          users!reviews_user_id_fkey (
            id,
            full_name,
            email,
            profile_image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.status === 'pending') {
        query = query.eq('is_approved', false);
      } else if (filters.status === 'approved') {
        query = query.eq('is_approved', true);
      }

      if (filters.serviceType && filters.serviceType !== 'general') {
        query = query.eq('service_type', filters.serviceType);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(row => ({
        ...row,
        user: row.users,
      })) as ReviewWithUser[];
    },

    async createReview(reviewData) {
      const { data, error } = await supabase
        .from('reviews')
        .insert(reviewData)
        .select()
        .single();

      if (error) throw error;
      return data as Review;
    },

    async updateReviewStatus(id: string, isApproved: boolean) {
      const { data, error } = await supabase
        .from('reviews')
        .update({ is_approved: isApproved })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Review;
    },

    async deleteReview(id: string) {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  };
}
