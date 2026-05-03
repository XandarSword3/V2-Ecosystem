import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/supabase';
import { logActivity } from '../../utils/activityLogger';
import { z } from 'zod';

/**
 * Reviews Controller
 * Refactored to eliminate runtime schema introspection and standardize on the 
 * canonical database schema (comment, status, module_id).
 */

const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(10).max(1000), // Frontend sends 'text', we map to 'comment' in DB
  service_type: z.enum(['general', 'restaurant', 'chalets', 'pool', 'snack_bar']).optional().default('general'),
});

/**
 * Get all approved reviews for public display
 */
export const getApprovedReviews = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { service_type, limit = 10 } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        module_id,
        created_at,
        users!inner (
          full_name,
          profile_image_url
        )
      `)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (service_type && service_type !== 'all') {
      query = query.eq('module_id', String(service_type));
    }

    const { data, error } = await query;

    if (error) {
      // If table is missing or columns are missing, return empty instead of 500
      console.warn('[Reviews] Public query failed:', error.message);
      return res.json({
        success: true,
        data: { reviews: [], stats: { totalReviews: 0, averageRating: 0 } }
      });
    }

    // Calculate stats
    const { data: allRatings } = await supabase
      .from('reviews')
      .select('rating')
      .eq('status', 'approved');

    const ratings = allRatings || [];
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;

    // Map DB columns back to frontend-expected names
    const reviews = (data || []).map((r: any) => ({
      ...r,
      text: r.comment,
      service_type: r.module_id,
    }));

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          totalReviews: ratings.length,
          averageRating: Math.round(averageRating * 10) / 10,
        }
      }
    });
});

/**
 * Create a new review (authenticated users only)
 */
export const createReview = asyncHandler(async (req: Request, res: Response) => {
    const data = createReviewSchema.parse(req.body);
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const supabase = getSupabase();
    const moduleId = data.service_type || 'general';

    // Standard insert using canonical columns
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        rating: data.rating,
        comment: data.text,
        module_id: moduleId,
        status: 'pending',
        target_type: 'module', // Fixed default
        target_id: '00000000-0000-0000-0000-000000000000', // Placeholder for non-specific module reviews
      })
      .select()
      .single();

    if (error) {
      console.error('[Reviews] Create failed:', error);
      throw error;
    }

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted and pending approval'
    });
});

/**
 * Get all reviews for admin (including pending)
 */
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { status, service_type } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        module_id,
        status,
        user_id,
        created_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (service_type && service_type !== 'all') {
      query = query.eq('module_id', service_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Reviews Admin] Query error:', error.message);
      return res.json({ success: true, data: [] });
    }

    // Fetch user details separately to avoid complex joins in drift-prone environments
    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    let usersMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, profile_image_url')
        .in('id', userIds);
      if (users) {
        usersMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
      }
    }

    // Map to frontend format
    const mappedData = (data || []).map((r: any) => ({
      ...r,
      text: r.comment,
      service_type: r.module_id,
      is_approved: r.status === 'approved', // Backward compat for legacy admin UI
      users: usersMap[r.user_id] || { full_name: 'Unknown', email: '', profile_image_url: null },
    }));

    res.json({ success: true, data: mappedData });
});

/**
 * Approve or reject a review (admin only)
 */
export const updateReviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Review not found' });

    // Log the moderation action
    await logActivity({
      user_id: (req.user as any)?.userId || 'admin',
      action: 'MODERATE_REVIEW',
      resource: `review:${id}`,
      new_value: { status }
    });

    res.json({
      success: true,
      data: { ...data, is_approved: data.status === 'approved' },
      message: `Review ${status}`
    });
});

/**
 * Delete a review (admin only)
 */
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;

    const { error } = await supabase
      .from('reviews')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Review deleted' });
});
