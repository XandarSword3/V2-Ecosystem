import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

// Validation schemas
const applyCouponSchema = z.object({
  bookingId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  couponCode: z.string().min(1),
  cartTotal: z.number().positive(),
  existingCoupons: z.array(z.string()).default([]),
  userId: z.string().uuid(),
});

const createCouponSchema = z.object({
  code: z.string().min(3).max(50),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minimumPurchase: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().positive().optional(),
  perUserLimit: z.number().positive().default(1),
  startDate: z.string(),
  endDate: z.string(),
  stackable: z.boolean().default(false),
  stackingGroup: z.string().optional(),
  maxStackSize: z.number().positive().default(1),
  applicableTo: z.enum(['all', 'bookings', 'spa', 'activities']).default('all'),
});

const issueGiftCardSchema = z.object({
  initialBalance: z.number().positive(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  purchasedBy: z.string().uuid(),
  expiryMonths: z.number().positive().default(12),
  personalMessage: z.string().optional(),
});

const redeemGiftCardSchema = z.object({
  cardCode: z.string().min(1),
  amount: z.number().positive(),
  orderId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
});

const awardPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().positive(),
  source: z.enum(['purchase', 'referral', 'promotion', 'manual', 'birthday']),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  expiryDays: z.number().positive().default(365),
});

const redeemPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().positive(),
  redemptionType: z.enum(['discount', 'freebie', 'upgrade']),
  orderId: z.string().uuid().optional(),
});

export class PromotionsController {
  // ============== COUPONS ==============

  /**
   * Apply coupon with stacking validation
   */
  async applyCoupon(req: Request, res: Response) {
    try {
      const validation = applyCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Use the database function for validation
      const { data: result, error } = await supabase.rpc('validate_coupon_with_stacking', {
        p_coupon_code: data.couponCode,
        p_user_id: data.userId,
        p_cart_total: data.cartTotal,
        p_existing_coupons: data.existingCoupons,
      });

      if (error) throw error;

      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      // Get coupon details
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', data.couponCode)
        .single();

      res.json({
        success: true,
        data: {
          valid: true,
          discount: result.discount,
          coupon: {
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue: coupon.discount_value,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error applying coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to apply coupon', message: error.message });
    }
  }

  /**
   * Create new coupon
   */
  async createCoupon(req: Request, res: Response) {
    try {
      const validation = createCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Check for duplicate code
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', data.code)
        .single();

      if (existing) {
        return res.status(400).json({ success: false, error: 'Coupon code already exists' });
      }

      const { data: coupon, error } = await supabase
        .from('coupons')
        .insert({
          code: data.code.toUpperCase(),
          discount_type: data.discountType,
          discount_value: data.discountValue,
          minimum_purchase: data.minimumPurchase,
          max_discount: data.maxDiscount,
          usage_limit: data.usageLimit,
          per_user_limit: data.perUserLimit,
          start_date: data.startDate,
          end_date: data.endDate,
          stackable: data.stackable,
          stacking_group: data.stackingGroup,
          max_stack_size: data.maxStackSize,
          applicable_to: data.applicableTo,
          is_active: true,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: coupon });
    } catch (error: any) {
      logger.error('Error creating coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to create coupon', message: error.message });
    }
  }

  /**
   * Record coupon usage
   */
  async recordCouponUsage(couponId: string, userId: string, orderId?: string, bookingId?: string, discountAmount?: number) {
    const supabase = getSupabase();

    // First, get coupon's tenant and property info
    const { data: coupon } = await supabase
      .from('coupons')
      .select('tenant_id, property_id')
      .eq('id', couponId)
      .maybeSingle();

    await supabase.from('coupon_usage').insert({
      coupon_id: couponId,
      tenant_id: coupon?.tenant_id,
      property_id: coupon?.property_id,
      user_id: userId,
      order_id: orderId,
      booking_id: bookingId,
      discount_amount: discountAmount,
    });

    // Increment usage count
    await supabase.rpc('increment', { row_id: couponId, table_name: 'coupons', column_name: 'usage_count' });
  }

  /**
   * Get coupon abuse report
   */
  async getAbuseReport(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // High coupon usage — join users for display info
      const { data: highUsage, error: usageError } = await supabase
        .from('coupon_usage')
        .select(`
          user_id,
          users!inner(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Flagged users — read from loyalty_fraud_flags (users.fraud_flag/fraud_reason dropped in schema normalization)
      const { data: fraudFlagRows } = await supabase
        .from('loyalty_fraud_flags')
        .select('user_id, reason, flag_type, flagged_by, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      const flaggedUsers = fraudFlagRows || [];

      // Suspiciously rapid usage
      const { data: rapidUsage } = await supabase
        .from('coupon_usage')
        .select('user_id, created_at, coupon_id')
        .order('created_at', { ascending: false })
        .limit(500);

      // Group by user and count
      const userCounts: Record<string, number> = {};
      (rapidUsage || []).forEach(u => {
        userCounts[u.user_id] = (userCounts[u.user_id] || 0) + 1;
      });

      const suspiciousUsers = Object.entries(userCounts)
        .filter(([_, count]) => count > 10)
        .map(([userId, count]) => ({ userId, usageCount: count }));

      res.json({
        success: true,
        data: {
          flaggedUsers: flaggedUsers || [],
          suspiciousUsers,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching abuse report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch abuse report', message: error.message });
    }
  }

  // ============== GIFT CARDS ==============

  /**
   * Issue gift card
   */
  async issueGiftCard(req: Request, res: Response) {
    try {
      const validation = issueGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Generate unique code
      const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Calculate expiry
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + data.expiryMonths);

      // Create gift card
      const { data: giftCard, error } = await supabase
        .from('gift_cards')
        .insert({
          code,
          tenant_id: req.user?.tenantId,
          property_id: (req as any).propertyId,
          initial_balance: data.initialBalance,
          current_balance: data.initialBalance,
          purchased_by: data.purchasedBy,
          recipient_email: data.recipientEmail,
          recipient_name: data.recipientName,
          personal_message: data.personalMessage,
          expiry_date: expiryDate.toISOString().split('T')[0],
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Record liability
      await supabase.from('gift_card_ledger').insert({
        gift_card_id: giftCard.id,
        tenant_id: req.user?.tenantId,
        property_id: (req as any).propertyId,
        transaction_type: 'issuance',
        amount: data.initialBalance,
        balance_after: data.initialBalance,
        notes: `Gift card issued to ${data.recipientEmail || 'holder'}`,
      });

      res.status(201).json({ success: true, data: giftCard });
    } catch (error: any) {
      logger.error('Error issuing gift card:', error);
      res.status(500).json({ success: false, error: 'Failed to issue gift card', message: error.message });
    }
  }

  /**
   * Check gift card balance
   */
  async checkGiftCardBalance(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const supabase = getSupabase();

      const { data: giftCard, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', code)
        .single();

      if (error || !giftCard) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Check expiry
      const now = new Date();
      const expiryDate = new Date(giftCard.expiry_date);
      const isExpired = expiryDate < now;

      res.json({
        success: true,
        data: {
          code: giftCard.code,
          balance: giftCard.current_balance,
          initialBalance: giftCard.initial_balance,
          expiryDate: giftCard.expiry_date,
          isExpired,
          isActive: giftCard.is_active && !isExpired,
        },
      });
    } catch (error: any) {
      logger.error('Error checking gift card:', error);
      res.status(500).json({ success: false, error: 'Failed to check gift card', message: error.message });
    }
  }

  /**
   * Redeem gift card
   */
  async redeemGiftCard(req: Request, res: Response) {
    try {
      const validation = redeemGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Get gift card
      const { data: giftCard, error: gcError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', data.cardCode)
        .single();

      if (gcError || !giftCard) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Validations
      if (!giftCard.is_active) {
        return res.status(400).json({ success: false, error: 'Gift card is deactivated' });
      }

      const now = new Date();
      const expiryDate = new Date(giftCard.expiry_date);
      if (expiryDate < now) {
        return res.status(400).json({ success: false, error: 'Gift card has expired' });
      }

      if (parseFloat(giftCard.current_balance) < data.amount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
          availableBalance: giftCard.current_balance,
        });
      }

      // Deduct balance
      const newBalance = parseFloat(giftCard.current_balance) - data.amount;
      const { data: updated, error: updateError } = await supabase
        .from('gift_cards')
        .update({
          current_balance: newBalance,
          last_used: new Date().toISOString(),
        })
        .eq('id', giftCard.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Record transaction
      await supabase.from('gift_card_ledger').insert({
        gift_card_id: giftCard.id,
        tenant_id: giftCard.tenant_id,
        property_id: giftCard.property_id,
        transaction_type: 'redemption',
        amount: -data.amount,
        balance_after: newBalance,
        order_id: data.orderId,
        booking_id: data.bookingId,
        redeemed_by: userId,
      });

      res.json({
        success: true,
        data: {
          amountRedeemed: data.amount,
          remainingBalance: newBalance,
        },
      });
    } catch (error: any) {
      logger.error('Error redeeming gift card:', error);
      res.status(500).json({ success: false, error: 'Failed to redeem gift card', message: error.message });
    }
  }

  /**
   * Get gift card liability report
   */
  async getGiftCardLiabilityReport(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get all active gift cards
      const { data: giftCards, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const now = new Date();
      let totalLiability = 0;
      let expiredLiability = 0;
      let activeLiability = 0;

      (giftCards || []).forEach(gc => {
        const balance = parseFloat(gc.current_balance) || 0;
        const expiryDate = new Date(gc.expiry_date);
        
        totalLiability += balance;
        
        if (expiryDate < now) {
          expiredLiability += balance;
        } else {
          activeLiability += balance;
        }
      });

      // Get monthly issuance/redemption
      const { data: ledger } = await supabase
        .from('gift_card_ledger')
        .select('transaction_type, amount, created_at')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString());

      const monthlyStats: Record<string, { issued: number; redeemed: number }> = {};
      (ledger || []).forEach(entry => {
        const month = entry.created_at.substring(0, 7);
        if (!monthlyStats[month]) {
          monthlyStats[month] = { issued: 0, redeemed: 0 };
        }
        if (entry.transaction_type === 'issuance') {
          monthlyStats[month].issued += Math.abs(parseFloat(entry.amount));
        } else if (entry.transaction_type === 'redemption') {
          monthlyStats[month].redeemed += Math.abs(parseFloat(entry.amount));
        }
      });

      res.json({
        success: true,
        data: {
          totalLiability,
          activeLiability,
          expiredLiability,
          totalCards: (giftCards || []).length,
          monthlyStats,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching gift card liability:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch report', message: error.message });
    }
  }

  // ============== LOYALTY ==============

  /**
   * Award loyalty points
   */
  async awardPoints(req: Request, res: Response) {
    try {
      const validation = awardPointsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Calculate expiry
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + data.expiryDays);

      // Create point batch
      const { data: batch, error: batchError } = await supabase
        .from('loyalty_point_batches')
        .insert({
          tenant_id: req.user?.tenantId,
          property_id: (req as any).propertyId,
          user_id: data.userId,
          points_earned: data.points,
          points_remaining: data.points,
          source: data.source,
          reference_type: data.referenceType,
          reference_id: data.referenceId,
          expires_at: expiryDate.toISOString(),
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Compute balance from batches (users.loyalty_points column dropped in schema normalization)
      const { data: batchRows } = await supabase
        .from('loyalty_point_batches')
        .select('points_remaining')
        .eq('user_id', data.userId)
        .gt('points_remaining', 0)
        .gt('expires_at', new Date().toISOString());
      const currentTotal = (batchRows || []).reduce((sum: number, b: any) => sum + (b.points_remaining || 0), 0);
      const newTotal = currentTotal + data.points;

      // Record transaction
      await supabase.from('loyalty_transactions').insert({
        tenant_id: req.user?.tenantId,
        property_id: (req as any).propertyId,
        user_id: data.userId,
        transaction_type: 'earn',
        points: data.points,
        balance_after: newTotal,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        notes: `Points earned from ${data.source}`,
      });

      res.status(201).json({
        success: true,
        data: {
          pointsAwarded: data.points,
          newBalance: newTotal,
          expiresAt: expiryDate,
        },
      });
    } catch (error: any) {
      logger.error('Error awarding points:', error);
      res.status(500).json({ success: false, error: 'Failed to award points', message: error.message });
    }
  }

  /**
   * Redeem loyalty points (FIFO - oldest first)
   */
  async redeemPoints(req: Request, res: Response) {
    try {
      const validation = redeemPointsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Verify user exists
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.userId)
        .maybeSingle();

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Check fraud status via loyalty_fraud_flags (users.fraud_flag dropped in schema normalization)
      const { data: fraudFlag } = await supabase
        .from('loyalty_fraud_flags')
        .select('id')
        .eq('user_id', data.userId)
        .limit(1)
        .maybeSingle();

      if (fraudFlag) {
        return res.status(403).json({ success: false, error: 'Account flagged for review' });
      }

      // Compute balance from batches
      const now = new Date().toISOString();
      const { data: activeBatches } = await supabase
        .from('loyalty_point_batches')
        .select('points_remaining')
        .eq('user_id', data.userId)
        .gt('points_remaining', 0)
        .gt('expires_at', now);
      const currentPoints = (activeBatches || []).reduce((sum: number, b: any) => sum + (b.points_remaining || 0), 0);

      if (currentPoints < data.points) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient points',
          availablePoints: currentPoints,
        });
      }

      // FIFO redemption from batches
      let pointsToRedeem = data.points;

      const { data: batches } = await supabase
        .from('loyalty_point_batches')
        .select('*')
        .eq('user_id', data.userId)
        .gt('points_remaining', 0)
        .gt('expires_at', now)
        .order('created_at', { ascending: true });

      for (const batch of (batches || [])) {
        if (pointsToRedeem <= 0) break;

        const deduction = Math.min(batch.points_remaining, pointsToRedeem);
        
        await supabase
          .from('loyalty_point_batches')
          .update({ points_remaining: batch.points_remaining - deduction })
          .eq('id', batch.id);

        pointsToRedeem -= deduction;
      }

      const newTotal = currentPoints - data.points;

      // Record transaction (users.loyalty_points sync removed — column dropped in schema normalization)
      await supabase.from('loyalty_transactions').insert({
        tenant_id: req.user?.tenantId,
        property_id: (req as any).propertyId,
        user_id: data.userId,
        transaction_type: 'redeem',
        points: -data.points,
        balance_after: newTotal,
        order_id: data.orderId,
        notes: `Points redeemed for ${data.redemptionType}`,
      });

      res.json({
        success: true,
        data: {
          pointsRedeemed: data.points,
          newBalance: newTotal,
          redemptionType: data.redemptionType,
        },
      });
    } catch (error: any) {
      logger.error('Error redeeming points:', error);
      res.status(500).json({ success: false, error: 'Failed to redeem points', message: error.message });
    }
  }

  /**
   * Get user loyalty status
   */
  async getUserLoyaltyStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const supabase = getSupabase();

      const { data: user, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Get tier from loyalty_members (users.loyalty_points/loyalty_tier dropped in schema normalization)
      const { data: loyaltyMember } = await supabase
        .from('loyalty_members')
        .select('tier:loyalty_tiers(name)')
        .eq('user_id', userId)
        .maybeSingle();

      // Get point batches with expiry
      const now = new Date().toISOString();
      const { data: batches } = await supabase
        .from('loyalty_point_batches')
        .select('*')
        .eq('user_id', userId)
        .gt('points_remaining', 0)
        .gt('expires_at', now)
        .order('expires_at', { ascending: true });

      // Points expiring soon (next 30 days)
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const expiringSoon = (batches || [])
        .filter(b => new Date(b.expires_at) < thirtyDays)
        .reduce((sum, b) => sum + b.points_remaining, 0);

      // Recent transactions
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            totalPoints: (batches || []).reduce((sum: number, b: any) => sum + b.points_remaining, 0),
            tier: (loyaltyMember?.tier as any)?.name ?? null,
          },
          pointsExpiringSoon: expiringSoon,
          batches: batches || [],
          recentTransactions: transactions || [],
        },
      });
    } catch (error: any) {
      logger.error('Error fetching loyalty status:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch status', message: error.message });
    }
  }

  /**
   * Flag user for fraud
   */
  async flagUserFraud(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.userId;
      const supabase = getSupabase();

      // Record in fraud flags table (users.fraud_flag/fraud_reason dropped in schema normalization)
      await supabase.from('loyalty_fraud_flags').insert({
        tenant_id: req.user?.tenantId,
        property_id: (req as any).propertyId,
        user_id: userId,
        flag_type: 'manual',
        reason,
        flagged_by: adminId,
      });

      res.json({ success: true, message: 'User flagged for fraud' });
    } catch (error: any) {
      logger.error('Error flagging user:', error);
      res.status(500).json({ success: false, error: 'Failed to flag user', message: error.message });
    }
  }

  /**
   * Expire old points
   */
  async expirePoints(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();

      // Find expired batches
      const { data: expired } = await supabase
        .from('loyalty_point_batches')
        .select('*')
        .lte('expires_at', now)
        .gt('points_remaining', 0);

      let totalExpired = 0;
      const affectedUsers: string[] = [];

      for (const batch of (expired || [])) {
        totalExpired += batch.points_remaining;
        if (!affectedUsers.includes(batch.user_id)) {
          affectedUsers.push(batch.user_id);
        }

        // Mark batch as expired
        await supabase
          .from('loyalty_point_batches')
          .update({ points_remaining: 0 })
          .eq('id', batch.id);

        // Record transaction (users.loyalty_points sync removed — balance tracked via loyalty_point_batches)
        await supabase.from('loyalty_transactions').insert({
          tenant_id: batch.tenant_id,
          property_id: batch.property_id,
          user_id: batch.user_id,
          transaction_type: 'expire',
          points: -batch.points_remaining,
          balance_after: 0,
          notes: 'Points expired',
        });
      }

      res.json({
        success: true,
        data: {
          batchesProcessed: (expired || []).length,
          totalPointsExpired: totalExpired,
          usersAffected: affectedUsers.length,
        },
      });
    } catch (error: any) {
      logger.error('Error expiring points:', error);
      res.status(500).json({ success: false, error: 'Failed to expire points', message: error.message });
    }
  }
}

export const promotionsController = new PromotionsController();


