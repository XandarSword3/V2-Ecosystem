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

/**
 * GET /pool/memberships/plans
 * Get all available membership plans
 */
router.get(
  '/plans',
  asyncHandler(async (req: Request, res: Response) => {
      const plans = getAllMembershipPlans();
      
      res.json({
        success: true,
        data: plans.map(plan => ({
          type: plan.type,
          billingCycle: plan.billingCycle,
          price: plan.basePrice,
          maxMembers: plan.maxMembers,
          dailyAccessLimit: plan.dailyAccessLimit === 0 ? 'Unlimited' : plan.dailyAccessLimit,
          guestPasses: plan.guestPasses === 0 ? 'Unlimited' : plan.guestPasses,
          discountPercentage: plan.discountPercentage,
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

      const result = await createMembership({
        userId,
        ...validation.data,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
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
        return res.status(400).json({
          success: false,
          error: result.message,
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

export default router;
