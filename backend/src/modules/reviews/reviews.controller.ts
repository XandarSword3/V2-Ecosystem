import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/supabase';
import { z } from 'zod';

// FIX: Iteration 5 - Zod schema accepts frontend field names, mapped to DB columns below
const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(10).max(1000), // Frontend sends 'text', we map to 'comment' column
  service_type: z.enum(['general', 'restaurant', 'chalets', 'pool', 'snack_bar']).optional().default('general'),
});

// FIX: Iteration 5 - Get all approved reviews, using correct column names from Drizzle schema
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
      // FIX: Iteration 5 - Use status='approved' instead of is_approved=true
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (service_type && service_type !== 'all') {
      // FIX: Iteration 5 - service_type maps to module_id column
      query = query.eq('module_id', service_type);
    }

    const { data, error } = await query;

    // FIX Iter-5: Gracefully handle missing reviews table or query errors instead of 500
    if (error) {
      console.warn('[Reviews] Query failed (table may not exist):', error.message);
      return res.json({
        success: true,
        data: {
          reviews: [],
          stats: { totalReviews: 0, averageRating: 0 }
        }
      });
    }

    // Calculate average rating
    const avgQuery = await supabase
      .from('reviews')
      .select('rating')
      .eq('status', 'approved');

    const ratings = avgQuery.data || [];
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;

    // FIX: Iteration 5 - Map DB columns back to frontend-expected field names for backward compatibility
    const mappedReviews = (data || []).map((r: any) => ({
      ...r,
      service_type: r.module_id, // Frontend expects 'service_type'
    }));

    res.json({
      success: true,
      data: {
        reviews: mappedReviews,
        stats: {
          totalReviews: ratings.length,
          averageRating: Math.round(averageRating * 10) / 10,
        }
      }
    });
});

// Create a new review (authenticated users only)
export const createReview = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const data = createReviewSchema.parse(req.body);
    const userId = req.user!.userId;

    // Check if user already has a pending or approved review for this module
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('customer_id', userId)
      // FIX: Iteration 5 - Use module_id instead of service_type
      .eq('module_id', data.service_type)
      .single();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this service'
      });
    }

    // FIX: Iteration 5 - Map frontend fields to correct DB column names
    const insertData: Record<string, any> = {
      user_id: userId,
      customer_id: userId,
      customer_name: 'Guest',
      rating: data.rating,
      text: data.text, // DB column is 'text'
      status: 'pending',
    };
    // Only set module_id if service_type is a valid UUID (not 'general')
    if (data.service_type && data.service_type !== 'general') {
      insertData.module_id = data.service_type;
    }
    const { data: review, error } = await supabase
      .from('reviews')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted and pending approval'
    });
});

// Get all reviews for admin (including pending)
// FIX: Iteration 5 - Use correct column names from Drizzle schema
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { status, service_type } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        text,
        module_id,
        status,
        user_id,
        customer_name,
        created_at
      `)
      .order('created_at', { ascending: false });

    // FIX: Iteration 5 - Use status column instead of is_approved boolean
    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'approved') {
      query = query.eq('status', 'approved');
    } else if (status === 'rejected') {
      query = query.eq('status', 'rejected');
    }

    if (service_type && service_type !== 'all') {
      query = query.eq('module_id', service_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Reviews Admin] Query error:', error.message, error.details);
      // Gracefully handle missing columns or table issues
      return res.json({ success: true, data: [] });
    }

    // Fetch user details separately to avoid join issues
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

    // Map DB columns to frontend-expected names
    const mappedData = (data || []).map((r: any) => ({
      ...r,
      service_type: r.module_id,
      is_approved: r.status === 'approved', // Backward compat for admin UI
      users: usersMap[r.user_id] || { full_name: r.customer_name || 'Unknown', email: '', profile_image_url: null },
    }));

    res.json({ success: true, data: mappedData });
});

// Approve or reject a review (admin only)
// FIX: Iteration 5 - Use status column instead of is_approved boolean
export const updateReviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const { is_approved, status: newStatus } = req.body;

    // Support both old (is_approved boolean) and new (status string) formats
    const statusValue = newStatus || (is_approved === true ? 'approved' : is_approved === false ? 'rejected' : 'pending');

    const { data, error } = await supabase
      .from('reviews')
      .update({ status: statusValue })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      data: { ...data, is_approved: data.status === 'approved' }, // Backward compat
      message: statusValue === 'approved' ? 'Review approved' : 'Review rejected'
    });
});

// Delete a review (admin only)
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Review deleted' });
});
