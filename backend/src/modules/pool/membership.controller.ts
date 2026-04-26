/**
 * Pool Membership Controller
 * 
 * API endpoints for managing pool memberships.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { z } from 'zod';
import { authenticate as authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/roleGuard.middleware';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger';
import { getEngineService } from '../../engines/engine-service.js';
import {
  getAllMembershipPlans,
  getMembershipPricing,
  createMembership,
  cancelMembership,
  validateMembershipAccess,
  useGuestPass,
  MembershipType,
  BillingCycle,
} from '../../services/pool-membership.service.js';

const router = Router();
const engineService = getEngineService();

// Validation schemas
const createMembershipSchema = z.object({
  type: z.nativeEnum(MembershipType),
  billingCycle: z.nativeEnum(BillingCycle),
  memberEmails: z.array(z.string().email()).optional(),
  corporateName: z.string().optional(),
  paymentMethodId: z.string().optional(),
});

const cancelMembershipSchema = z.object({
  reason: z.string().optional(),
  immediate: z.boolean().default(false),
});

const useGuestPassSchema = z.object({
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
});

const membershipPlanCreateSchema = z.object({
  name: z.string().min(2),
  type: z.string().optional(),
  price: z.number().positive(),
  interval: z.enum(['monthly', 'quarterly', 'yearly']),
  features: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

const membershipPlanUpdateSchema = membershipPlanCreateSchema.partial();

function mapPlanIntervalToBillingCycle(interval: string): BillingCycle {
  switch (interval) {
    case 'monthly':
      return BillingCycle.MONTHLY;
    case 'quarterly':
      return BillingCycle.QUARTERLY;
    case 'yearly':
      return BillingCycle.ANNUALLY;
    default:
      return BillingCycle.MONTHLY;
  }
}

/**
 * GET /pool/memberships/plans
 * Get all available membership plans
 */
router.get(
  '/plans',
  asyncHandler(async (req: Request, res: Response) => {
      const supabase = getSupabase();
      const { data: plans, error } = await supabase
        .from('membership_plans')
        .select('id, name, type, price, interval, features, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: (plans || []).map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          type: plan.type,
          billingCycle: mapPlanIntervalToBillingCycle(plan.interval),
          interval: plan.interval,
          price: Number(plan.price),
          features: plan.features || [],
          isActive: plan.is_active,
        })),
      });
  })
);

/**
 * GET /pool/memberships/my-membership
 * Get current user's membership
 */
router.get(
  '/my-membership',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { hasAccess, membership, remainingGuestPasses, discountPercentage } = 
        await validateMembershipAccess(userId);

      if (!hasAccess || !membership) {
        return res.json({
          success: true,
          data: null,
          message: 'No active membership',
        });
      }

      res.json({
        success: true,
        data: {
          id: membership.id,
          type: membership.type,
          status: membership.status,
          billingCycle: membership.billingCycle,
          startDate: membership.startDate,
          endDate: membership.endDate,
          remainingGuestPasses,
          discountPercentage,
          members: membership.members?.map((m: any) => ({
            email: m.email,
            status: m.status,
          })),
          autoRenew: membership.autoRenew,
        },
      });
  })
);

/**
 * POST /pool/memberships
 * Create a new membership
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      
      const validation = createMembershipSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validation.error.flatten(),
        });
      }

      const supabase = getSupabase();
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('id, type, interval')
        .eq('type', validation.data.type)
        .eq('interval', validation.data.billingCycle === BillingCycle.ANNUALLY ? 'yearly' : validation.data.billingCycle.toLowerCase())
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) {
        return res.status(400).json({ success: false, error: 'No active membership plan found for selected type/billing cycle' });
      }

      const result = await createMembership({
        userId,
        ...validation.data,
      });

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          success: false,
          error: result.message,
          ...(result.code ? { code: result.code } : {}),
        });
      }

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          membershipId: result.membership.id,
          subscriptionId: result.subscriptionId,
          clientSecret: result.clientSecret,
        },
      });
  })
);

/**
 * DELETE /pool/memberships/:id
 * Cancel a membership
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const validation = cancelMembershipSchema.safeParse(req.body);
      const { reason, immediate } = validation.success 
        ? validation.data 
        : { reason: undefined, immediate: false };

      const result = await cancelMembership(id, userId, reason, immediate);

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          success: false,
          error: result.message,
          ...(result.code ? { code: result.code } : {}),
        });
      }

      res.json({
        success: true,
        message: result.message,
      });
  })
);

/**
 * POST /pool/memberships/:id/guest-pass
 * Use a guest pass
 */
router.post(
  '/:id/guest-pass',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      
      const validation = useGuestPassSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input',
          details: validation.error.flatten(),
        });
      }

      const { guestName, guestEmail } = validation.data;
      const result = await useGuestPass(id, guestName, guestEmail);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          remainingPasses: result.remainingPasses,
        },
      });
  })
);

/**
 * GET /pool/memberships/:id/usage
 * Get membership usage history
 */
router.get(
  '/:id/usage',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify ownership
      const supabase = getSupabase();
      const { data: membership, error: membershipError } = await supabase
        .from('pool_memberships')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      // Get guest pass usage
      const { data: guestPassUsage, error: guestError } = await supabase
        .from('guest_pass_usage')
        .select('*')
        .eq('membership_id', id)
        .order('used_at', { ascending: false })
        .limit(50);
      if (guestError) throw guestError;

      // Get pool visits by membership holder
      const { data: visits, error: visitsError } = await supabase
        .from('pool_tickets')
        .select('id, date, quantity, status')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(50);
      if (visitsError) throw visitsError;

      res.json({
        success: true,
        data: {
          guestPasses: (guestPassUsage || []).map((g: any) => ({
            guestName: g.guest_name,
            usedAt: g.used_at,
          })),
          visits: (visits || []).map((v: any) => ({
            date: v.date,
            quantity: v.quantity,
            status: v.status,
          })),
        },
      });
  })
);

/**
 * PUT /pool/memberships/:id/auto-renew
 * Toggle auto-renewal
 */
router.put(
  '/:id/auto-renew',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user!.id;
      const { enabled } = req.body;

      const supabase = getSupabase();
      const { data: membership, error: membershipError } = await supabase
        .from('pool_memberships')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      const { error: updateError } = await supabase
        .from('pool_memberships')
        .update({ auto_renew: enabled })
        .eq('id', id);
      if (updateError) throw updateError;

      res.json({
        success: true,
        message: `Auto-renewal ${enabled ? 'enabled' : 'disabled'}`,
      });
  })
);

/**
 * POST /pool/memberships/:id/members
 * Add a member to family/corporate membership
 */
router.post(
  '/:id/members',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user!.id;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const supabase = getSupabase();
      const { data: membership, error: membershipError } = await supabase
        .from('pool_memberships')
        .select('*, members:membership_members(*)')
        .eq('id', id)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      // Check member limit
      if (membership.members.length >= membership.max_members - 1) {
        return res.status(400).json({
          success: false,
          error: 'Maximum members reached',
        });
      }

      // Check if already a member
      const existingMember = membership.members.find((m: any) => m.email === email);
      if (existingMember) {
        return res.status(400).json({
          success: false,
          error: 'Email is already a member',
        });
      }

      const { error: insertError } = await supabase
        .from('membership_members')
        .insert({
          membership_id: id,
          email,
          status: 'PENDING_INVITATION',
        });
      if (insertError) throw insertError;

      res.status(201).json({
        success: true,
        message: 'Member invitation sent',
      });
  })
);

/**
 * DELETE /pool/memberships/:id/members/:memberId
 * Remove a member from membership
 */
router.delete(
  '/:id/members/:memberId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
      const { id, memberId } = req.params;
      const userId = req.user!.id;

      const supabase = getSupabase();
      const { data: membership, error: membershipError } = await supabase
        .from('pool_memberships')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      const { error: deleteError } = await supabase
        .from('membership_members')
        .delete()
        .eq('id', memberId)
        .eq('membership_id', id);
      if (deleteError) throw deleteError;

      res.json({
        success: true,
        message: 'Member removed',
      });
  })
);

// Admin endpoints
/**
 * GET /pool/memberships/admin/all
 * Get all memberships (admin)
 */
router.get(
  '/admin/all',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  asyncHandler(async (req: Request, res: Response) => {
      const { status, type, page = 1, limit = 20 } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;

      const supabase = getSupabase();
      let membershipsQuery = supabase
        .from('pool_memberships')
        .select('*, user:users(id, email, first_name, last_name), members:membership_members(*)')
        .order('start_date', { ascending: false })
        .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1);

      let countQuery = supabase
        .from('pool_memberships')
        .select('*', { count: 'exact', head: true });

      if (status) {
        membershipsQuery = membershipsQuery.eq('status', status);
        countQuery = countQuery.eq('status', status);
      }
      if (type) {
        membershipsQuery = membershipsQuery.eq('type', type);
        countQuery = countQuery.eq('type', type);
      }

      const [{ data: memberships, error: membershipsError }, { count: total, error: countError }] = await Promise.all([
        membershipsQuery,
        countQuery,
      ]);
      if (membershipsError) throw membershipsError;
      if (countError) throw countError;

      res.json({
        success: true,
        data: {
          memberships: memberships || [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total || 0,
            totalPages: Math.ceil((total || 0) / Number(limit)),
          },
        },
      });
  })
);

/**
 * Admin CRUD for membership plans
 */
router.get(
  '/admin/plans',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  asyncHandler(async (_req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  })
);

router.post(
  '/admin/plans',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = membershipPlanCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid plan payload', details: validation.error.flatten() });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('membership_plans')
      .insert(validation.data)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/admin/plans/:id',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = membershipPlanUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid plan payload', details: validation.error.flatten() });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('membership_plans')
      .update(validation.data)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  })
);

router.delete(
  '/admin/plans/:id',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('membership_plans')
      .update({ is_active: false })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Plan deactivated' });
  })
);

/**
 * Staff membership operations
 */
router.get(
  '/staff/list',
  authMiddleware,
  roleGuard(['staff', 'admin', 'super_admin', 'pool_staff', 'pool_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const status = req.query.status as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    let query = supabase
      .from('pool_memberships')
      .select('id, user_id, type, status, start_date, end_date, users(email, first_name, last_name)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    const filtered = (data || []).filter((row: any) => {
      if (!search) return true;
      const fullName = `${row.users?.first_name || ''} ${row.users?.last_name || ''}`.toLowerCase();
      const email = `${row.users?.email || ''}`.toLowerCase();
      return fullName.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    });

    res.json({ success: true, data: filtered });
  })
);

router.get(
  '/staff/expiring',
  authMiddleware,
  roleGuard(['staff', 'admin', 'super_admin', 'pool_staff', 'pool_admin']),
  asyncHandler(async (_req: Request, res: Response) => {
    const supabase = getSupabase();
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('pool_memberships')
      .select('id, user_id, type, status, end_date, users(email, first_name, last_name)')
      .eq('status', 'ACTIVE')
      .gte('end_date', start)
      .lte('end_date', end)
      .order('end_date', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  })
);

router.patch(
  '/staff/:id/activate',
  authMiddleware,
  roleGuard(['staff', 'admin', 'super_admin', 'pool_staff', 'pool_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: membership, error: readError } = await supabase
      .from('pool_memberships')
      .select('id, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!membership) return res.status(404).json({ success: false, error: 'Membership not found' });

    const transition = await engineService.transitionState('subscription', String(membership.status).toLowerCase(), 'activate', 'staff');
    if (!transition.allowed) return res.status(400).json({ success: false, error: transition.error || 'Invalid transition' });

    const { data, error } = await supabase
      .from('pool_memberships')
      .update({ status: transition.targetState.toUpperCase(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  })
);

router.patch(
  '/staff/:id/extend',
  authMiddleware,
  roleGuard(['staff', 'admin', 'super_admin', 'pool_staff', 'pool_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const extraDays = Number(req.body?.days || 0);
    if (!Number.isFinite(extraDays) || extraDays <= 0) {
      return res.status(400).json({ success: false, error: 'days must be a positive number' });
    }
    const supabase = getSupabase();
    const { data: membership, error: readError } = await supabase
      .from('pool_memberships')
      .select('id, end_date')
      .eq('id', req.params.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!membership) return res.status(404).json({ success: false, error: 'Membership not found' });

    const endDate = membership.end_date ? new Date(membership.end_date) : new Date();
    endDate.setDate(endDate.getDate() + extraDays);

    const { data, error } = await supabase
      .from('pool_memberships')
      .update({ end_date: endDate.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  })
);

router.patch(
  '/staff/:id/suspend',
  authMiddleware,
  roleGuard(['staff', 'admin', 'super_admin', 'pool_staff', 'pool_admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { data: membership, error: readError } = await supabase
      .from('pool_memberships')
      .select('id, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!membership) return res.status(404).json({ success: false, error: 'Membership not found' });

    const transition = await engineService.transitionState('subscription', String(membership.status).toLowerCase(), 'pause', 'staff');
    if (!transition.allowed) return res.status(400).json({ success: false, error: transition.error || 'Invalid transition' });

    const { data, error } = await supabase
      .from('pool_memberships')
      .update({ status: transition.targetState.toUpperCase(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  })
);

export default router;
