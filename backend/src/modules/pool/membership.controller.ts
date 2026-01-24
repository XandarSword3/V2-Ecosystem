/**
 * Pool Membership Controller
 * 
 * API endpoints for managing pool memberships.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate as authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/roleGuard.middleware';
import { prisma } from '../../lib/prisma';
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /pool/memberships/my-membership
 * Get current user's membership
 */
router.get(
  '/my-membership',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pool/memberships
 * Create a new membership
 */
router.post(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
        type: validation.data.type,
        billingCycle: validation.data.billingCycle,
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /pool/memberships/:id
 * Cancel a membership
 */
router.delete(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pool/memberships/:id/guest-pass
 * Use a guest pass
 */
router.post(
  '/:id/guest-pass',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /pool/memberships/:id/usage
 * Get membership usage history
 */
router.get(
  '/:id/usage',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify ownership
      const membership = await prisma.poolMembership.findFirst({
        where: { id, userId },
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      // Get guest pass usage
      const guestPassUsage = await prisma.guestPassUsage.findMany({
        where: { membershipId: id },
        orderBy: { usedAt: 'desc' },
        take: 50,
      });

      // Get pool visits by membership holder
      const visits = await prisma.poolTicket.findMany({
        where: {
          userId,
          // membershipId: id, // Removed as not present in schema
        },
        orderBy: { date: 'desc' },
        take: 50,
        select: {
          id: true,
          date: true,
          quantity: true,
          status: true,
        },
      });

      res.json({
        success: true,
        data: {
          guestPasses: guestPassUsage.map(g => ({
            guestName: g.guestName,
            usedAt: g.usedAt,
          })),
          visits: visits.map(v => ({
            date: v.date,
            quantity: v.quantity,
            status: v.status,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /pool/memberships/:id/auto-renew
 * Toggle auto-renewal
 */
router.put(
  '/:id/auto-renew',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { enabled } = req.body;

      const membership = await prisma.poolMembership.findFirst({
        where: { id, userId },
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      await prisma.poolMembership.update({
        where: { id },
        data: { autoRenew: enabled },
      });

      res.json({
        success: true,
        message: `Auto-renewal ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pool/memberships/:id/members
 * Add a member to family/corporate membership
 */
router.post(
  '/:id/members',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const membership = await prisma.poolMembership.findFirst({
        where: { id, userId },
        include: { members: true },
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      // Check member limit
      if (membership.members.length >= membership.maxMembers - 1) {
        return res.status(400).json({
          success: false,
          error: 'Maximum members reached',
        });
      }

      // Check if already a member
      const existingMember = membership.members.find(m => m.email === email);
      if (existingMember) {
        return res.status(400).json({
          success: false,
          error: 'Email is already a member',
        });
      }

      await prisma.membershipMember.create({
        data: {
          membershipId: id,
          email,
          status: 'PENDING_INVITATION',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Member invitation sent',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /pool/memberships/:id/members/:memberId
 * Remove a member from membership
 */
router.delete(
  '/:id/members/:memberId',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, memberId } = req.params;
      const userId = req.user!.id;

      const membership = await prisma.poolMembership.findFirst({
        where: { id, userId },
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          error: 'Membership not found',
        });
      }

      await prisma.membershipMember.delete({
        where: { id: memberId, membershipId: id },
      });

      res.json({
        success: true,
        message: 'Member removed',
      });
    } catch (error) {
      next(error);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, type, page = 1, limit = 20 } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;

      const [memberships, total] = await Promise.all([
        prisma.poolMembership.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            members: true,
          },
          orderBy: { startDate: 'desc' },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
        }),
        prisma.poolMembership.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          memberships,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
