import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../database/supabase';
import { z } from 'zod';

const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(10).max(1000),
  service_type: z.enum(['general', 'restaurant', 'chalets', 'pool', 'snack_bar']).optional().default('general'),
});

// Get all approved reviews (public)
export async function getApprovedReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { service_type, limit = 10 } = req.query;

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

    // Calculate average rating
    const avgQuery = await supabase
      .from('reviews')
      .select('rating')
      .eq('is_approved', true);

    const ratings = avgQuery.data || [];
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;

    res.json({
      success: true,
      data: {
        reviews: data || [],
        stats: {
          totalReviews: ratings.length,
          averageRating: Math.round(averageRating * 10) / 10,
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// Create a new review (authenticated users only)
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const data = createReviewSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if user already has a pending or approved review for this service type
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('service_type', data.service_type)
      .single();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this service'
      });
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        rating: data.rating,
        text: data.text,
        service_type: data.service_type,
        is_approved: false, // Needs admin approval
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted and pending approval'
    });
  } catch (error) {
    next(error);
  }
}

// Get all reviews for admin (including pending)
export async function getAllReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { status, service_type } = req.query;

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

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
}

// Approve or reject a review (admin only)
export async function updateReviewStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { is_approved } = req.body;

    const { data, error } = await supabase
      .from('reviews')
      .update({ is_approved })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      data,
      message: is_approved ? 'Review approved' : 'Review rejected'
    });
  } catch (error) {
    next(error);
  }
}

// Delete a review (admin only)
export async function deleteReview(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
}
