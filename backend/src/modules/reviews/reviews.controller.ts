import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/supabase';
import { logActivity } from '../../utils/activityLogger';
import { z } from 'zod';

/**
 * Reviews Controller
 * Refactored to eliminate runtime schema introspection and standardize on the
 * canonical database schema (comment, status, module_id).
 *
 * Issue 17: Added property_id scoping on all queries and inserts.
 * service_type is now a free-form string (was a hardcoded 5-value enum) so any
 * module slug — including ones created after this code was written — can be used
 * as a review category. The frontend filter and creation form fetch active modules
 * dynamically instead of showing a static list.
 */

/**
 * Permissive property resolution for public/customer-facing endpoints
 * (getApprovedReviews, createReview) that are NOT gated by
 * validatePropertyAccess / requirePropertyId.
 */
function getPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || req.property?.id || (req.headers?.['x-property-id'] as string) || undefined;
}

/**
 * Strict property resolution for admin endpoints. Admin routes
 * (reviews.routes.ts) run validatePropertyAccess + requirePropertyId before
 * reaching any handler here — that pair verifies the caller's property_id
 * belongs to their own tenant and rejects the request outright if it's
 * missing. updateReviewStatus/deleteReview previously scoped by property_id
 * only when the header happened to be present, letting a tenant admin
 * moderate or delete another tenant's reviews by ID. See CONTEXT.md
 * cross-tenant sweep.
 */
function getAdminPropertyId(req: Request): string {
  const propertyId = (req as any).propertyId as string | undefined;
  if (!propertyId) {
    throw new Error('Property context missing — requirePropertyId middleware must run before this handler');
  }
  return propertyId;
}

const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().min(10).max(1000),
  // Previously a fixed enum of legacy module types — now a free-form string so any
  // module slug (including dynamically created ones) can be used without code changes.
  service_type: z.string().max(100).optional().default('general'),
  // Polymorphic review target — allows reviewing staff, menu items, etc.
  target_type: z.string().max(50).optional(),
  targetType: z.string().max(50).optional(),
  target_id: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
});

/**
 * Get all approved reviews for public display
 */
export const getApprovedReviews = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const propertyId = getPropertyId(req);
  const { service_type, limit = 10 } = req.query;

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      content,
      module_id,
      created_at,
      customer_id,
      customer_name
    `)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  if (service_type && service_type !== 'all') {
    query = query.eq('module_id', String(service_type));
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[Reviews] Public query failed:', error.message);
    return res.json({
      success: true,
      data: [],
    });
  }

  res.json({
    success: true,
    data: data || [],
  });
});

/**
 * Create a new review (authenticated users only)
 */
export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const data = createReviewSchema.parse(req.body);
  const userId = (req.user as any)?.id || (req.user as any)?.userId;
  const propertyId = getPropertyId(req);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  if (!propertyId && process.env.NODE_ENV !== 'test') {
    return res.status(400).json({ success: false, error: 'Property ID context is required' });
  }

  const supabase = getSupabase();
  const moduleId = data.service_type || 'general';
  const resolvedTargetType = data.target_type || data.targetType || 'module';
  const resolvedTargetId = data.target_id || data.targetId || (resolvedTargetType === 'module' ? (moduleId !== 'general' ? moduleId : '00000000-0000-0000-0000-000000000000') : '00000000-0000-0000-0000-000000000000');

  // Reviewer's transactions at this property. This is both the "verified
  // transaction" gate and — for staff/item targets below — the relationship
  // scope: it lets those checks confirm the target was actually part of one
  // of THIS customer's orders here, not just that its id exists somewhere.
  let customerTxIds: string[] = [];
  if (propertyId) {
    const { data: customerTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('customer_id', userId)
      .eq('property_id', propertyId);
    customerTxIds = (customerTx || []).map((t) => t.id);

    if (customerTxIds.length === 0) {
      return res.status(403).json({ success: false, error: 'Only customers with verified transactions can review' });
    }
  }

  // Server-side target ownership validation. Previously this only confirmed
  // the target id existed in `profiles`/`catalog_items` — that passed for
  // any staff UUID or menu item on the whole platform, not just this
  // tenant/property or this customer's actual order. Now scoped to a
  // transaction this reviewer had here that actually involved the target.
  if (resolvedTargetType === 'staff') {
    if (propertyId) {
      const { data: servedTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('staff_id', resolvedTargetId)
        .in('id', customerTxIds)
        .limit(1)
        .maybeSingle();
      if (!servedTx) {
        return res.status(403).json({ success: false, error: 'You can only review staff involved in one of your orders here' });
      }
    } else {
      // No property context (e.g. test env) — fall back to existence-only.
      const { data: staffMember } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', resolvedTargetId)
        .maybeSingle();
      if (!staffMember) {
        return res.status(400).json({ success: false, error: 'Invalid staff member target' });
      }
    }
  } else if (resolvedTargetType === 'item' || resolvedTargetType === 'dish') {
    if (propertyId) {
      const { data: orderedItem } = await supabase
        .from('order_items')
        .select('id')
        .eq('catalog_item_id', resolvedTargetId)
        .eq('property_id', propertyId)
        .in('transaction_id', customerTxIds)
        .limit(1)
        .maybeSingle();
      if (!orderedItem) {
        return res.status(403).json({ success: false, error: 'You can only review dishes from one of your orders here' });
      }
    } else {
      // No property context (e.g. test env) — fall back to existence-only.
      const { data: catalogItem } = await supabase
        .from('catalog_items')
        .select('id')
        .eq('id', resolvedTargetId)
        .maybeSingle();
      if (!catalogItem) {
        return res.status(400).json({ success: false, error: 'Invalid menu item target' });
      }
    }
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      customer_id: userId,
      property_id: propertyId,
      rating: data.rating,
      content: data.text,
      module_id: moduleId,
      status: 'pending',
      target_type: resolvedTargetType,
      target_id: resolvedTargetId,
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
    message: 'Review submitted and pending approval',
  });
});

/**
 * Get all reviews for admin (including pending)
 */
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const propertyId = getAdminPropertyId(req);
  const { status, service_type } = req.query;

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      content,
      module_id,
      status,
      customer_id,
      created_at
    `)
    .is('deleted_at', null)
    .eq('property_id', propertyId)
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

  const userIds = [...new Set((data || []).map((r: any) => r.customer_id).filter(Boolean))];
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

  const mappedData = (data || []).map((r: any) => ({
    ...r,
    text: r.content,
    service_type: r.module_id,
    is_approved: r.status === 'approved',
    users: usersMap[r.customer_id] || { full_name: 'Unknown', email: '', profile_image_url: null },
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
  const propertyId = getAdminPropertyId(req);

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ status })
    .eq('id', id)
    .eq('property_id', propertyId)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, error: 'Review not found' });

  await logActivity({
    user_id: (req.user as any)?.userId || 'admin',
    action: 'MODERATE_REVIEW',
    resource: `review:${id}`,
    new_value: { status },
  });

  res.json({
    success: true,
    data: { ...data, is_approved: data.status === 'approved' },
    message: `Review ${status}`,
  });
});

/**
 * Delete a review (admin only) — soft delete via deleted_at
 */
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { id } = req.params;
  const userId = (req.user as any)?.userId || (req.user as any)?.id;
  const propertyId = getAdminPropertyId(req);

  const { error } = await supabase
    .from('reviews')
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq('id', id)
    .eq('property_id', propertyId);
  if (error) throw error;

  res.json({ success: true, message: 'Review deleted' });
});
