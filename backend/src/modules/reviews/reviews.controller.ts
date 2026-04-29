import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getPool } from '../../database/connection.js';
import { getSupabase } from '../../database/supabase';
import { z } from 'zod';

// FIX: Iteration 5 - Zod schema accepts frontend field names, mapped to DB columns below
const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(10).max(1000), // Frontend sends 'text', we map to 'comment' column
  service_type: z.enum(['general', 'restaurant', 'chalets', 'pool', 'snack_bar']).optional().default('general'),
});

type ReviewsColumnSet = {
  commentCol: 'comment' | 'text' | null;
  hasStatus: boolean;
  hasModuleId: boolean;
  hasTargetType: boolean;
  hasTargetId: boolean;
  hasUserId: boolean;
};

let cachedReviewsColumns: ReviewsColumnSet | null = null;

async function detectReviewsColumns(): Promise<ReviewsColumnSet | null> {
  if (cachedReviewsColumns) return cachedReviewsColumns;
  let pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }

  let result: { rows: Array<{ column_name: string }> };
  try {
    result = await pool.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reviews'
      `,
    );
  } catch {
    // Direct Postgres connectivity can fail in some environments (DNS/firewall/pooler).
    // In that case we fall back to Supabase HTTP (PostgREST) paths.
    cachedReviewsColumns = null;
    return null;
  }
  const cols = new Set(result.rows.map((r) => r.column_name));
  const commentCol = cols.has('comment') ? 'comment' : cols.has('text') ? 'text' : null;

  cachedReviewsColumns = {
    commentCol,
    hasStatus: cols.has('status'),
    hasModuleId: cols.has('module_id'),
    hasTargetType: cols.has('target_type'),
    hasTargetId: cols.has('target_id'),
    hasUserId: cols.has('user_id'),
  };
  return cachedReviewsColumns;
}

// FIX: Iteration 5 - Get all approved reviews, using correct column names from Drizzle schema
export const getApprovedReviews = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { service_type, limit = 10 } = req.query;

    const baseFilters = {
      status: 'approved',
      module_id: service_type && service_type !== 'all' ? String(service_type) : null,
    };

    const selectWithComment = async () => {
      let q = supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          comment,
          module_id,
          created_at,
          users!inner (
            full_name,
            profile_image_url
          )
        `,
        )
        .eq('status', baseFilters.status)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (baseFilters.module_id) q = q.eq('module_id', baseFilters.module_id);
      return q;
    };

    const selectWithText = async () => {
      let q = supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          text,
          module_id,
          created_at,
          users!inner (
            full_name,
            profile_image_url
          )
        `,
        )
        .eq('status', baseFilters.status)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (baseFilters.module_id) q = q.eq('module_id', baseFilters.module_id);
      return q;
    };

    // PostgREST will error if we select a column that doesn't exist. Try comment-first, then text.
    let data: any[] | null = null;
    let error: any | null = null;
    {
      const resp = await (await selectWithComment());
      data = resp.data as any;
      error = resp.error as any;
    }
    if (error?.code === 'PGRST204') {
      const resp = await (await selectWithText());
      data = resp.data as any;
      error = resp.error as any;
    }

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
      text: r.text ?? r.comment,
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
    const data = createReviewSchema.parse(req.body);
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const moduleId = data.service_type || 'general';
    const targetType = 'module';
    const targetId = '00000000-0000-0000-0000-000000000000';

    // Prefer direct SQL when available (avoids PostgREST schema-cache drift issues).
    const cols = await detectReviewsColumns();
    if (cols) {
      if (!cols.hasUserId) {
        return res.status(500).json({
          success: false,
          error: "Reviews table missing required column 'user_id'",
        });
      }
      if (!cols.commentCol) {
        return res.status(500).json({
          success: false,
          error: "Reviews table missing review text column ('comment' or 'text')",
        });
      }

      const pool = getPool();
      const fields: string[] = ['user_id', 'rating'];
      const values: any[] = [userId, data.rating];
      const placeholders: string[] = ['$1', '$2'];

      if (cols.hasStatus) {
        fields.push('status');
        values.push('pending');
        placeholders.push(`$${values.length}`);
      }
      if (cols.hasModuleId) {
        fields.push('module_id');
        values.push(moduleId);
        placeholders.push(`$${values.length}`);
      }
      if (cols.hasTargetType) {
        fields.push('target_type');
        values.push(targetType);
        placeholders.push(`$${values.length}`);
      }
      if (cols.hasTargetId) {
        fields.push('target_id');
        values.push(targetId);
        placeholders.push(`$${values.length}`);
      }

      fields.push(cols.commentCol);
      values.push(data.text);
      placeholders.push(`$${values.length}`);

      const inserted = await pool.query(
        `INSERT INTO reviews (${fields.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values,
      );

      return res.status(201).json({
        success: true,
        data: inserted.rows[0],
        message: 'Review submitted and pending approval',
      });
    }

    const supabase = getSupabase();

    // Check if user already submitted a review for this target.
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .single();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this service'
      });
    }

    const insertData: Record<string, any> = {
      user_id: userId,
      module_id: moduleId,
      target_type: targetType,
      target_id: targetId,
      rating: data.rating,
      comment: data.text,
      status: 'pending',
    };
    // Schema drift is common for this module. Try the "full" schema first, then fall back to
    // a minimal insert if columns are missing in the target DB.
    let review: any | null = null;
    let error: any | null = null;

    {
      const attempt = await supabase.from('reviews').insert(insertData).select().single();
      review = attempt.data;
      error = attempt.error;
    }

    const msg = (error as any)?.message as string | undefined;
    const isMissingColumn =
      Boolean(error && error.code === 'PGRST204') ||
      Boolean(msg && /column .* does not exist/i.test(msg));

    if (error && isMissingColumn) {
      const minimal: Record<string, any> = {
        user_id: userId,
        rating: data.rating,
        status: 'pending',
        module_id: moduleId,
      };

      // First try `comment`, then `text`
      {
        const attempt = await supabase
          .from('reviews')
          .insert({ ...minimal, comment: data.text })
          .select()
          .single();
        review = attempt.data;
        error = attempt.error;
      }
      if (error && error.code === 'PGRST204') {
        const attempt = await supabase
          .from('reviews')
          .insert({ ...minimal, text: data.text })
          .select()
          .single();
        review = attempt.data;
        error = attempt.error;
      }
    }

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

    // Prefer direct SQL when available (avoids PostgREST schema-cache drift issues).
    const cols = await detectReviewsColumns();
    if (cols) {
      const pool = getPool();
      const conditions: string[] = [];
      const params: any[] = [];

      if (status === 'pending' || status === 'approved' || status === 'rejected') {
        if (cols.hasStatus) {
          params.push(status);
          conditions.push(`status = $${params.length}`);
        }
      }
      if (service_type && service_type !== 'all' && cols.hasModuleId) {
        params.push(service_type);
        conditions.push(`module_id = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const textSelect = cols.commentCol ? `${cols.commentCol} AS text` : `NULL::text AS text`;

      const rows = await pool.query(
        `
        SELECT
          id,
          rating,
          ${textSelect},
          module_id,
          status,
          user_id,
          created_at
        FROM reviews
        ${where}
        ORDER BY created_at DESC
        `,
        params,
      );

      const userIds = [...new Set(rows.rows.map((r) => r.user_id).filter(Boolean))] as string[];
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const users = await pool.query(
          `SELECT id, full_name, email, profile_image_url FROM users WHERE id = ANY($1::uuid[])`,
          [userIds],
        );
        usersMap = Object.fromEntries(users.rows.map((u: any) => [u.id, u]));
      }

      const mapped = rows.rows.map((r: any) => ({
        ...r,
        service_type: r.module_id,
        is_approved: r.status === 'approved',
        users: usersMap[r.user_id] || { full_name: 'Unknown', email: '', profile_image_url: null },
      }));

      return res.json({ success: true, data: mapped });
    }

    const buildQuery = (cols: string) => {
      let query = supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          ${cols},
          module_id,
          status,
          user_id,
          created_at
        `,
        )
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

      return query;
    };

    // Try `comment` first (newer schema), then `text` (legacy schema).
    let data: any[] | null = null;
    let error: any | null = null;
    {
      const resp = await buildQuery('comment');
      data = resp.data as any;
      error = resp.error as any;
    }
    if (error?.code === 'PGRST204') {
      const resp = await buildQuery('text');
      data = resp.data as any;
      error = resp.error as any;
    }

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
      text: r.text ?? r.comment,
      service_type: r.module_id,
      is_approved: r.status === 'approved', // Backward compat for admin UI
      users: usersMap[r.user_id] || { full_name: 'Unknown', email: '', profile_image_url: null },
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
