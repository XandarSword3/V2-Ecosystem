/**
 * Reviews Service
 * Business logic for guest reviews management
 */

import { getSupabase } from '../../database/supabase';

// =============================================
// TYPES
// =============================================

export type ServiceType = 'general' | 'restaurant' | 'chalets' | 'pool' | 'snack_bar';
export type ReviewStatus = 'pending' | 'approved';

export interface Review {
  id: string;
  user_id: string;
  rating: number;
  text: string;
  service_type: ServiceType;
  is_approved: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ReviewWithUser extends Review {
  users?: {
    id?: string;
    full_name: string;
    email?: string;
    profile_image_url?: string;
  };
}

export interface CreateReviewData {
  rating: number;
  text: string;
  service_type?: ServiceType;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
}

export interface GetReviewsOptions {
  service_type?: string;
  limit?: number;
}

export interface GetAllReviewsOptions {
  status?: 'pending' | 'approved';
  service_type?: string;
}

// =============================================
// SERVICE FUNCTIONS
// =============================================

/**
 * Get all approved reviews (public)
 */
export async function getApprovedReviews(options: GetReviewsOptions = {}): Promise<{
  reviews: ReviewWithUser[];
  stats: ReviewStats;
}> {
  const supabase = getSupabase();
  const { service_type, limit = 10 } = options;

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      text,
      service_type,
      created_at,
      users!reviews_user_id_fkey (
        full_name,
        profile_image_url
      )
    `)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (service_type && service_type !== 'all') {
    query = query.eq('service_type', service_type);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate average rating from all approved reviews
  const avgQuery = await supabase
    .from('reviews')
    .select('rating')
    .eq('is_approved', true);

  const ratings = avgQuery.data || [];
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
    : 0;

  return {
    reviews: (data || []) as unknown as ReviewWithUser[],
    stats: {
      totalReviews: ratings.length,
      averageRating: Math.round(averageRating * 10) / 10,
    }
  };
}

/**
 * Create a new review
 */
export async function createReview(
  userId: string,
  data: CreateReviewData
): Promise<Review> {
  const supabase = getSupabase();
  const service_type = data.service_type || 'general';

  // Check if user already has a review for this service type
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('service_type', service_type)
    .single();

  if (existingReview) {
    throw new Error('You have already submitted a review for this service');
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      user_id: userId,
      rating: data.rating,
      text: data.text,
      service_type,
      is_approved: false, // Needs admin approval
    })
    .select()
    .single();

  if (error) throw error;

  return review as Review;
}

/**
 * Get all reviews for admin (including pending)
 */
export async function getAllReviews(options: GetAllReviewsOptions = {}): Promise<ReviewWithUser[]> {
  const supabase = getSupabase();
  const { status, service_type } = options;

  let query = supabase
    .from('reviews')
    .select(`
      id,
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

  if (status === 'pending') {
    query = query.eq('is_approved', false);
  } else if (status === 'approved') {
    query = query.eq('is_approved', true);
  }

  if (service_type && service_type !== 'all') {
    query = query.eq('service_type', service_type);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []) as unknown as ReviewWithUser[];
}

/**
 * Update review approval status
 */
export async function updateReviewStatus(
  reviewId: string,
  isApproved: boolean
): Promise<Review> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('reviews')
    .update({ is_approved: isApproved })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error('Review not found');
  }

  return data as Review;
}

/**
 * Approve a review
 */
export async function approveReview(reviewId: string): Promise<Review> {
  return updateReviewStatus(reviewId, true);
}

/**
 * Reject a review
 */
export async function rejectReview(reviewId: string): Promise<Review> {
  return updateReviewStatus(reviewId, false);
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw error;
}

/**
 * Get a single review by ID
 */
export async function getReviewById(reviewId: string): Promise<Review | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return data as Review | null;
}

/**
 * Get reviews by user
 */
export async function getReviewsByUser(userId: string): Promise<Review[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []) as Review[];
}

/**
 * Get review statistics by service type
 */
export async function getReviewStatsByServiceType(serviceType?: string): Promise<ReviewStats> {
  const supabase = getSupabase();

  let query = supabase
    .from('reviews')
    .select('rating')
    .eq('is_approved', true);

  if (serviceType && serviceType !== 'all') {
    query = query.eq('service_type', serviceType);
  }

  const { data, error } = await query;

  if (error) throw error;

  const ratings = data || [];
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
    : 0;

  return {
    totalReviews: ratings.length,
    averageRating: Math.round(averageRating * 10) / 10,
  };
}

// Export all functions as a service object for convenience
export const reviewsService = {
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
};

export default reviewsService;
